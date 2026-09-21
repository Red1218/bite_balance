import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Save, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { findExistingSavedItemByName, getMyCustomFoods, IndianFood } from '@/services/foodService';

interface AddSavedMealFormProps {
  onMealAdded: () => void;
  onCancel: () => void;
}

const AddSavedMealForm: React.FC<AddSavedMealFormProps> = ({
  onMealAdded,
  onCancel,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    notes: '',
    tagInput: '',
  });
  const [tags, setTags] = useState<string[]>([]);

  const [buildMode, setBuildMode] = useState<'manual' | 'foods'>('manual');
  const [myFoods, setMyFoods] = useState<IndianFood[]>([]);
  const [foodSearch, setFoodSearch] = useState('');
  // multiplier applied to a food's own serving -- '1' means "one serving as saved"
  const [selected, setSelected] = useState<Record<string, string>>({});

  useEffect(() => {
    if (buildMode === 'foods' && myFoods.length === 0) {
      getMyCustomFoods().then(setMyFoods).catch(() => setMyFoods([]));
    }
  }, [buildMode, myFoods.length]);

  useEffect(() => {
    if (buildMode !== 'foods') return;
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    for (const food of myFoods) {
      const raw = selected[food.id];
      if (raw === undefined) continue;
      const mult = Number(raw);
      if (!Number.isFinite(mult)) continue;
      totals.calories += food.calories * mult;
      totals.protein += (food.protein || 0) * mult;
      totals.carbs += (food.carbs || 0) * mult;
      totals.fat += (food.fat || 0) * mult;
      totals.fiber += (food.fiber || 0) * mult;
    }
    setFormData((prev) => ({
      ...prev,
      calories: String(Math.round(totals.calories)),
      protein: String(Math.round(totals.protein * 10) / 10),
      carbs: String(Math.round(totals.carbs * 10) / 10),
      fat: String(Math.round(totals.fat * 10) / 10),
      fiber: String(Math.round(totals.fiber * 10) / 10),
    }));
    // Recompute only when the selection itself changes -- formData's own
    // fields stay independently editable afterward without fighting this sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, buildMode]);

  const toggleFood = (food: IndianFood) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (food.id in next) {
        delete next[food.id];
      } else {
        next[food.id] = '1';
      }
      return next;
    });
  };

  const setMultiplier = (foodId: string, value: string) => {
    setSelected((prev) => ({ ...prev, [foodId]: value }));
  };

  const filteredFoods = myFoods.filter((f) =>
    f.name.toLowerCase().includes(foodSearch.toLowerCase())
  );

  const handleAddTag = () => {
    if (formData.tagInput.trim() && !tags.includes(formData.tagInput.trim())) {
      setTags([...tags, formData.tagInput.trim()]);
      setFormData({ ...formData, tagInput: '' });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to save meals',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.name || !formData.calories) {
      toast({
        title: 'Error',
        description: 'Please fill in meal name and calories',
        variant: 'destructive',
      });
      return;
    }

    const existing = await findExistingSavedItemByName(formData.name);
    if (existing) {
      const kind = existing.type === 'meal' ? 'saved meal' : 'custom food';
      if (!window.confirm(`You already have a ${kind} named "${formData.name}". Save this anyway?`)) {
        return;
      }
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('saved_meals').insert({
        user_id: user.id,
        name: formData.name,
        calories: Number(formData.calories),
        protein: Number(formData.protein) || 0,
        carbs: Number(formData.carbs) || 0,
        fat: Number(formData.fat) || 0,
        fiber: Number(formData.fiber) || 0,
        tags: tags.length > 0 ? tags : null,
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Meal saved successfully!',
      });

      onMealAdded();
    } catch (error) {
      console.error('Error saving meal:', error);
      toast({
        title: 'Error',
        description: 'Failed to save meal. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="elevation-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-foreground">Save a new meal</h3>
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
          <Label htmlFor="name" className="text-xs uppercase tracking-wide text-muted-foreground">Meal Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            placeholder="e.g., Protein Smoothie"
            className="rounded-xl h-11 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
            required
          />
        </div>

        <div className="flex gap-1.5">
          {(['manual', 'foods'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setBuildMode(mode)}
              className={cn(
                'h-8 flex-1 rounded-full text-xs font-medium border transition-colors',
                buildMode === mode
                  ? 'bg-primary/12 border-primary/40 text-primary'
                  : 'bg-card border-border text-muted-foreground'
              )}
            >
              {mode === 'manual' ? 'Enter totals manually' : 'Build from your foods'}
            </button>
          ))}
        </div>

        {buildMode === 'foods' && (
          <div className="space-y-2">
            <Input
              value={foodSearch}
              onChange={(e) => setFoodSearch(e.target.value)}
              placeholder="Search your saved foods..."
              className="rounded-xl h-10"
            />
            {filteredFoods.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">
                No saved foods yet -- save some from the "Add a food" tab first.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5">
                {filteredFoods.map((food) => {
                  const isSelected = food.id in selected;
                  return (
                    <div
                      key={food.id}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border p-2 transition-colors',
                        isSelected ? 'bg-primary/8 border-primary/30' : 'bg-card border-border'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleFood(food)}
                        className={cn(
                          'flex h-7 w-7 flex-none items-center justify-center rounded-full border',
                          isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-transparent'
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{food.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {food.serving_size}
                          {food.serving_unit} · {Math.round(food.calories)} kcal
                        </div>
                      </div>
                      {isSelected && (
                        <Input
                          type="number"
                          step="0.25"
                          value={selected[food.id]}
                          onChange={(e) => setMultiplier(food.id, e.target.value)}
                          className="h-9 w-16 flex-none rounded-lg font-mono text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="calories" className="text-xs uppercase tracking-wide text-muted-foreground">
            {buildMode === 'foods' ? 'Total calories (from selected foods)' : 'Calories *'}
          </Label>
          <Input
            id="calories"
            type="number"
            value={formData.calories}
            onChange={(e) =>
              setFormData({ ...formData, calories: e.target.value })
            }
            placeholder="0"
            className="rounded-xl h-11 font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
            required
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label htmlFor="protein" className="text-[10px] uppercase tracking-wide text-chart-protein">Protein</Label>
            <Input
              id="protein"
              type="number"
              step="0.1"
              value={formData.protein}
              onChange={(e) =>
                setFormData({ ...formData, protein: e.target.value })
              }
              placeholder="0"
              className="rounded-lg h-10 font-mono tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="carbs" className="text-[10px] uppercase tracking-wide text-chart-carbs">Carbs</Label>
            <Input
              id="carbs"
              type="number"
              step="0.1"
              value={formData.carbs}
              onChange={(e) =>
                setFormData({ ...formData, carbs: e.target.value })
              }
              placeholder="0"
              className="rounded-lg h-10 font-mono tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fat" className="text-[10px] uppercase tracking-wide text-chart-fat">Fat</Label>
            <Input
              id="fat"
              type="number"
              step="0.1"
              value={formData.fat}
              onChange={(e) =>
                setFormData({ ...formData, fat: e.target.value })
              }
              placeholder="0"
              className="rounded-lg h-10 font-mono tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fiber" className="text-[10px] uppercase tracking-wide text-chart-fiber">Fiber</Label>
            <Input
              id="fiber"
              type="number"
              step="0.1"
              value={formData.fiber}
              onChange={(e) =>
                setFormData({ ...formData, fiber: e.target.value })
              }
              placeholder="0"
              className="rounded-lg h-10 font-mono tabular-nums"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags" className="text-xs uppercase tracking-wide text-muted-foreground">Tags</Label>
          <div className="flex gap-2">
            <Input
              id="tags"
              value={formData.tagInput}
              onChange={(e) =>
                setFormData({ ...formData, tagInput: e.target.value })
              }
              placeholder="Add a tag..."
              className="rounded-xl h-10"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <Button type="button" onClick={handleAddTag} size="icon" variant="outline" className="rounded-xl h-10 w-10 flex-none">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-1 bg-background/50 text-muted-foreground border-border font-normal"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 text-xs hover:text-primary"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes" className="text-xs uppercase tracking-wide text-muted-foreground">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            placeholder="Any additional notes..."
            rows={3}
            className="rounded-xl focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-xl h-12"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Saving...' : 'Save meal'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl h-12">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddSavedMealForm;
