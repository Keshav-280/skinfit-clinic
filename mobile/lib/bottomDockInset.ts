/** Floating bottom nav bar height (padding + icons), excluding safe area. */
export const BOTTOM_DOCK_BAR_HEIGHT = 62;

/** Extra gap so CTAs sit clearly above the dock. */
export const BOTTOM_DOCK_EXTRA_GAP = 16;

export function bottomDockInset(): number {
  return BOTTOM_DOCK_BAR_HEIGHT + BOTTOM_DOCK_EXTRA_GAP;
}
