import { createContext, useContext, useState, type ReactNode } from 'react';

interface AddMealSheetContextValue {
  open: boolean;
  openAddMeal: () => void;
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
  const [mealsLoggedAt, setMealsLoggedAt] = useState(0);

  return (
    <AddMealSheetContext.Provider
      value={{
        open,
        openAddMeal: () => setOpen(true),
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
