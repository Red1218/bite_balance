import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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

        <div className="space-y-2">
          <Label htmlFor="calories" className="text-xs uppercase tracking-wide text-muted-foreground">Calories *</Label>
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
