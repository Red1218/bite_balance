import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Search, Edit, Trash2 } from 'lucide-react';
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
        <div className="flex items-center gap-4 mb-2">
          <Link to="/">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-accent"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-medium text-foreground">Saved Meals</h1>
          <div className="ml-auto">
            <Button
              onClick={() => setShowAddForm(true)}
              className="primary-button h-10 px-4"
              disabled={showAddForm}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="glass-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search saved meals or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm"
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
            <div key={meal.id} className="glass-card p-4">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-medium text-foreground leading-tight truncate pr-2 flex-1">
                  {meal.name}
                </h3>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditMeal(meal)}
                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 h-8 w-8 p-0"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteMeal(meal)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {meal.tags?.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="text-xs bg-background/50 text-muted-foreground border-border"
                  >
                    🏷️ {tag}
                  </Badge>
                ))}
              </div>

              <div className="text-center mb-4">
                <div className="text-2xl font-bold text-primary">
                  {meal.calories}
                </div>
                <p className="text-sm text-muted-foreground">calories</p>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-sm mb-4">
                <div>
                  <div className="font-semibold text-red-400">
                    {Math.round(meal.protein || 0)}g
                  </div>
                  <div className="text-muted-foreground text-xs">Protein</div>
                </div>
                <div>
                  <div className="font-semibold text-blue-400">
                    {Math.round(meal.carbs || 0)}g
                  </div>
                  <div className="text-muted-foreground text-xs">Carbs</div>
                </div>
                <div>
                  <div className="font-semibold text-yellow-400">
                    {Math.round(meal.fat || 0)}g
                  </div>
                  <div className="text-muted-foreground text-xs">Fat</div>
                </div>
                <div>
                  <div className="font-semibold text-green-400">
                    {Math.round(meal.fiber || 0)}g
                  </div>
                  <div className="text-muted-foreground text-xs">Fiber</div>
                </div>
              </div>

              {meal.notes && (
                <p className="text-sm text-muted-foreground italic bg-background/50 p-2 rounded border border-border mb-4">
                  📝 {meal.notes}
                </p>
              )}

              <Button
                onClick={() => handleQuickAdd(meal)}
                className="w-full primary-button h-12"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add to Today
              </Button>
            </div>
          ))}
        </div>

        {filteredMeals.length === 0 && !showAddForm && (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? 'No saved meals found matching your search.'
                : 'No saved meals yet.'}
            </p>
            <Button
              onClick={() => setShowAddForm(true)}
              className="primary-button h-12 px-6"
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
