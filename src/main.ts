import '@fontsource/lilita-one';
import '@fontsource/nunito/700.css';
import { installFullscreenShortcuts } from './game/core/Fullscreen';
import { createGame } from './game/Game';
import { prefersTouch } from './game/ui/TouchControls';

/** Phaser rasterises text once, so the web fonts must be ready before the first scene draws. */
function fontsReady(): Promise<unknown> {
  const load = Promise.all(['40px "Lilita One"', '700 18px Nunito'].map((f) => document.fonts.load(f, 'AÇÃÉÍÕÚáçãéíõú0123')));
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  return Promise.race([load, timeout]).catch(() => undefined);
}

void fontsReady().then(() => {
  const game = createGame('game');
  // Handy for debugging from the browser console.
  (window as unknown as { __game: unknown }).__game = game;
});
installFullscreenShortcuts(prefersTouch());
