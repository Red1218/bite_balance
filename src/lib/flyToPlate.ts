const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** How long a token takes to reach the plate; the plate waits this long before taking the new totals. */
export const FLIGHT_MS = 680;

/**
 * Sends a small food token from `from` to Today's plate (#plate-ring) on a curve: X and Y run on
 * different easings, so it lifts first and then drops in. Does nothing when the plate isn't on
 * the page or the phone asks for reduced motion.
 */
export const flyToPlate = (from: DOMRect, label: string, color: string) => {
  const plate = document.getElementById('plate-ring');
  if (!plate || reducedMotion()) return false;
  const to = plate.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);

  const outer = document.createElement('div');
  outer.style.cssText = `position:fixed;left:${to.left + to.width / 2 - 22}px;top:${to.top + to.height / 2 - 22}px;width:44px;height:44px;z-index:60;pointer-events:none`;
  const token = document.createElement('div');
  token.style.cssText = `width:44px;height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;font:700 17px 'Bricolage Grotesque',sans-serif;color:hsl(var(--background));background:${color};box-shadow:0 10px 24px -8px ${color}`;
  token.textContent = label;
  outer.appendChild(token);
  document.body.appendChild(outer);

  outer.animate([{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], {
    duration: FLIGHT_MS,
    easing: 'cubic-bezier(.45,.05,.55,.95)',
    fill: 'both',
  });
  token
    .animate(
      [
        { transform: `translateY(${dy}px) scale(1)` },
        { transform: 'translateY(0) scale(.3) rotate(160deg)', opacity: 0.2 },
      ],
      { duration: FLIGHT_MS, easing: 'cubic-bezier(.55,-0.55,.75,.9)', fill: 'both' }
    )
    .finished.finally(() => outer.remove());
  return true;
};
