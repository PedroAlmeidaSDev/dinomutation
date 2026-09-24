import { createGame } from './game/Game';

const game = createGame('game');

// Handy for debugging from the browser console.
(window as unknown as { __game: unknown }).__game = game;
