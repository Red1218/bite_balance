import { lazy, Suspense, useRef, useState, type CSSProperties } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AppDrawer from './AppDrawer';
import BottomNav, { tabIndex } from './BottomNav';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';

const AddMeal = lazy(() => import('../pages/AddMeal'));

export interface LayoutContext {
  openDrawer: () => void;
}

const AppLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { open: addMealOpen, closeAddMeal } = useAddMealSheet();
  const { pathname } = useLocation();

  // Pages slide in from the side of the tab you moved toward; drawer pages just fade.
  const prevTab = useRef(tabIndex(pathname));
  const dir = useRef(0);
  const lastPath = useRef(pathname);
  if (lastPath.current !== pathname) {
    const next = tabIndex(pathname);
    dir.current = next >= 0 && prevTab.current >= 0 ? Math.sign(next - prevTab.current) : 0;
    prevTab.current = next;
    lastPath.current = pathname;
  }

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
      {/* The window scrolls, so cover the status-bar strip or content slides under the clock. */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 bg-background" style={{ height: 'env(safe-area-inset-top, 0px)' }} />

      <AppDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <main className="mx-auto w-full max-w-[560px] px-4 pb-28 pt-4">
        <div key={pathname} className="motion-page" style={{ '--page-dir': dir.current } as CSSProperties}>
          <Outlet context={{ openDrawer: () => setDrawerOpen(true) } satisfies LayoutContext} />
        </div>
      </main>

      <BottomNav />

      <Drawer open={addMealOpen} onOpenChange={(next) => { if (!next) closeAddMeal(); }}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerTitle className="sr-only">Add meal</DrawerTitle>
          <div className="overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]">
            <Suspense fallback={<div className="h-64" />}>
              <AddMeal />
            </Suspense>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default AppLayout;
