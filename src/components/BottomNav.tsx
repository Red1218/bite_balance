import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ListChecks, MessageCircle, Plus, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';

const TABS = [
  { path: '/', icon: Home, label: 'Today' },
  { path: '/chat', icon: MessageCircle, label: 'Chat' },
  { path: '/habits', icon: ListChecks, label: 'Habits' },
  { path: '/profile', icon: User, label: 'You' },
] as const;

/** Position of the tab that owns this path (a habit's detail page belongs to Habits), or -1 for drawer pages. */
export const tabIndex = (pathname: string) =>
  TABS.findIndex((t) => t.path === pathname || (t.path !== '/' && pathname.startsWith(`${t.path}/`)));

// Habits has its own "New habit" button and Chat has its own input, so the add-meal button would compete there.
const NO_FAB = ['/habits', '/chat'];

const PAD = 4; // track padding (px); the capsule's slots sit inside it
const SLOT = `(100% - ${PAD * 2}px) / ${TABS.length}`;
const SPRING =
  'left .52s cubic-bezier(.34,1.5,.5,1), transform .38s cubic-bezier(.34,1.4,.5,1), background .3s, border-color .3s, box-shadow .3s';
const FOLLOW = 'transform .2s ease, background .2s, border-color .2s';

const BottomNav = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { openAddMeal } = useAddMealSheet();
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x0: number; start: number; slot: number; moved: boolean } | null>(null);
  const timer = useRef<number>();
  const [dragLeft, setDragLeft] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  // A habit's detail page (/habits/:id) keeps the Habits tab lit; -1 on drawer pages: capsule hidden.
  const idx = tabIndex(pathname);
  const showFab = !NO_FAB.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const lens = moving || dragLeft !== null;

  useEffect(() => () => clearTimeout(timer.current), []);

  // Show the lens while the capsule springs to its new tab.
  const pulse = () => {
    clearTimeout(timer.current);
    setMoving(true);
    timer.current = window.setTimeout(() => setMoving(false), 280);
  };

  const dragTo = (d: NonNullable<typeof drag.current>, clientX: number) =>
    Math.max(PAD, Math.min(PAD + (TABS.length - 1) * d.slot, d.start + clientX - d.x0));

  // Only a press on the capsule itself starts a drag; other presses fall through to the tab links.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track || idx < 0) return;
    const slot = (track.clientWidth - PAD * 2) / TABS.length;
    const start = PAD + idx * slot;
    const x = e.clientX - track.getBoundingClientRect().left;
    if (x < start || x > start + slot) return;
    track.setPointerCapture(e.pointerId);
    drag.current = { x0: e.clientX, start, slot, moved: false };
    setDragLeft(start);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.x0) > 3) d.moved = true;
    setDragLeft(dragTo(d, e.clientX));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    setDragLeft(null);
    if (!d.moved) return;
    const nearest = Math.round((dragTo(d, e.clientX) - PAD) / d.slot);
    pulse();
    if (nearest !== idx) navigate(TABS[nearest].path);
  };

  return (
    <nav
      className="fixed left-4 right-4 z-40 flex items-center justify-center gap-2.5"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          'nav-glass relative flex h-16 flex-1 touch-none select-none rounded-full p-1 [-webkit-touch-callout:none]',
          showFab ? 'max-w-[292px]' : 'max-w-[360px]'
        )}
      >
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute bottom-1 top-1 rounded-full',
            lens ? 'nav-capsule-lens' : 'nav-capsule',
            idx < 0 && 'opacity-0'
          )}
          style={{
            width: `calc(${SLOT})`,
            left: dragLeft ?? `calc(${PAD}px + ${Math.max(idx, 0)} * ${SLOT})`,
            transition: dragLeft === null ? SPRING : FOLLOW,
          }}
        />
        {TABS.map(({ path, icon: Icon, label }, i) => (
          <Link
            key={path}
            to={path}
            draggable={false}
            onClick={() => i !== idx && pulse()}
            aria-current={i === idx ? 'page' : undefined}
            className="relative flex flex-1 flex-col items-center justify-center gap-[5px]"
          >
            <Icon
              className={cn('h-[21px] w-[21px] transition-colors', i === idx && !lens ? 'text-primary' : 'text-foreground/90')}
              strokeWidth={1.9}
            />
            <span className="text-[10px] font-semibold leading-none text-foreground">{label}</span>
          </Link>
        ))}
      </div>
      {showFab && (
      <button
        type="button"
        onClick={() => openAddMeal()}
        aria-label="Add meal"
        className="flex h-16 w-16 flex-none items-center justify-center rounded-full border border-primary-foreground/20 bg-primary shadow-[inset_0_1px_0_hsl(0_0%_100%/0.28),0_14px_30px_-12px_hsl(var(--primary)/0.95)] transition-transform active:scale-[.94]"
      >
        <Plus className="h-6 w-6 text-primary-foreground" strokeWidth={2.4} />
      </button>
      )}
    </nav>
  );
};

export default BottomNav;
