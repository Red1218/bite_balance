import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AppDrawer from './AppDrawer';
import BottomNav, { tabIndex } from './BottomNav';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import { closeOnBack } from '@/lib/backButton';

const AddMeal = lazy(() => import('../pages/AddMeal'));

export interface LayoutContext {
  openDrawer: () => void;
}

const AppLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { open: addMealOpen, closeAddMeal } = useAddMealSheet();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [push, setPush] = useState<CSSProperties>();

  // Shrink around the middle of the screen, and clip to what's on screen so the rest of a long
  // page doesn't show above and below. The clip stays until the page has slid back.
  // ponytail: fixed elements inside a page (docked buttons) move with the page while the menu is open.
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    if (!drawerOpen) {
      setPush((p) => p && { ...p, transform: 'none', filter: 'none' });
      return;
    }
    const r = main.getBoundingClientRect();
    const vh = window.innerHeight;
    setPush({
      transform: 'translateX(62%) scale(.86)',
      transformOrigin: `50% ${vh / 2 - r.top}px`,
      clipPath: `inset(${Math.max(0, -r.top)}px 0 ${Math.max(0, r.bottom - vh)}px 0 round 28px)`,
      filter: 'brightness(.55)',
      background: 'hsl(var(--background))',
    });
  }, [drawerOpen]);

  // Android Back closes the open sidebar instead of leaving the page (or the app, on Today).
  useEffect(() => (drawerOpen ? closeOnBack(() => setDrawerOpen(false)) : undefined), [drawerOpen]);

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
      className="min-h-screen w-full overflow-x-clip bg-background"
      data-menu={drawerOpen ? 'open' : 'closed'}
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

      <main
        ref={mainRef}
        className="motion-push mx-auto w-full max-w-[560px] px-4 pb-28 pt-4"
        style={push}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === 'transform' && !drawerOpen) setPush(undefined);
        }}
      >
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
