import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import AppDrawer from './AppDrawer';
import BottomNav from './BottomNav';

const AppLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div
      className="min-h-screen w-full bg-background"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <AppDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <main className="mx-auto w-full max-w-[560px] px-4 pb-28 pt-4">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
        </div>

        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
};

export default AppLayout;
