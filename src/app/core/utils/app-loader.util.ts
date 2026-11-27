const LOADER_ID = 'app-loader';
const FADE_MS = 200;

/**
 * Fades out and removes the startup loader declared in `index.html` (`#app-loader`).
 * Called once the app has its configuration, theme and window placement ready. Safe to call twice.
 */
export function hideAppLoader(): void {
  if (typeof document === 'undefined') return;
  const loader = document.getElementById(LOADER_ID);
  if (!loader || loader.classList.contains('app-loader--hidden')) return;
  loader.classList.add('app-loader--hidden');
  setTimeout(() => loader.remove(), FADE_MS);
}
