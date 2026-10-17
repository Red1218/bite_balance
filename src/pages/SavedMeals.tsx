import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Search, Trash2, Check, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSavedMeals, SavedMeal } from '@/hooks/useSavedMeals';
import { useDailyMeals } from '@/hooks/useDailyMeals';
import { useLogCounts } from '@/hooks/useLogCounts';
import { useToast } from '@/hooks/use-toast';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import { getMyCustomFoods, deleteCustomFood, deleteCustomFoods, IndianFood } from '@/services/foodService';
import { defaultSlotForNow } from '@/lib/mealTime';
import { MEAL_LABEL } from '@/components/MealReviewList';
import EditMealDialog from '@/components/EditMealDialog';
import AddSavedMealForm from '@/components/AddSavedMealForm';
import AddFoodForm from '@/components/AddFoodForm';
import MenuButton from '@/components/MenuButton';
import MacroRing from '@/components/MacroRing';
import Segmented from '@/components/Segmented';
import { showLoggedToast } from '@/components/LoggedToast';

// Saved meals and custom foods together: both are "things I saved to reuse later",
// just with different shapes and actions.
type SavedItem =
  | { kind: 'meal'; created_at: string; meal: SavedMeal }
  | { kind: 'food'; created_at: string; food: IndianFood };

type TypeFilter = 'all' | 'meal' | 'food';

const itemKey = (item: SavedItem) => (item.kind === 'meal' ? `meal-${item.meal.id}` : `food-${item.food.id}`);
const itemOf = (item: SavedItem) => (item.kind === 'meal' ? item.meal : item.food);
const detailPath = (item: SavedItem) => `/saved-meals/${item.kind}/${itemOf(item).id}`;
const round = (n: number | null | undefined) => Math.round(n || 0);

const GO_TOS = 5;

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

// The "Add to lunch" button: turns into a green "Added" check for a beat, with "+kcal" rising off it.
const AddButton = ({ added, kcal, slot, wide, onAdd, name }: { added: boolean; kcal: number; slot: string; wide?: boolean; onAdd: () => void; name: string }) => (
  <span className={cn('relative', wide && 'flex-1')}>
    <button
      type="button"
      onClick={onAdd}
      aria-label={`Add ${name} to ${slot}`}
      className={cn(
        'flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-bold transition-colors duration-200 active:scale-95',
        wide ? 'w-full px-4' : 'w-11 flex-none',
        added ? 'bg-chart-fiber text-background' : 'bg-muted text-chart-protein'
      )}
    >
      {added ? (
        <span className="motion-pop flex items-center gap-1.5">
          <Check className="motion-draw h-4 w-4" strokeWidth={3} />
          {wide && 'Added'}
        </span>
      ) : (
        <>
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          {wide && `Add to ${slot}`}
        </>
      )}
    </button>
    {added && (
      <span aria-hidden className="motion-float pointer-events-none absolute -top-2 right-1 text-sm font-bold text-chart-fiber">
        +{kcal}
      </span>
    )}
  </span>
);

const SavedMeals = () => {
  const { meals: savedMeals, loading, updateMeal, deleteMeal, deleteMeals, refetch } = useSavedMeals();
  const { addMealFromSaved, addFoodFromSaved } = useDailyMeals();
  const { notifyMealsLogged } = useAddMealSheet();
  const timesLogged = useLogCounts();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [editingMeal, setEditingMeal] = useState<SavedMeal | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addKind, setAddKind] = useState<'meal' | 'food'>('meal');
  const [editingFood, setEditingFood] = useState<IndianFood | null>(null);
  // The row whose Add button just turned green, and the row whose ⋯ menu is open.
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const addedTimer = useRef<number>();
  const slot = defaultSlotForNow();
  const slotLabel = MEAL_LABEL[slot].toLowerCase();

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

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  // A food's detail screen sends "Edit" back here, where the food form lives.
  const location = useLocation();
  const navigate = useNavigate();
  const editFoodId = (location.state as { editFoodId?: string } | null)?.editFoodId;
  useEffect(() => {
    if (!editFoodId || foodsLoading) return;
    const food = customFoods.find((f) => f.id === editFoodId);
    if (food) setEditingFood(food);
    navigate('.', { replace: true, state: null });
  }, [editFoodId, foodsLoading, customFoods, navigate]);


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

  const term = searchTerm.trim().toLowerCase();
  const matches = (item: SavedItem) => {
    if (!term) return true;
    if (item.kind === 'meal') {
      return item.meal.name.toLowerCase().includes(term) || item.meal.tags?.some((tag) => tag.toLowerCase().includes(term));
    }
    return item.food.name.toLowerCase().includes(term);
  };
  const shownMeals = typeFilter === 'food' ? [] : savedItems.filter((i) => i.kind === 'meal' && matches(i));
  const shownFoods = typeFilter === 'meal' ? [] : savedItems.filter((i) => i.kind === 'food' && matches(i));
  const goTos =
    typeFilter === 'all' && !term && !selectMode
      ? savedItems
          .map((item) => ({ item, n: timesLogged(itemOf(item).name) }))
          .filter((g) => g.n > 0)
          .sort((a, b) => b.n - a.n)
          .slice(0, GO_TOS)
      : [];

  // Adds straight to the meal of the hour; the detail screen is there for another meal or portion.
  const handleAdd = async (item: SavedItem) => {
    setMenuFor(null);
    const id = item.kind === 'meal' ? await addMealFromSaved(item.meal, slot) : await addFoodFromSaved(item.food, slot);
    if (!id) return;
    notifyMealsLogged();
    const key = itemKey(item);
    setJustAdded(key);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setJustAdded((k) => (k === key ? null : k)), 1400);
    showLoggedToast(`${itemOf(item).name}, ${Math.round(itemOf(item).calories).toLocaleString()} kcal to ${slotLabel}`, [id], notifyMealsLogged);
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
    setEditingFood(null);
    setShowAddForm(true);
  };

  const handleEditFood = (food: IndianFood) => {
    closeAddForm();
    setEditingFood(food);
    // The form renders above the list.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFoodEdited = () => {
    setEditingFood(null);
    fetchCustomFoods();
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

  const typeFilters = [
    ['all', `All ${savedItems.length}`],
    ['meal', `Meals ${savedMeals.length}`],
    ['food', `Foods ${customFoods.length}`],
  ] as const;

  // The ⋯ menu shared by meal cards and food rows.
  const ItemMenu = ({ item }: { item: SavedItem }) => {
    const key = itemKey(item);
    const open = menuFor === key;
    return (
      <span className="relative flex-none">
        {/* A tap anywhere else only closes the menu; it doesn't also open what's underneath. */}
        {open && <span aria-hidden className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />}
        <button
          type="button"
          onClick={() => setMenuFor(open ? null : key)}
          aria-label={`More for ${itemOf(item).name}`}
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground active:scale-95"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
        {open && (
          <span role="menu" className="motion-menu absolute bottom-12 right-0 z-20 flex min-w-[160px] flex-col rounded-2xl border border-border bg-muted p-1.5 shadow-[0_18px_40px_-16px_rgba(0,0,0,.6)]">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuFor(null);
                if (item.kind === 'meal') setEditingMeal(item.meal);
                else handleEditFood(item.food);
              }}
              className="h-11 rounded-xl px-3.5 text-left text-[15px] font-semibold text-foreground"
            >
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuFor(null);
                if (item.kind === 'meal') handleDeleteMeal(item.meal);
                else handleDeleteFood(item.food);
              }}
              className="h-11 rounded-xl px-3.5 text-left text-[15px] font-semibold text-[#FF7A70]"
            >
              Delete
            </button>
          </span>
        )}
      </span>
    );
  };

  if (loading || foodsLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-12 w-40 animate-pulse rounded-full bg-muted" />
        <div className="h-[52px] animate-pulse rounded-full bg-card" />
        <div className="h-[220px] animate-pulse rounded-[26px] bg-card" />
        <div className="h-[160px] animate-pulse rounded-[26px] bg-card" />
      </div>
    );
  }

  const empty = shownMeals.length === 0 && shownFoods.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <MenuButton />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-foreground">Saved</h1>
          <span className="text-[13px] text-muted-foreground">{savedItems.length} saved</span>
        </div>
        {savedItems.length > 0 && (
          <button
            type="button"
            onClick={selectMode ? exitSelectMode : () => setSelectMode(true)}
            className="h-11 rounded-full px-3 text-sm font-semibold text-muted-foreground"
          >
            {selectMode ? 'Cancel' : 'Select'}
          </button>
        )}
        <button
          type="button"
          onClick={openBlankAddForm}
          disabled={showAddForm || selectMode}
          className="flex h-11 flex-none items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground transition-transform active:scale-95 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          New
        </button>
      </div>

      {/* Search and filter */}
      <label className="flex h-[52px] items-center gap-2.5 rounded-full bg-card px-[18px] text-muted-foreground">
        <Search className="h-5 w-5 flex-none" />
        <span className="sr-only">Search saved meals and foods</span>
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search meals and foods"
          className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-faint focus:outline-none"
        />
      </label>
      <Segmented label="Show" options={typeFilters} value={typeFilter} onChange={setTypeFilter} className="h-12" />

      {/* Add New Meal / Food */}
      {editingFood && (
        <AddFoodForm key={editingFood.id} food={editingFood} onFoodAdded={handleFoodEdited} onCancel={() => setEditingFood(null)} />
      )}

      {showAddForm && (
        <div className="space-y-2.5">
          <Segmented
            label="What to save"
            options={[
              ['meal', 'A meal'],
              ['food', 'A food'],
            ]}
            value={addKind}
            onChange={setAddKind}
          />
          {addKind === 'meal' ? (
            <AddSavedMealForm
              key={seedFoodIds?.join(',') ?? 'blank'}
              onMealAdded={handleMealAdded}
              onCancel={closeAddForm}
              initialFoodIds={seedFoodIds}
              foods={customFoods}
            />
          ) : (
            <AddFoodForm onFoodAdded={handleFoodAdded} onCancel={closeAddForm} />
          )}
        </div>
      )}

      {/* Go-tos: the most logged, as big plates to scroll through */}
      {goTos.length > 0 && (
        <section className="motion-rise flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[19px] font-bold text-foreground">Your go-tos</h2>
            <span className="text-xs text-faint">Most logged</span>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {goTos.map(({ item, n }) => {
              const it = itemOf(item);
              return (
                <div key={itemKey(item)} className="flex w-[168px] flex-none snap-start flex-col gap-3 rounded-[26px] bg-card p-3.5 pt-4">
                  <Link to={detailPath(item)} className="flex flex-col gap-3">
                    <span className="self-center">
                      <MacroRing protein={it.protein || 0} carbs={it.carbs || 0} fat={it.fat || 0} size={96} stroke={9}>
                        <span className="font-display text-[22px] font-bold leading-none text-foreground">{Math.round(it.calories)}</span>
                        <span className="text-[11px] text-faint">kcal</span>
                      </MacroRing>
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="line-clamp-2 min-h-[38px] text-[15px] font-bold leading-tight text-foreground">{it.name}</span>
                      <span className="text-xs text-faint">
                        Logged {n} time{n === 1 ? '' : 's'}
                      </span>
                    </span>
                  </Link>
                  <AddButton wide added={justAdded === itemKey(item)} kcal={Math.round(it.calories)} slot={slotLabel} name={it.name} onAdd={() => handleAdd(item)} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Meals: one roomy card each */}
      {shownMeals.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[19px] font-bold text-foreground">Meals</h2>
            <span className="text-xs text-faint">{shownMeals.length}</span>
          </div>
          {shownMeals.map((item) => {
            if (item.kind !== 'meal') return null;
            const m = item.meal;
            const key = itemKey(item);
            const picked = selectedKeys.has(key);
            const subtitle = m.tags?.length ? m.tags.join(', ') : m.notes || 'Saved meal';
            const head = (
              <>
                <MacroRing protein={m.protein || 0} carbs={m.carbs || 0} fat={m.fat || 0} size={56} stroke={6}>
                  <span className="font-display text-lg font-bold text-foreground">{(m.name.trim()[0] ?? '·').toUpperCase()}</span>
                </MacroRing>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-base font-bold text-foreground">{m.name}</span>
                  <span className="truncate text-[13px] text-muted-foreground">{subtitle}</span>
                </span>
              </>
            );
            return (
              <div
                key={key}
                onClick={selectMode ? () => toggleSelected(key) : undefined}
                aria-pressed={selectMode ? picked : undefined}
                className={cn('relative flex flex-col gap-3.5 rounded-[26px] bg-card p-4', selectMode && 'cursor-pointer', picked && 'ring-2 ring-primary/60')}
              >
                <div className="flex items-center gap-3.5">
                  {selectMode && <SelectBox checked={picked} />}
                  {selectMode ? (
                    <span className="flex min-w-0 flex-1 items-center gap-3.5">{head}</span>
                  ) : (
                    <Link to={detailPath(item)} className="flex min-w-0 flex-1 items-center gap-3.5">
                      {head}
                    </Link>
                  )}
                  <span className="flex flex-none flex-col items-end">
                    <span className="font-display text-2xl font-bold leading-none text-foreground">{Math.round(m.calories)}</span>
                    <span className="text-[11px] text-faint">kcal</span>
                  </span>
                </div>
                <div className="flex gap-3.5 text-[13px]">
                  {(
                    [
                      ['protein', 'bg-chart-protein', m.protein],
                      ['carbs', 'bg-chart-carbs', m.carbs],
                      ['fat', 'bg-chart-fat', m.fat],
                    ] as const
                  ).map(([label, dot, v]) => (
                    <span key={label} className="inline-flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', dot)} />
                      <span className="font-bold text-foreground">{round(v)}g</span>
                      <span className="text-faint">{label}</span>
                    </span>
                  ))}
                </div>
                {!selectMode && (
                  <div className="flex items-center gap-2">
                    <AddButton wide added={justAdded === key} kcal={Math.round(m.calories)} slot={slotLabel} name={m.name} onAdd={() => handleAdd(item)} />
                    <ItemMenu item={item} />
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Foods: a tidy list, one serving per row */}
      {shownFoods.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[19px] font-bold text-foreground">Foods</h2>
            <span className="text-xs text-faint">per serving</span>
          </div>
          <div className="overflow-hidden rounded-[24px] bg-card">
            {shownFoods.map((item, i) => {
              if (item.kind !== 'food') return null;
              const f = item.food;
              const key = itemKey(item);
              const picked = selectedKeys.has(key);
              const body = (
                <>
                  <span className="flex h-12 w-[52px] flex-none flex-col items-center justify-center rounded-[14px] bg-muted">
                    <span className="font-display text-base font-bold leading-tight text-foreground">{f.serving_size}</span>
                    <span className="text-[11px] leading-tight text-faint">{f.serving_unit}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold text-foreground">{f.name}</span>
                    <span className="whitespace-pre text-xs text-faint">
                      P {round(f.protein)}{'  '}C {round(f.carbs)}{'  '}F {round(f.fat)}
                    </span>
                  </span>
                  <span className="font-display text-[17px] font-bold text-foreground">{Math.round(f.calories)}</span>
                </>
              );
              return (
                <div
                  key={key}
                  onClick={selectMode ? () => toggleSelected(key) : undefined}
                  aria-pressed={selectMode ? picked : undefined}
                  className={cn('flex min-h-[68px] items-center gap-3 px-3 py-2.5', i > 0 && 'border-t border-border', selectMode && 'cursor-pointer', picked && 'bg-primary/10')}
                >
                  {selectMode && <SelectBox checked={picked} />}
                  {selectMode ? (
                    <span className="flex min-w-0 flex-1 items-center gap-3">{body}</span>
                  ) : (
                    <Link to={detailPath(item)} className="flex min-w-0 flex-1 items-center gap-3">
                      {body}
                    </Link>
                  )}
                  {!selectMode && (
                    <AddButton added={justAdded === key} kcal={Math.round(f.calories)} slot={slotLabel} name={f.name} onAdd={() => handleAdd(item)} />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {empty && !showAddForm && (
        <div className="flex flex-col items-start gap-2.5 rounded-[26px] border-[1.5px] border-dashed border-border p-6">
          <span className="font-display text-[19px] font-bold text-foreground">
            {term ? `Nothing matches “${searchTerm.trim()}”` : 'Nothing saved yet'}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {term ? 'Try another word, or save it as a new food.' : 'Save a meal or food you eat often to add it in one tap.'}
          </span>
          {term ? (
            <button type="button" onClick={() => setSearchTerm('')} className="h-11 rounded-full bg-muted px-4 text-sm font-bold text-foreground">
              Clear search
            </button>
          ) : (
            <Button onClick={openBlankAddForm} className="h-11 rounded-full px-4">
              <Plus className="mr-1.5 h-4 w-4" />
              Save your first meal
            </Button>
          )}
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
              <div className="text-[12px] leading-tight text-muted-foreground">
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
        open={!!editingMeal}
        onOpenChange={(open) => !open && setEditingMeal(null)}
        onSave={handleSaveMeal}
        isDailyMeal={false}
      />
    </div>
  );
};

export default SavedMeals;
