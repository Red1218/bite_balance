import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  createCustomFood,
  addFoodAliases,
  updateCustomFood,
  confirmNotDuplicate,
  categories,
  IndianFood,
} from '@/services/foodService';

const MACRO_FIELDS = [
  { key: 'protein', label: 'Protein', color: 'text-chart-protein' },
  { key: 'carbs', label: 'Carbs', color: 'text-chart-carbs' },
  { key: 'fat', label: 'Fat', color: 'text-chart-fat' },
  { key: 'fiber', label: 'Fiber', color: 'text-chart-fiber' },
] as const;

export interface AddFoodFormProps {
  onFoodAdded: () => void;
  onCancel: () => void;
  /** When set, the form edits this saved food instead of creating a new one. */
  food?: IndianFood;
  /** Prefill for a new food (e.g. from a meal being logged). Ignored when editing. */
  initial?: Partial<Record<'name' | 'serving_size' | 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber', string>>;
}

const AddFoodForm: React.FC<AddFoodFormProps> = ({ onFoodAdded, onCancel, food, initial }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: food?.name ?? '',
    category: food?.category ?? 'south_indian',
    serving_size: String(food?.serving_size ?? 100),
    serving_unit: food?.serving_unit ?? 'g',
    calories: food ? String(food.calories) : '',
    protein: food ? String(food.protein ?? 0) : '',
    carbs: food ? String(food.carbs ?? 0) : '',
    fat: food ? String(food.fat ?? 0) : '',
    fiber: food ? String(food.fiber ?? 0) : '',
    ...(food ? {} : initial),
  });
  // Search aliases for a new food, entered as chips (comma or Enter adds one).
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasDraft, setAliasDraft] = useState('');
  const commitAlias = () => {
    const alias = aliasDraft.trim();
    if (alias) setAliases((prev) => [...prev, alias]);
    setAliasDraft('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.calories) {
      toast({
        title: 'Error',
        description: 'Please fill in food name and calories',
        variant: 'destructive',
      });
      return;
    }

    // Editing: the food matching its own name isn't a duplicate.
    if (!(await confirmNotDuplicate(formData.name, food?.id))) return;

    setLoading(true);

    try {
      const values = {
        name: formData.name,
        category: formData.category,
        serving_size: Number(formData.serving_size) || 100,
        serving_unit: formData.serving_unit,
        calories: Number(formData.calories) || 0,
        protein: Number(formData.protein) || 0,
        carbs: Number(formData.carbs) || 0,
        fat: Number(formData.fat) || 0,
        fiber: Number(formData.fiber) || 0,
      };
      if (food) await updateCustomFood(food.id, values);
      else {
        const created = await createCustomFood(values);
        await addFoodAliases(created.id, [...aliases, aliasDraft.trim()].filter(Boolean));
      }

      toast({
        title: 'Success',
        description: food ? 'Food updated!' : 'Food saved successfully!',
      });

      onFoodAdded();
    } catch (error) {
      console.error('Error saving food:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save food. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="elevation-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-foreground">{food ? 'Edit food' : 'Save a new food'}</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="food-name" className="text-xs uppercase tracking-wide text-muted-foreground">Food Name *</Label>
          <Input
            id="food-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Whole eggs"
            className="rounded-xl h-11 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-2">
            <Label htmlFor="food-category" className="text-[10px] uppercase tracking-wide text-muted-foreground">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(val) => setFormData({ ...formData, category: val })}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Serving</Label>
            <div className="flex gap-1.5">
              <Input
                type="number"
                step="0.1"
                value={formData.serving_size}
                onChange={(e) => setFormData({ ...formData, serving_size: e.target.value })}
                placeholder="100"
                className="rounded-xl h-11 font-mono tabular-nums"
              />
              <Input
                value={formData.serving_unit}
                onChange={(e) => setFormData({ ...formData, serving_unit: e.target.value })}
                placeholder="g"
                className="rounded-xl h-11 w-16 flex-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="food-calories" className="text-xs uppercase tracking-wide text-muted-foreground">
            Calories for this serving *
          </Label>
          <Input
            id="food-calories"
            type="number"
            value={formData.calories}
            onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
            placeholder="0"
            className="rounded-xl h-11 font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
            required
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          {MACRO_FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={`food-${f.key}`} className={`text-[10px] uppercase tracking-wide ${f.color}`}>{f.label}</Label>
              <Input
                id={`food-${f.key}`}
                type="number"
                step="0.1"
                value={formData[f.key]}
                onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                placeholder="0"
                className="rounded-lg h-10 font-mono tabular-nums"
              />
            </div>
          ))}
        </div>

        {!food && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="food-alias-draft" className="text-xs uppercase tracking-wide text-muted-foreground">Aliases</Label>
              <span className="text-[10px] text-muted-foreground">optional</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-input p-2">
              {aliases.map((alias, i) => (
                <span
                  key={`${alias}-${i}`}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground"
                >
                  {alias}
                  <button type="button" onClick={() => setAliases(aliases.filter((_, j) => j !== i))} aria-label={`Remove ${alias}`}>
                    <X className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </span>
              ))}
              <input
                id="food-alias-draft"
                value={aliasDraft}
                onChange={(e) => setAliasDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === ',' || e.key === 'Enter') {
                    e.preventDefault();
                    commitAlias();
                  }
                }}
                onBlur={commitAlias}
                placeholder="Type and press comma"
                className="min-w-[110px] flex-1 bg-transparent px-1 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={loading} className="flex-1 rounded-xl h-12">
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Saving...' : food ? 'Save changes' : 'Save food'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl h-12">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddFoodForm;
