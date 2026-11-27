export type AppViewMode = 'compact' | 'full';

/** Content size (logical px) each mode switches to when the window is not maximized. */
export const WINDOW_SIZE: Record<AppViewMode, { width: number; height: number }> = {
  compact: { width: 525, height: 800 },
  full: { width: 1150, height: 780 },
};

export const VIEW_MODE_STORAGE_KEY = 'pocketproject_view_mode';
/** Last window bounds (logical px) and maximized state, restored on the next start. */
export const WINDOW_BOUNDS_STORAGE_KEY = 'pocketproject_window_bounds';
/** Keys of earlier per-mode geometry versions, removed on start. */
export const LEGACY_WINDOW_STORAGE_KEYS = [
  'pocketproject_window_geometry_compact',
  'pocketproject_window_geometry_full',
  'pocketproject_window_geometry_v2_compact',
  'pocketproject_window_geometry_v2_full',
];

/** Debounce of the move/resize tracking that stores the last bounds. */
export const BOUNDS_SAVE_DEBOUNCE_MS = 400;
/** Cover fade-in/out (matches the 150 ms opacity transition of `app-window-transition`). */
export const TRANSITION_FADE_MS = 160;
/** Time for the new route to lay out at the new size before the cover fades out. */
export const TRANSITION_SETTLE_MS = 200;
