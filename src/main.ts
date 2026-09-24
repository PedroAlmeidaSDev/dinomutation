import { installFullscreenShortcuts } from './game/core/Fullscreen';
import { createGame } from './game/Game';
import { prefersTouch } from './game/ui/TouchControls';

const game = createGame('game');
installFullscreenShortcuts(prefersTouch());

// Handy for debugging from the browser console.
(window as unknown as { __game: unknown }).__game = game;
