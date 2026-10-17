// Android back button: overlays that should close on Back (the sidebar) register here while open.
const closers: (() => void)[] = [];

/** While registered, Back calls `close` instead of navigating. Returns the unregister function. */
export const closeOnBack = (close: () => void) => {
  closers.push(close);
  return () => {
    const i = closers.lastIndexOf(close);
    if (i >= 0) closers.splice(i, 1);
  };
};

/** Closes the most recently opened overlay; false when none is open. */
export const closeTopOverlay = () => {
  const close = closers[closers.length - 1];
  close?.();
  return !!close;
};
