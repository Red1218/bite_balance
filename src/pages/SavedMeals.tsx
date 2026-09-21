import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Plus, Search, Pencil, Trash2, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSavedMeals, SavedMeal } from '@/hooks/useSavedMeals';
import { useDailyMeals } from '@/hooks/useDailyMeals';
import { useToast } from '@/hooks/use-toast';
import { getMyCustomFoods, deleteCustomFood, deleteCustomFoods, IndianFood } from '@/services/foodService';
import EditMealDialog from '@/components/EditMealDialog';
import AddSavedMealForm from '@/components/AddSavedMealForm';
import AddFoodForm from '@/components/AddFoodForm';
import MealTimeSelector from '@/components/MealTimeSelector';

// Merge saved meals and custom foods into one chronological list -- both are
// "things I saved to reuse later", just with different shapes and actions.
type SavedItem =
  | { kind: 'meal'; created_at: string; meal: SavedMeal }
  | { kind: 'food'; created_at: string; food: IndianFood };

type TypeFilter = 'all' | 'meal' | 'food';

// Visual proportion of a segmented macro bar -- fiber is weighted at 2 kcal/g
// here purely so all four segments read clearly at a glance; it is not a
// real calorie count and is never shown as one.
const macroWidths = (p: number, c: number, f: number, fb: number) => {
  const energy = p * 4 + c * 4 + f * 9 + fb * 2;
  if (!energy) return { pw: '0%', cw: '0%', fw: '0%', bw: '0%' };
  const w = (v: number) => `${Math.round((v / energy) * 1000) / 10}%`;
  return { pw: w(p * 4), cw: w(c * 4), fw: w(f * 9), bw: w(fb * 2) };
};

const itemKey = (item: SavedItem) => (item.kind === 'meal' ? `meal-${item.meal.id}` : `food-${item.food.id}`);

const SelectBox = ({ checked }: { checked: boolean }) => (
  <span
    aria-hidden
    className={cn(
      'flex h-6 w-6 flex-none items-center justify-center rounded-full border transition-colors',
      checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'
    )}
  >
    <Check className="h-3.5 w-3.5" />
  </span>
);

const bucketLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = (now.getTime() - d.getTime()) / 86400000;
  if (diffDays < 7) return 'This week';
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  const sameMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (sameMonth) return `Earlier in ${month}`;
  return d.getFullYear() === now.getFullYear() ? month : `${month} ${d.getFullYear()}`;
};

const SavedMeals = () => {
  const {
    meals: savedMeals,
    loading,
    updateMeal,
    deleteMeal,
    deleteMeals,
    refetch,
  } = useSavedMeals();
  const { addMealFromSaved, addFoodFromSaved } = useDailyMeals();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [editingMeal, setEditingMeal] = useState<SavedMeal | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addKind, setAddKind] = useState<'meal' | 'food'>('meal');
  const [selectedItemForToday, setSelectedItemForToday] = useState<SavedItem | null>(null);
  const [isMealTimeSelectorOpen, setIsMealTimeSelectorOpen] = useState(false);

  const [customFoods, setCustomFoods] = useState<IndianFood[]>([]);
  const [foodsLoading, setFoodsLoading] = useState(true);

  // Multi-select: tap cards to tick them, then build one meal from the foods or delete the lot.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Foods carried from the selection into the "Save a new meal" form.
  const [seedFoodIds, setSeedFoodIds] = useState<string[] | undefined>();

  const fetchCustomFoods = () => {
    getMyCustomFoods()
      .then(setCustomFoods)
      .finally(() => setFoodsLoading(false));
  };

  useEffect(() => {
    fetchCustomFoods();
  }, []);

  const handleDeleteFood = async (food: IndianFood) => {
    if (window.confirm(`Are you sure you want to delete "${food.name}"?`)) {
      await deleteCustomFood(food.id);
      setCustomFoods((prev) => prev.filter((f) => f.id !== food.id));
    }
  };

  const savedItems: SavedItem[] = [
    ...savedMeals.map((meal): SavedItem => ({ kind: 'meal', created_at: meal.created_at, meal })),
    ...customFoods.map((food): SavedItem => ({ kind: 'food', created_at: food.created_at, food })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filteredItems = savedItems.filter((item) => {
    if (typeFilter !== 'all' && item.kind !== typeFilter) return false;
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    if (item.kind === 'meal') {
      return (
        item.meal.name.toLowerCase().includes(term) ||
        item.meal.tags?.some((tag) => tag.toLowerCase().includes(term))
      );
    }
    return item.food.name.toLowerCase().includes(term);
  });

  const groups = (() => {
    const map = new Map<string, SavedItem[]>();
    for (const item of filteredItems) {
      const label = bucketLabel(item.created_at);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(item);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  })();

  const handleQuickAdd = (item: SavedItem) => {
    setSelectedItemForToday(item);
    setIsMealTimeSelectorOpen(true);
  };

  const handleMealTimeSelect = async (mealTime: string) => {
    if (selectedItemForToday) {
      if (selectedItemForToday.kind === 'meal') {
        await addMealFromSaved(selectedItemForToday.meal, mealTime);
      } else {
        await addFoodFromSaved(selectedItemForToday.food, mealTime);
      }
    }
    setIsMealTimeSelectorOpen(false);
    setSelectedItemForToday(null);
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

  const closeAddForm = () => {
    setShowAddForm(false);
    setSeedFoodIds(undefined);
  };

  const handleMealAdded = () => {
    closeAddForm();
    refetch();
  };

  const handleFoodAdded = () => {
    closeAddForm();
    fetchCustomFoods();
  };

  const openBlankAddForm = () => {
    setSeedFoodIds(undefined);
    setShowAddForm(true);
  };

  const toggleSelected = (key: string) =>
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedKeys(new Set());
  };

  const selectedFoods = customFoods.filter((f) => selectedKeys.has(`food-${f.id}`));
  const selectedMealIds = savedMeals.filter((m) => selectedKeys.has(`meal-${m.id}`)).map((m) => m.id);
  // A new meal is built from foods only; a meal picked alongside them has no per-serving values to combine.
  const canCreateMeal = selectedFoods.length >= 2 && selectedMealIds.length === 0;

  const handleCreateMealFromSelection = () => {
    if (!canCreateMeal) return;
    setSeedFoodIds(selectedFoods.map((f) => f.id));
    setAddKind('meal');
    setShowAddForm(true);
    exitSelectMode();
    // The form renders above the list.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBulkDelete = async () => {
    const count = selectedKeys.size;
    if (count === 0) return;
    if (!window.confirm(`Delete ${count} saved item${count === 1 ? '' : 's'}? This can't be undone.`)) return;

    setBulkDeleting(true);
    try {
      const foodIds = selectedFoods.map((f) => f.id);
      const [mealsOk] = await Promise.all([
        selectedMealIds.length > 0 ? deleteMeals(selectedMealIds) : Promise.resolve(true),
        foodIds.length > 0
          ? deleteCustomFoods(foodIds).then(() => setCustomFoods((prev) => prev.filter((f) => !foodIds.includes(f.id))))
          : Promise.resolve(),
      ]);
      if (mealsOk) {
        toast({ title: 'Deleted', description: `${count} item${count === 1 ? '' : 's'} removed` });
        exitSelectMode();
      }
    } catch (error) {
      console.error('Error deleting selected items:', error);
      toast({ title: 'Error', description: 'Some items could not be deleted', variant: 'destructive' });
      fetchCustomFoods();
    } finally {
      setBulkDeleting(false);
    }
  };

  const typeFilters: { value: TypeFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: savedItems.length },
    { value: 'meal', label: 'Meals', count: savedMeals.length },
    { value: 'food', label: 'Foods', count: customFoods.length },
  ];

  if (loading || foodsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 bg-primary rounded-full animate-pulse mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading saved items...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl bg-card border border-border text-muted-foreground hover:bg-accent"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="flex-1 text-xl font-display font-semibold text-foreground">Saved</h1>
          <div className="flex items-baseline gap-1.5 rounded-full border border-border bg-card px-3 py-1.5">
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {savedItems.length}
            </span>
            <span className="text-[10px] text-muted-foreground">items saved</span>
          </div>
          <Button
            onClick={openBlankAddForm}
            size="icon"
            className="rounded-xl h-10 w-10 flex-none"
            disabled={showAddForm || selectMode}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search meals and foods..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-xl h-11 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
          />
        </div>

        {/* Type filter chips */}
        <div className="flex gap-1.5">
          {typeFilters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTypeFilter(f.value)}
              className={cn(
                'h-8 rounded-full px-3 flex items-center gap-1.5 text-xs font-medium border transition-colors',
                typeFilter === f.value
                  ? 'bg-primary/12 border-primary/40 text-primary'
                  : 'bg-card border-border text-muted-foreground'
              )}
            >
              {f.label}
              <span className="font-mono text-[11px] opacity-70 tabular-nums">{f.count}</span>
            </button>
          ))}
          {savedItems.length > 0 && (
            <button
              type="button"
              onClick={selectMode ? exitSelectMode : () => setSelectMode(true)}
              className={cn(
                'ml-auto h-8 rounded-full px-3 text-xs font-medium border transition-colors',
                selectMode
                  ? 'bg-primary/12 border-primary/40 text-primary'
                  : 'bg-card border-border text-muted-foreground'
              )}
            >
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          )}
        </div>

        {/* Add New Meal / Food */}
        {showAddForm && (
          <div className="space-y-2.5">
            <div className="flex gap-1.5">
              {(['meal', 'food'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setAddKind(kind)}
                  className={cn(
                    'h-8 flex-1 rounded-full text-xs font-medium border transition-colors',
                    addKind === kind
                      ? 'bg-primary/12 border-primary/40 text-primary'
                      : 'bg-card border-border text-muted-foreground'
                  )}
                >
                  {kind === 'meal' ? 'Add a meal' : 'Add a food'}
                </button>
              ))}
            </div>
            {addKind === 'meal' ? (
              <AddSavedMealForm
                key={seedFoodIds?.join(',') ?? 'blank'}
                onMealAdded={handleMealAdded}
                onCancel={closeAddForm}
                initialFoodIds={seedFoodIds}
                foods={customFoods}
              />
            ) : (
              <AddFoodForm
                onFoodAdded={handleFoodAdded}
                onCancel={closeAddForm}
              />
            )}
          </div>
        )}

        {/* Saved Meals + Foods, grouped by recency */}
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label} className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="font-mono text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70 whitespace-nowrap">
                  {group.label}
                </div>
                <div className="flex-1 h-px bg-border" />
                <div className="font-mono text-[10px] text-muted-foreground/70 tabular-nums">
                  {group.items.length}
                </div>
              </div>

              <div className="space-y-3">
                {group.items.map((item) =>
                  item.kind === 'meal' ? (
                    <div
                      key={`meal-${item.meal.id}`}
                      onClick={selectMode ? () => toggleSelected(itemKey(item)) : undefined}
                      aria-pressed={selectMode ? selectedKeys.has(itemKey(item)) : undefined}
                      className={cn(
                        'elevation-card border-l-[3px] border-l-primary p-3.5 flex flex-col gap-2.5',
                        selectMode && 'cursor-pointer',
                        selectMode && selectedKeys.has(itemKey(item)) && 'ring-2 ring-primary/50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex items-start gap-2.5">
                          {selectMode && <SelectBox checked={selectedKeys.has(itemKey(item))} />}
                          <div className="min-w-0 flex flex-col gap-1">
                            <div className="font-display font-semibold text-base leading-tight text-foreground truncate">
                              {item.meal.name}
                            </div>
                            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                              Saved meal
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-none">
                          <div className="font-mono font-semibold text-lg tabular-nums text-foreground">
                            {Math.round(item.meal.calories)}
                          </div>
                          <div className="text-[9px] tracking-wider text-muted-foreground uppercase">kcal</div>
                        </div>
                      </div>

                      {item.meal.tags && item.meal.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {item.meal.tags.map((tag, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-[10px] bg-muted text-muted-foreground border-border font-normal"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {(() => {
                        const { pw, cw, fw, bw } = macroWidths(
                          item.meal.protein || 0,
                          item.meal.carbs || 0,
                          item.meal.fat || 0,
                          item.meal.fiber || 0
                        );
                        return (
                          <div className="flex flex-col gap-1.5">
                            <div className="h-1.5 rounded-full overflow-hidden flex gap-px bg-muted">
                              <div style={{ width: pw }} className="bg-chart-protein" />
                              <div style={{ width: cw }} className="bg-chart-carbs" />
                              <div style={{ width: fw }} className="bg-chart-fat" />
                              <div style={{ width: bw }} className="bg-chart-fiber" />
                            </div>
                            <div className="flex gap-3 font-mono text-[10px] font-medium tabular-nums">
                              <span className="flex items-center gap-1 text-chart-protein">
                                <span className="w-1.5 h-1.5 rounded-full bg-chart-protein" />
                                P {Math.round(item.meal.protein || 0)}
                              </span>
                              <span className="flex items-center gap-1 text-chart-carbs">
                                <span className="w-1.5 h-1.5 rounded-full bg-chart-carbs" />
                                C {Math.round(item.meal.carbs || 0)}
                              </span>
                              <span className="flex items-center gap-1 text-chart-fat">
                                <span className="w-1.5 h-1.5 rounded-full bg-chart-fat" />
                                F {Math.round(item.meal.fat || 0)}
                              </span>
                              <span className="flex items-center gap-1 text-chart-fiber">
                                <span className="w-1.5 h-1.5 rounded-full bg-chart-fiber" />
                                Fib {Math.round(item.meal.fiber || 0)}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {item.meal.notes && (
                        <div className="border-l-2 border-border pl-2.5">
                          <p className="text-xs text-muted-foreground italic leading-relaxed">
                            {item.meal.notes}
                          </p>
                        </div>
                      )}

                      {!selectMode && (
                      <div className="flex gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(item)}
                          className="flex-1 h-10 rounded-[11px] bg-primary/10 border border-primary/30 text-primary flex items-center justify-center gap-1.5 font-semibold text-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Quick add
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditMeal(item.meal)}
                          className="w-10 h-10 rounded-[11px] border border-border text-muted-foreground flex items-center justify-center flex-none"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMeal(item.meal)}
                          className="w-10 h-10 rounded-[11px] border border-border text-muted-foreground flex items-center justify-center flex-none"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      )}
                    </div>
                  ) : (
                    <div
                      key={`food-${item.food.id}`}
                      onClick={selectMode ? () => toggleSelected(itemKey(item)) : undefined}
                      aria-pressed={selectMode ? selectedKeys.has(itemKey(item)) : undefined}
                      className={cn(
                        'rounded-xl bg-muted/60 border border-border p-2.5 flex items-center gap-2.5',
                        selectMode && 'cursor-pointer',
                        selectMode && selectedKeys.has(itemKey(item)) && 'border-primary/50 ring-2 ring-primary/40'
                      )}
                    >
                      {selectMode && <SelectBox checked={selectedKeys.has(itemKey(item))} />}
                      <div className="w-[38px] h-[38px] rounded-[10px] bg-card border border-border flex flex-col items-center justify-center flex-none">
                        <div className="font-mono text-[11px] font-semibold text-foreground/80 tabular-nums">
                          {item.food.serving_size}
                        </div>
                        <div className="font-mono text-[8px] tracking-wide text-muted-foreground">
                          {item.food.serving_unit}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="text-sm font-medium text-foreground truncate">{item.food.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          P {Math.round(item.food.protein || 0)}g · C {Math.round(item.food.carbs || 0)}g · F{' '}
                          {Math.round(item.food.fat || 0)}g · Fb {Math.round(item.food.fiber || 0)}g
                        </div>
                      </div>
                      <div className="text-right flex-none pr-0.5">
                        <div className="font-mono font-medium text-sm tabular-nums text-foreground/80">
                          {Math.round(item.food.calories)}
                        </div>
                        <div className="text-[8px] tracking-wider text-muted-foreground uppercase">kcal</div>
                      </div>
                      {!selectMode && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleQuickAdd(item)}
                            aria-label={`Add ${item.food.name} to today`}
                            className="w-10 h-10 rounded-full border border-primary/30 bg-primary/10 text-primary flex items-center justify-center flex-none"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFood(item.food)}
                            aria-label={`Delete ${item.food.name}`}
                            className="w-8 h-8 rounded-full text-muted-foreground flex items-center justify-center flex-none"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && !showAddForm && (
          <div className="elevation-card p-8 text-center">
            <p className="text-muted-foreground mb-4">
              {searchTerm || typeFilter !== 'all'
                ? 'Nothing saved matches your search.'
                : 'Nothing saved yet.'}
            </p>
            <Button
              onClick={openBlankAddForm}
              className="h-12 px-6 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Meal
            </Button>
          </div>
        )}

        {selectMode && (
          <>
            {/* Spacer so the last card can scroll clear of the docked action bar */}
            <div className="h-20" />
            <div
              className="elevation-glass fixed left-1/2 z-40 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center gap-2 p-3"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">{selectedKeys.size} selected</div>
                <div className="text-[10px] leading-tight text-muted-foreground">
                  {selectedMealIds.length > 0 && selectedFoods.length > 0
                    ? 'Pick foods only to build a meal'
                    : selectedFoods.length < 2
                    ? 'Pick 2+ foods to build a meal'
                    : 'Combine into one saved meal'}
                </div>
              </div>
              <Button
                type="button"
                onClick={handleCreateMealFromSelection}
                disabled={!canCreateMeal || bulkDeleting}
                className="h-10 rounded-xl px-3.5 text-xs font-semibold"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Create meal
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={selectedKeys.size === 0 || bulkDeleting}
                className="h-10 rounded-xl px-3.5 text-xs font-semibold"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {bulkDeleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </>
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
          mealName={
            selectedItemForToday?.kind === 'meal'
              ? selectedItemForToday.meal.name
              : selectedItemForToday?.kind === 'food'
              ? selectedItemForToday.food.name
              : ''
          }
          kcal={
            selectedItemForToday?.kind === 'meal'
              ? selectedItemForToday.meal.calories
              : selectedItemForToday?.kind === 'food'
              ? selectedItemForToday.food.calories
              : undefined
          }
        />
      </div>
    </div>
  );
};

export default SavedMeals;
