import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import MealReviewList, { ChatMealItem, MealTime, chatMealItemToRow } from '@/components/MealReviewList';
import { parseMealLogFile, fmtLocalDate } from '@/lib/importMealLog';

const Import = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { notifyMealsLogged } = useAddMealSheet();
  const navigate = useNavigate();

  const [items, setItems] = useState<ChatMealItem[] | null>(null);
  const [loggedDate, setLoggedDate] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setItems(null);
    setLoggedDate(null);
    setFileName(null);
    setError(null);
  };

  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseMealLogFile(buffer);
      setItems(parsed.items);
      // The file's own date is only a starting point -- editable below, so a
      // file with no stated date (or one you want logged elsewhere) still works.
      setLoggedDate(parsed.loggedDate ?? fmtLocalDate(new Date()));
    } catch (err) {
      console.error('Error parsing meal log file:', err);
      setError(err instanceof Error ? err.message : 'Could not read that file.');
      setItems(null);
      setLoggedDate(null);
    }
  };

  const handleChangeMealTime = (idx: number, mealTime: MealTime) => {
    setItems((prev) => (prev ? prev.map((it, i) => (i === idx ? { ...it, mealTime } : it)) : prev));
  };

  const handleImport = async () => {
    if (!user || !items || !loggedDate) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from('daily_meals')
        .delete()
        .eq('user_id', user.id)
        .eq('logged_date', loggedDate)
        .eq('source', 'import');
      if (deleteError) throw deleteError;

      const rows = items.map((item) => ({ ...chatMealItemToRow(item, user.id, loggedDate), source: 'import' }));
      const { error: insertError } = await supabase.from('daily_meals').insert(rows);
      if (insertError) throw insertError;

      toast({ title: 'Imported', description: `Logged ${items.length} item${items.length === 1 ? '' : 's'} for ${loggedDate}.` });
      notifyMealsLogged();
      navigate('/');
    } catch (err) {
      console.error('Error importing meal log:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to import. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (items && loggedDate) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground">Import log</h1>
          <p className="text-xs text-muted-foreground">{fileName}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="import-date" className="text-xs uppercase tracking-wide text-muted-foreground">
            Log to date
          </Label>
          {/* The file's own date (if any) is just the default -- change it to log
              this same file to yesterday, last week, or any other past day. */}
          <Input
            id="import-date"
            type="date"
            value={loggedDate}
            onChange={(e) => e.target.value && setLoggedDate(e.target.value)}
            max={fmtLocalDate(new Date())}
            disabled={saving}
            className="h-11 w-full rounded-xl font-mono tabular-nums"
          />
        </div>

        <MealReviewList
          items={items}
          onAccept={handleImport}
          onBack={reset}
          onChangeMealTime={handleChangeMealTime}
          backLabel="Choose a different file"
          saving={saving}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/12 border border-primary/28">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground">Import log</h1>
          <p className="text-xs text-muted-foreground">Import a day's meals from an Excel sheet.</p>
        </div>
      </div>

      <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 text-center">
        {saving ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Tap to choose an .xlsx file</span>
          </>
        )}
        <input
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
      </label>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
};

export default Import;
