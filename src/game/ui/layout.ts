import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/**
 * The game runs in Scale.EXPAND: the canvas always fills the screen and the
 * game size grows past GAME_WIDTH×GAME_HEIGHT along whichever axis has spare
 * room. Layouts are still authored for a 1280×720 "design box"; these helpers
 * centre that box in the view or anchor things to the real screen edges.
 */

export interface View {
  width: number;
  height: number;
}

export function viewSize(scene: Phaser.Scene): View {
  return { width: scene.scale.width, height: scene.scale.height };
}

/** Top-left of the centred 1280×720 design box, in view coordinates. */
export function designOffset(scene: Phaser.Scene): { x: number; y: number } {
  return { x: (scene.scale.width - GAME_WIDTH) / 2, y: (scene.scale.height - GAME_HEIGHT) / 2 };
}

/** Screen-edge insets (notch, home indicator) converted to game units. */
export function safeInsets(scene: Phaser.Scene): { left: number; right: number; top: number; bottom: number } {
  const css = cssInsets();
  const k = scene.scale.displayScale.x || 1;
  return { left: css.left * k, right: css.right * k, top: css.top * k, bottom: css.bottom * k };
}

/** CSS-pixel insets from the --sa* variables in index.html; re-read only after a resize. */
let cachedInsets: { left: number; right: number; top: number; bottom: number } | null = null;
function cssInsets(): { left: number; right: number; top: number; bottom: number } {
  if (cachedInsets) return cachedInsets;
  if (typeof getComputedStyle === 'undefined') return { left: 0, right: 0, top: 0, bottom: 0 };
  const css = getComputedStyle(document.documentElement);
  const read = (v: string) => parseFloat(css.getPropertyValue(v)) || 0;
  cachedInsets = { left: read('--sal'), right: read('--sar'), top: read('--sat'), bottom: read('--sab') };
  return cachedInsets;
}
if (typeof window !== 'undefined') window.addEventListener('resize', () => { cachedInsets = null; });

/** Runs `fn` now and on every resize until the scene shuts down. */
export function onLayout(scene: Phaser.Scene, fn: (view: View) => void): void {
  const handler = () => fn(viewSize(scene));
  handler();
  scene.scale.on(Phaser.Scale.Events.RESIZE, handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, handler));
}

/**
 * For menu-style scenes authored at 1280×720: scrolls the camera so the design
 * box is centred, and stretches the given backdrops over the whole screen.
 */
export function centerDesign(
  scene: Phaser.Scene,
  backdrops: (Phaser.GameObjects.TileSprite | Phaser.GameObjects.Rectangle)[] = [],
): void {
  for (const b of backdrops) b.setOrigin(0).setScrollFactor(0);
  onLayout(scene, (v) => {
    const o = designOffset(scene);
    scene.cameras.main.setScroll(-o.x, -o.y);
    for (const b of backdrops) b.setSize(v.width, v.height);
  });
}

/** Full-screen click blocker for overlays whose content sits in the design box. */
export function fitShade(shade: Phaser.GameObjects.Rectangle, scene: Phaser.Scene): void {
  const o = designOffset(scene);
  shade.setPosition(-o.x, -o.y).setSize(scene.scale.width, scene.scale.height);
  (shade.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setSize(scene.scale.width, scene.scale.height);
}
