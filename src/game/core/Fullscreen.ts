/**
 * Browser fullscreen (hides the address bar / system UI). Must be triggered
 * from a user gesture, so every entry point here runs inside an input event.
 * iPhone Safari has no Fullscreen API: there the page just fills the viewport.
 */

type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => void };

const doc = (): WebkitDocument => document as WebkitDocument;

export function fullscreenSupported(): boolean {
  return typeof document !== 'undefined' && !!(doc().fullscreenEnabled || doc().webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  return !!(doc().fullscreenElement || doc().webkitFullscreenElement);
}

export function enterFullscreen(): void {
  if (!fullscreenSupported() || isFullscreen()) return;
  const el = document.documentElement as WebkitElement;
  const done = () => {
    // Phones: stay in landscape while fullscreen (only allowed once fullscreen).
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    orientation?.lock?.('landscape').catch(() => {});
  };
  if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(done, () => {});
  else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); done(); }
}

export function exitFullscreen(): void {
  if (!isFullscreen()) return;
  if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  else doc().webkitExitFullscreen?.();
}

export function toggleFullscreen(): void {
  if (isFullscreen()) exitFullscreen();
  else enterFullscreen();
}

/**
 * Touch devices go fullscreen on the first tap. If the player leaves
 * fullscreen on purpose we stop forcing it; the ⛶ buttons still work.
 * Desktop: F toggles fullscreen.
 */
export function installFullscreenShortcuts(touch: boolean): void {
  if (!fullscreenSupported()) return;
  if (touch) {
    let optedOut = false;
    let wasFullscreen = false;
    const onTap = () => {
      if (!optedOut && !isFullscreen()) enterFullscreen();
    };
    document.addEventListener('pointerup', onTap, true);
    const onChange = () => {
      if (isFullscreen()) wasFullscreen = true;
      else if (wasFullscreen) optedOut = true;
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
  }
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFullscreen();
  });
}
