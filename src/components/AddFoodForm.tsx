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
  updateCustomFood,
  findExistingSavedItemByName,
  IndianFood,
} from '@/services/foodService';

const categories = [
  { id: 'rice_grains', name: 'Rice & Grains', icon: '🍚' },
  { id: 'south_indian', name: 'South Indian', icon: '🥞' },
  { id: 'north_indian', name: 'North Indian', icon: '🫓' },
  { id: 'curries', name: 'Curries', icon: '🍛' },
  { id: 'vegetables', name: 'Vegetables', icon: '🥦' },
  { id: 'fruits', name: 'Fruits', icon: '🍎' },
  { id: 'dairy', name: 'Dairy', icon: '🧀' },
  { id: 'eggs', name: 'Eggs', icon: '🥚' },
  { id: 'chicken', name: 'Chicken', icon: '🍗' },
  { id: 'meat', name: 'Meat', icon: '🥩' },
  { id: 'seafood', name: 'Seafood', icon: '🐟' },
  { id: 'snacks', name: 'Snacks', icon: '🥟' },
  { id: 'beverages', name: 'Beverages', icon: '☕' },
];

interface AddFoodFormProps {
  onFoodAdded: () => void;
  onCancel: () => void;
  /** When set, the form edits this saved food instead of creating a new one. */
  food?: IndianFood;
}

const AddFoodForm: React.FC<AddFoodFormProps> = ({ onFoodAdded, onCancel, food }) => {
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
  });

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
    const existing = await findExistingSavedItemByName(formData.name);
    if (existing && existing.id !== food?.id) {
      const kind = existing.type === 'meal' ? 'saved meal' : 'custom food';
      if (!window.confirm(`You already have a ${kind} named "${formData.name}". Save this anyway?`)) {
        return;
      }
    }

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
      else await createCustomFood(values);

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
          <div className="space-y-2">
            <Label htmlFor="food-protein" className="text-[10px] uppercase tracking-wide text-chart-protein">Protein</Label>
            <Input
              id="food-protein"
              type="number"
              step="0.1"
              value={formData.protein}
              onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
              placeholder="0"
              className="rounded-lg h-10 font-mono tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="food-carbs" className="text-[10px] uppercase tracking-wide text-chart-carbs">Carbs</Label>
            <Input
              id="food-carbs"
              type="number"
              step="0.1"
              value={formData.carbs}
              onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
              placeholder="0"
              className="rounded-lg h-10 font-mono tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="food-fat" className="text-[10px] uppercase tracking-wide text-chart-fat">Fat</Label>
            <Input
              id="food-fat"
              type="number"
              step="0.1"
              value={formData.fat}
              onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
              placeholder="0"
              className="rounded-lg h-10 font-mono tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="food-fiber" className="text-[10px] uppercase tracking-wide text-chart-fiber">Fiber</Label>
            <Input
              id="food-fiber"
              type="number"
              step="0.1"
              value={formData.fiber}
              onChange={(e) => setFormData({ ...formData, fiber: e.target.value })}
              placeholder="0"
              className="rounded-lg h-10 font-mono tabular-nums"
            />
          </div>
        </div>

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
