import { createContext, useContext, useState, type ReactNode } from 'react';

interface AddMealSheetContextValue {
  open: boolean;
  openAddMeal: () => void;
  closeAddMeal: () => void;
}

const AddMealSheetContext = createContext<AddMealSheetContextValue | null>(null);

export const AddMealSheetProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);

  return (
    <AddMealSheetContext.Provider
      value={{
        open,
        openAddMeal: () => setOpen(true),
        closeAddMeal: () => setOpen(false),
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
