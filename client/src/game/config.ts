/**
 * Debug mode: on in `npm run dev`, or in any build with `?debug` in the URL.
 * Keys (in a run): 1 +XP level · 2 invincible · 3 spawn elite · 4 spawn boss · 5 kill all · 6 skip +60s
 */
export const DEBUG: boolean =
  import.meta.env.DEV || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'));

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
