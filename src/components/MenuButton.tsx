import { useOutletContext } from 'react-router-dom';
import { Menu } from 'lucide-react';
import type { LayoutContext } from './AppLayout';

// Opens the sidebar; sits at the start of each page header (Today uses its profile button instead).
const MenuButton = () => {
  const { openDrawer } = useOutletContext<LayoutContext>();
  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label="Open menu"
      className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-muted text-foreground transition-transform active:scale-95"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
};

export default MenuButton;
