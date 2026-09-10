import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSavedMeals, SavedMeal } from '@/hooks/useSavedMeals';
import { useDailyMeals } from '@/hooks/useDailyMeals';
import EditMealDialog from '@/components/EditMealDialog';
import AddSavedMealForm from '@/components/AddSavedMealForm';
import MealTimeSelector from '@/components/MealTimeSelector';

const SavedMeals = () => {
  const {
    meals: savedMeals,
    loading,
    updateMeal,
    deleteMeal,
    refetch,
  } = useSavedMeals();
  const { addMealFromSaved } = useDailyMeals();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMeal, setEditingMeal] = useState<SavedMeal | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMealForToday, setSelectedMealForToday] = useState<SavedMeal | null>(null);
  const [isMealTimeSelectorOpen, setIsMealTimeSelectorOpen] = useState(false);

  const filteredMeals = savedMeals.filter(
    (meal) =>
      meal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meal.tags?.some((tag) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const handleQuickAdd = async (meal: SavedMeal) => {
    setSelectedMealForToday(meal);
    setIsMealTimeSelectorOpen(true);
  };

  const handleMealTimeSelect = async (mealTime: string) => {
    if (selectedMealForToday) {
      await addMealFromSaved(selectedMealForToday, mealTime);
    }
    setIsMealTimeSelectorOpen(false);
    setSelectedMealForToday(null);
  };

  const handleEditMeal = (meal: SavedMeal) => {
    setEditingMeal(meal);
    setIsEditDialogOpen(true);
  };

  const handleDeleteMeal = async (meal: SavedMeal) => {
    if (window.confirm(`Are you sure you want to delete "${meal.name}"?`)) {
      await deleteMeal(meal.id);
    }
  };

  const handleSaveMeal = async (updates: Partial<SavedMeal>) => {
    if (editingMeal) {
      await updateMeal(editingMeal.id, updates);
    }
  };

  const handleMealAdded = () => {
    setShowAddForm(false);
    refetch();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 bg-primary rounded-full animate-pulse mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading saved meals...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link to="/">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl bg-card border border-border text-muted-foreground hover:bg-accent"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-display font-semibold text-foreground">Saved meals</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {savedMeals.length} combo{savedMeals.length === 1 ? '' : 's'} · tap to log instantly
            </p>
          </div>
          <Button
            onClick={() => setShowAddForm(true)}
            size="icon"
            className="rounded-xl h-10 w-10 flex-none"
            disabled={showAddForm}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="elevation-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search saved meals or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
            />
          </div>
        </div>

        {/* Add New Meal Form */}
        {showAddForm && (
          <AddSavedMealForm
            onMealAdded={handleMealAdded}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {/* Saved Meals List */}
        <div className="space-y-4">
          {filteredMeals.map((meal) => (
            <div key={meal.id} className="elevation-card p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/12 border border-primary/24 flex-none flex items-center justify-center font-mono text-xs font-semibold text-primary">
                  {meal.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground leading-tight truncate">
                    {meal.name}
                  </h3>
                  {meal.tags && meal.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {meal.tags.map((tag, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="text-[10px] bg-background/50 text-muted-foreground border-border font-normal"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right flex-none">
                  <div className="font-mono font-semibold text-lg tabular-nums text-foreground">
                    {meal.calories}
                  </div>
                  <div className="text-[9px] tracking-wider text-muted-foreground uppercase">kcal</div>
                </div>
                <div className="flex flex-none gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditMeal(meal)}
                    className="text-muted-foreground hover:text-primary h-8 w-8"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteMeal(meal)}
                    className="text-muted-foreground hover:text-primary h-8 w-8"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {meal.notes && (
                <p className="text-sm text-muted-foreground italic bg-background/50 p-2 rounded-lg border border-border">
                  {meal.notes}
                </p>
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1 flex gap-3 font-mono text-xs font-medium tabular-nums">
                  <span className="text-chart-protein">P {Math.round(meal.protein || 0)}</span>
                  <span className="text-chart-carbs">C {Math.round(meal.carbs || 0)}</span>
                  <span className="text-chart-fat">F {Math.round(meal.fat || 0)}</span>
                  <span className="text-chart-fiber">Fib {Math.round(meal.fiber || 0)}</span>
                </div>
                <Button
                  onClick={() => handleQuickAdd(meal)}
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 flex-none"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Quick add
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filteredMeals.length === 0 && !showAddForm && (
          <div className="elevation-card p-8 text-center">
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? 'No saved meals found matching your search.'
                : 'No saved meals yet.'}
            </p>
            <Button
              onClick={() => setShowAddForm(true)}
              className="h-12 px-6 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Meal
            </Button>
          </div>
        )}

        <EditMealDialog
          meal={editingMeal}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSave={handleSaveMeal}
          isDailyMeal={false}
        />

        <MealTimeSelector
          open={isMealTimeSelectorOpen}
          onOpenChange={setIsMealTimeSelectorOpen}
          onSelect={handleMealTimeSelect}
          mealName={selectedMealForToday?.name || ''}
        />
      </div>
    </div>
  );
};

export default SavedMeals;
