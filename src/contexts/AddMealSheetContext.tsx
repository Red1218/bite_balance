import { createContext, useContext, useState, type ReactNode } from 'react';
import type { MealTime } from '@/components/MealReviewList';

interface AddMealSheetContextValue {
  open: boolean;
  /** Opens the sheet, optionally on a meal slot (an empty slot on Today passes its own). */
  openAddMeal: (mealTime?: MealTime) => void;
  /** The slot the sheet was opened on, if any; the sheet falls back to the time of day. */
  initialMealTime: MealTime | null;
  closeAddMeal: () => void;
  /** Bumped whenever a meal is logged from inside the sheet, so pages that
   * stay mounted underneath it (e.g. Dashboard) know to refetch -- the
   * sheet is an overlay, not a route change, so nothing else remounts them. */
  mealsLoggedAt: number;
  notifyMealsLogged: () => void;
}

const AddMealSheetContext = createContext<AddMealSheetContextValue | null>(null);

export const AddMealSheetProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [initialMealTime, setInitialMealTime] = useState<MealTime | null>(null);
  const [mealsLoggedAt, setMealsLoggedAt] = useState(0);

  return (
    <AddMealSheetContext.Provider
      value={{
        open,
        openAddMeal: (mealTime) => {
          setInitialMealTime(mealTime ?? null);
          setOpen(true);
        },
        initialMealTime,
        closeAddMeal: () => setOpen(false),
        mealsLoggedAt,
        notifyMealsLogged: () => setMealsLoggedAt(Date.now()),
      }}
    >
      {children}
    </AddMealSheetContext.Provider>
  );
};

export const useAddMealSheet = () => {
  const ctx = useContext(AddMealSheetContext);
  if (!ctx) {
    throw new Error('useAddMealSheet must be used within AddMealSheetProvider');
  }
  return ctx;
};
