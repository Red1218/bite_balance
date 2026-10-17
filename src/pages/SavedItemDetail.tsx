import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import { useSavedMeals, type SavedMeal } from '@/hooks/useSavedMeals';
import { useDailyMeals } from '@/hooks/useDailyMeals';
import { useLogCounts } from '@/hooks/useLogCounts';
import { useCountUp } from '@/hooks/useCountUp';
import { deleteCustomFood, getMyCustomFoods, type IndianFood } from '@/services/foodService';
import { defaultSlotForNow } from '@/lib/mealTime';
import { MEAL_LABEL, MEAL_ORDER, type MealTime } from '@/components/MealReviewList';
import MacroRing from '@/components/MacroRing';
import Segmented from '@/components/Segmented';
import EditMealDialog from '@/components/EditMealDialog';
import { showLoggedToast } from '@/components/LoggedToast';

const SERVINGS = [
  ['0.5', '½'],
  ['1', '1'],
  ['1.5', '1½'],
  ['2', '2'],
] as const;
type Serving = (typeof SERVINGS)[number][0];

// Every per-serving number on a saved row that a portion should scale.
const NUTRIENTS = [
  'calories', 'protein', 'carbs', 'fat', 'fiber', 'vitamin_c', 'vitamin_d', 'vitamin_b12',
  'iron', 'calcium', 'potassium', 'sodium', 'magnesium', 'zinc',
] as const;
const scaled = <T extends Record<string, unknown>>(row: T, factor: number): T => {
  const out: Record<string, unknown> = { ...row };
  for (const k of NUTRIENTS) if (typeof row[k] === 'number') out[k] = (row[k] as number) * factor;
  return out as T;
};

const fraction = (n: number) => (n === 0.5 ? '½' : n === 1.5 ? '1½' : String(n));

// One saved meal or food: what a portion costs against what's left today, and adding it.
const SavedItemDetail = () => {
  const { kind, id } = useParams<{ kind: 'meal' | 'food'; id: string }>();
  const { user } = useAuth();
  const { notifyMealsLogged } = useAddMealSheet();
  const navigate = useNavigate();
  const { meals, loading: mealsLoading, updateMeal, deleteMeal } = useSavedMeals();
  const { totals, addMealFromSaved, addFoodFromSaved, refetch } = useDailyMeals();
  const timesLogged = useLogCounts();
  const [foods, setFoods] = useState<IndianFood[] | null>(kind === 'food' ? null : []);
  const [serving, setServing] = useState<Serving>('1');
  const [slot, setSlot] = useState<MealTime>(defaultSlotForNow);
  const [added, setAdded] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [editing, setEditing] = useState<SavedMeal | null>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (kind === 'food') getMyCustomFoods().then(setFoods);
  }, [kind]);

  // Two frames, so the empty ring paints before it fills.
  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setDrawn(true));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const meal = kind === 'meal' ? meals.find((m) => m.id === id) : undefined;
  const food = kind === 'food' ? foods?.find((f) => f.id === id) : undefined;
  const item = meal ?? food;
  const factor = Number(serving);
  const kcal = Math.round((item?.calories ?? 0) * factor);
  const shownKcal = useCountUp(drawn ? kcal : 0, 700);

  const goal = Number(user?.user_metadata?.calorie_goal || 2200);
  const left = Math.max(0, goal - totals.calories);
  const share = left > 0 ? kcal / left : 1;

  if (!item) {
    const stillLoading = kind === 'meal' ? mealsLoading : foods === null;
    return (
      <div className="flex flex-col gap-4">
        <Link to="/saved-meals" aria-label="Back to Saved" className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        {stillLoading ? (
          <div className="h-[360px] animate-pulse rounded-[30px] bg-card" />
        ) : (
          <p className="text-muted-foreground">This saved item isn’t there any more. It may have been deleted.</p>
        )}
      </div>
    );
  }

  const n = timesLogged(item.name);
  const servingNote = food ? `${fraction(factor * food.serving_size)} ${food.serving_unit}` : factor === 1 ? '1 serving' : `${fraction(factor)} servings`;

  const handleAdd = async () => {
    if (added) return;
    const newId = meal ? await addMealFromSaved(scaled(meal, factor), slot) : await addFoodFromSaved({ ...scaled(food!, factor), serving_size: food!.serving_size * factor }, slot);
    if (!newId) return;
    notifyMealsLogged();
    setAdded(true);
    setPulse((p) => p + 1);
    showLoggedToast(`${item.name}, ${kcal.toLocaleString()} kcal to ${MEAL_LABEL[slot].toLowerCase()}`, [newId], () => {
      notifyMealsLogged();
      refetch();
      setAdded(false);
    });
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${item.name}" from Saved?`)) return;
    if (meal) await deleteMeal(meal.id);
    else await deleteCustomFood(food!.id);
    navigate('/saved-meals', { replace: true });
  };

  return (
    <div className="flex flex-col gap-[18px] pb-24">
      <div className="flex items-center justify-between">
        <Link to="/saved-meals" aria-label="Back to Saved" className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground active:scale-95">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="text-sm text-muted-foreground">{meal ? 'Saved meal' : 'Saved food'}</span>
        <button
          type="button"
          onClick={() => (meal ? setEditing(meal) : navigate('/saved-meals', { state: { editFoodId: food!.id } }))}
          aria-label={meal ? 'Edit meal' : 'Edit food'}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground active:scale-95"
        >
          <Pencil className="h-[18px] w-[18px]" />
        </button>
      </div>

      <section className="motion-rise flex flex-col items-center gap-3.5 rounded-[30px] bg-card px-[18px] pb-5 pt-[22px]">
        <span key={pulse} className={cn('rounded-full', pulse > 0 && 'motion-celebrate')}>
          <MacroRing protein={item.protein || 0} carbs={item.carbs || 0} fat={item.fat || 0} size={200} stroke={16} fill={drawn ? share : 0} animate>
            <span className="font-display text-[50px] font-bold leading-none tracking-[-0.03em] text-foreground">{shownKcal.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">kcal</span>
          </MacroRing>
        </span>
        <span className="text-center text-sm text-muted-foreground">
          {left === 0 || share >= 1
            ? 'More than you have left today'
            : `Uses ${Math.round(share * 100)}% of the ${left.toLocaleString()} kcal you have left today`}
        </span>
        <div className="grid w-full grid-cols-4 gap-2.5">
          {(
            [
              ['Protein', item.protein, 'bg-chart-protein'],
              ['Carbs', item.carbs, 'bg-chart-carbs'],
              ['Fat', item.fat, 'bg-chart-fat'],
              ['Fiber', item.fiber, 'bg-chart-fiber'],
            ] as const
          ).map(([label, v, dot]) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <span className={cn('h-2.5 w-2.5 rounded-full', dot)} />
              <span className="font-display text-[17px] font-bold text-foreground">{Math.round((v || 0) * factor)} g</span>
              <span className="text-xs text-faint">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="motion-rise flex flex-col gap-1 [animation-delay:60ms]">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-foreground">{item.name}</h1>
        <span className="text-sm text-muted-foreground">
          {n > 0 ? `Logged ${n} time${n === 1 ? '' : 's'}` : 'Not logged yet'}
          {food ? `, ${food.serving_size} ${food.serving_unit} a serving` : ''}
        </span>
      </div>

      <section className="motion-rise flex flex-col gap-2.5 [animation-delay:120ms]">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">How much</h2>
          <span className="text-xs text-faint">{servingNote}</span>
        </div>
        <Segmented label="Servings" options={SERVINGS} value={serving} onChange={(v) => { setServing(v); setAdded(false); }} className="h-12" />
      </section>

      {meal && (meal.notes || meal.tags?.length) ? (
        <section className="motion-rise flex flex-col gap-2.5 [animation-delay:180ms]">
          <h2 className="font-display text-lg font-bold text-foreground">Notes</h2>
          <div className="flex flex-col gap-2.5 rounded-[24px] bg-card p-4">
            {meal.notes && <p className="text-[15px] leading-relaxed text-foreground">{meal.notes}</p>}
            {meal.tags && meal.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {meal.tags.map((t) => (
                  <span key={t} className="rounded-full bg-muted px-3 py-1 text-[13px] text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className="motion-rise flex flex-col gap-2.5 [animation-delay:240ms]">
        <h2 className="font-display text-lg font-bold text-foreground">Add to</h2>
        <Segmented
          label="Meal"
          options={MEAL_ORDER.map((m) => [m, MEAL_LABEL[m]] as const)}
          value={slot}
          onChange={(v) => { setSlot(v); setAdded(false); }}
          className="h-12"
        />
      </section>

      <button
        type="button"
        onClick={handleDelete}
        className="flex h-11 items-center gap-2 self-start rounded-full px-1 text-sm font-semibold text-[#FF7A70]"
      >
        <Trash2 className="h-4 w-4" />
        Delete {meal ? 'meal' : 'food'}
      </button>

      <div
        className="fixed inset-x-0 z-30 mx-auto w-full max-w-[560px] px-4 pb-3 pt-3"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}
      >
        <button
          type="button"
          onClick={handleAdd}
          className={cn(
            'flex h-14 w-full items-center justify-center gap-2.5 rounded-full text-[17px] font-bold shadow-[0_14px_30px_-14px_rgba(0,0,0,.8)] transition-colors duration-300 active:scale-[.98]',
            added ? 'bg-chart-fiber text-background' : 'bg-primary text-primary-foreground'
          )}
        >
          {added ? (
            <span className="motion-pop flex items-center gap-2">
              <Check className="motion-draw h-5 w-5" strokeWidth={3} />
              Added to {MEAL_LABEL[slot].toLowerCase()}
            </span>
          ) : (
            <>
              Add to {MEAL_LABEL[slot].toLowerCase()}
              <span className="h-[18px] w-px bg-current opacity-35" />
              {kcal.toLocaleString()} kcal
            </>
          )}
        </button>
      </div>

      <EditMealDialog
        meal={editing}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={async (updates) => {
          if (editing) await updateMeal(editing.id, updates);
        }}
        isDailyMeal={false}
      />
    </div>
  );
};

export default SavedItemDetail;
