import Phaser from 'phaser';

/**
 * Sprites are PNGs in ./sprites (file name = texture key), loaded in BootScene.preload.
 * The few soft FX textures below are still generated at boot from shapes.
 * Creatures are drawn top-down, facing right (angle 0).
 */

const SPRITES = import.meta.glob<string>('./sprites/*.png', { eager: true, query: '?url', import: 'default' });

export function loadSprites(scene: Phaser.Scene): void {
  for (const [path, url] of Object.entries(SPRITES)) {
    scene.load.image(path.slice(path.lastIndexOf('/') + 1, -'.png'.length), url);
  }
}

type G = Phaser.GameObjects.Graphics;

function makeTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function makeCanvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.getContext());
  tex.refresh();
}

function drawFx(scene: Phaser.Scene): void {
  makeTex(scene, 'px', 6, 6, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 3, 3);
  });
  makeCanvas(scene, 'glow', 64, 64, (c) => {
    const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, 64, 64);
  });
  makeCanvas(scene, 'swipe', 128, 128, (c) => {
    const grad = c.createRadialGradient(0, 64, 40, 0, 64, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.75, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.95, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(0, 64);
    c.arc(0, 64, 127, -0.8, 0.8);
    c.closePath();
    c.fill();
  });
}

export function generateTextures(scene: Phaser.Scene): void {
  drawFx(scene);
}
