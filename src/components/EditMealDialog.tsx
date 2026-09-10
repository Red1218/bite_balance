import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface EditMealDialogProps {
  meal: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: any) => Promise<void>;
  isDailyMeal?: boolean;
}

const EditMealDialog: React.FC<EditMealDialogProps> = ({
  meal,
  open,
  onOpenChange,
  onSave,
  isDailyMeal = false,
}) => {
  const [formData, setFormData] = useState({
    name: meal?.name || '',
    calories: meal?.calories || 0,
    protein: meal?.protein || 0,
    carbs: meal?.carbs || 0,
    fat: meal?.fat || 0,
    fiber: meal?.fiber || 0,
    meal_time: meal?.meal_time || 'snack',
    tags: meal?.tags?.join(', ') || '',
    notes: meal?.notes || '',
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updates = {
        name: formData.name,
        calories: Number(formData.calories),
        protein: Number(formData.protein),
        carbs: Number(formData.carbs),
        fat: Number(formData.fat),
        fiber: Number(formData.fiber),
        ...(isDailyMeal && { meal_time: formData.meal_time }),
        ...(!isDailyMeal && {
          tags: formData.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          notes: formData.notes,
        }),
      };

      await onSave(updates);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving meal:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (meal) {
      setFormData({
        name: meal.name || '',
        calories: meal.calories || 0,
        protein: meal.protein || 0,
        carbs: meal.carbs || 0,
        fat: meal.fat || 0,
        fiber: meal.fiber || 0,
        meal_time: meal.meal_time || 'snack',
        tags: meal.tags?.join(', ') || '',
        notes: meal.notes || '',
      });
    }
  }, [meal]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-display">Edit Meal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Meal Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="rounded-xl focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="calories">Calories</Label>
              <Input
                id="calories"
                type="number"
                value={formData.calories}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    calories: Number(e.target.value),
                  }))
                }
                className="rounded-xl font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
                required
              />
            </div>
            {isDailyMeal && (
              <div className="space-y-2">
                <Label htmlFor="meal_time">Meal Time</Label>
                <select
                  id="meal_time"
                  value={formData.meal_time}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      meal_time: e.target.value,
                    }))
                  }
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-2">
              <Label htmlFor="protein" className="text-chart-protein">Protein (g)</Label>
              <Input
                id="protein"
                type="number"
                step="0.1"
                value={formData.protein}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    protein: Number(e.target.value),
                  }))
                }
                className="rounded-xl font-mono tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carbs" className="text-chart-carbs">Carbs (g)</Label>
              <Input
                id="carbs"
                type="number"
                step="0.1"
                value={formData.carbs}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    carbs: Number(e.target.value),
                  }))
                }
                className="rounded-xl font-mono tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fat" className="text-chart-fat">Fat (g)</Label>
              <Input
                id="fat"
                type="number"
                step="0.1"
                value={formData.fat}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    fat: Number(e.target.value),
                  }))
                }
                className="rounded-xl font-mono tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fiber" className="text-chart-fiber">Fiber (g)</Label>
              <Input
                id="fiber"
                type="number"
                step="0.1"
                value={formData.fiber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    fiber: Number(e.target.value),
                  }))
                }
                className="rounded-xl font-mono tabular-nums"
              />
            </div>
          </div>

          {!isDailyMeal && (
            <>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, tags: e.target.value }))
                  }
                  placeholder="e.g. Protein, Healthy, Quick"
                  className="rounded-xl focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Additional notes about this meal..."
                  className="rounded-xl focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditMealDialog;
