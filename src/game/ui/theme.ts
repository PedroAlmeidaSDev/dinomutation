import Phaser from 'phaser';
import type { Rarity } from '../../data/balance';

export const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';
export const FONT_BOLD = '"Arial Black", "Segoe UI Black", "Trebuchet MS", sans-serif';

export const COLORS = {
  bg: 0x12150e,
  panel: 0x1b2016,
  panelLight: 0x262d1e,
  border: 0x4a5638,
  text: '#f2ecd8',
  muted: '#a8a48c',
  accent: 0xe8b04a,
  accentText: '#ffcf6a',
  hp: 0xd8403a,
  hpBack: 0x3a1512,
  xp: 0x4ae08a,
  xpBack: 0x123020,
};

export const RARITY_COLORS: Record<Rarity, number> = {
  common: 0xb8b8a8,
  rare: 0x4aa8ff,
  legendary: 0xffa81a,
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'COMMON',
  rare: 'RARE',
  legendary: 'LEGENDARY',
};

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function text(
  scene: Phaser.Scene, x: number, y: number, content: string,
  size = 18, color = COLORS.text, bold = false,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, content, {
    fontFamily: bold ? FONT_BOLD : FONT,
    fontSize: `${size}px`,
    color,
    stroke: '#000000',
    strokeThickness: bold ? 4 : 2,
  });
}

export interface ButtonOptions {
  width?: number;
  height?: number;
  color?: number;
  fontSize?: number;
}

/** Simple rectangular button with hover/press feedback. */
export function button(
  scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, opts: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? 240;
  const h = opts.height ?? 56;
  const color = opts.color ?? COLORS.accent;
  const bg = scene.add.graphics();
  const draw = (hover: boolean) => {
    bg.clear();
    bg.fillStyle(0x000000, 0.4);
    bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 5, w, h, 10);
    bg.fillStyle(hover ? Phaser.Display.Color.ValueToColor(color).lighten(15).color : color, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    bg.lineStyle(3, 0x000000, 0.5);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
  };
  draw(false);
  const t = scene.add.text(0, 0, label, {
    fontFamily: FONT_BOLD, fontSize: `${opts.fontSize ?? 22}px`, color: '#1a1408',
  }).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, t]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => { draw(true); scene.tweens.add({ targets: c, scale: 1.05, duration: 80 }); });
  c.on('pointerout', () => { draw(false); scene.tweens.add({ targets: c, scale: 1, duration: 80 }); });
  c.on('pointerdown', () => {
    scene.tweens.add({ targets: c, scale: 0.95, duration: 50, yoyo: true, onComplete: onClick });
  });
  return c;
}

/**
 * Tiny vector icon for a tag. Used on upgrade cards and HUD indicators.
 */
export function drawTagIcon(g: Phaser.GameObjects.Graphics, tag: string, x: number, y: number, s: number, color: number): void {
  g.fillStyle(color, 1);
  g.lineStyle(Math.max(2, s * 0.12), color, 1);
  switch (tag) {
    case 'bite': {
      g.slice(x, y + s * 0.1, s * 0.5, Math.PI, 0, false);
      g.fillPath();
      g.fillStyle(0x000000, 0.8);
      for (let i = 0; i < 4; i++) g.fillTriangle(x - s * 0.36 + i * s * 0.24, y + s * 0.1, x - s * 0.24 + i * s * 0.24, y + s * 0.1, x - s * 0.3 + i * s * 0.24, y - s * 0.1);
      g.fillStyle(color, 1);
      g.slice(x, y + s * 0.25, s * 0.5, 0, Math.PI, false);
      g.fillPath();
      break;
    }
    case 'claw':
    case 'summon':
      for (let i = -1; i <= 1; i++) g.lineBetween(x - s * 0.3 + i * s * 0.2, y + s * 0.45, x + s * 0.3 + i * s * 0.2, y - s * 0.45);
      break;
    case 'horn':
      g.fillTriangle(x - s * 0.4, y + s * 0.4, x - s * 0.1, y + s * 0.4, x + s * 0.4, y - s * 0.5);
      break;
    case 'bleed':
    case 'heal':
    case 'health':
      g.fillCircle(x, y + s * 0.15, s * 0.3);
      g.fillTriangle(x - s * 0.28, y + s * 0.05, x + s * 0.28, y + s * 0.05, x, y - s * 0.5);
      if (tag !== 'bleed') {
        g.fillStyle(0xffffff, 1);
        g.fillRect(x - s * 0.04, y - s * 0.02, s * 0.08, s * 0.34);
        g.fillRect(x - s * 0.17, y + s * 0.11, s * 0.34, s * 0.08);
      }
      break;
    case 'crit':
    case 'execute': {
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 === 0 ? s * 0.5 : s * 0.22;
        pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
      }
      g.fillPoints(pts, true);
      break;
    }
    case 'speed':
    case 'kill':
      g.fillTriangle(x - s * 0.45, y - s * 0.4, x - s * 0.45, y + s * 0.4, x, y);
      g.fillTriangle(x, y - s * 0.4, x, y + s * 0.4, x + s * 0.45, y);
      break;
    case 'armor':
    case 'reflect':
      g.fillPoints([
        { x: x - s * 0.4, y: y - s * 0.4 }, { x: x + s * 0.4, y: y - s * 0.4 },
        { x: x + s * 0.35, y: y + s * 0.1 }, { x, y: y + s * 0.5 }, { x: x - s * 0.35, y: y + s * 0.1 },
      ], true);
      break;
    case 'thorns':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillTriangle(
          x + Math.cos(a - 0.3) * s * 0.2, y + Math.sin(a - 0.3) * s * 0.2,
          x + Math.cos(a + 0.3) * s * 0.2, y + Math.sin(a + 0.3) * s * 0.2,
          x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5,
        );
      }
      g.fillCircle(x, y, s * 0.2);
      break;
    case 'charge':
    case 'impact':
    case 'tail':
      g.fillCircle(x + s * 0.15, y, s * 0.3);
      g.lineBetween(x - s * 0.5, y - s * 0.25, x - s * 0.15, y - s * 0.25);
      g.lineBetween(x - s * 0.5, y, x - s * 0.15, y);
      g.lineBetween(x - s * 0.5, y + s * 0.25, x - s * 0.15, y + s * 0.25);
      break;
    case 'stun':
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
        g.fillCircle(x + Math.cos(a) * s * 0.3, y + Math.sin(a) * s * 0.3, s * 0.14);
      }
      g.strokeCircle(x, y, s * 0.45);
      break;
    case 'poison':
      g.fillCircle(x, y - s * 0.05, s * 0.35);
      g.fillStyle(0x000000, 0.7);
      g.fillCircle(x - s * 0.12, y - s * 0.1, s * 0.08);
      g.fillCircle(x + s * 0.12, y - s * 0.1, s * 0.08);
      g.fillStyle(color, 1);
      g.fillRect(x - s * 0.2, y + s * 0.25, s * 0.4, s * 0.15);
      break;
    case 'fear':
      g.strokeCircle(x, y, s * 0.4);
      g.fillCircle(x - s * 0.15, y - s * 0.1, s * 0.08);
      g.fillCircle(x + s * 0.15, y - s * 0.1, s * 0.08);
      g.strokeCircle(x, y + s * 0.18, s * 0.1);
      break;
    case 'size':
      g.fillTriangle(x, y - s * 0.5, x - s * 0.25, y - s * 0.15, x + s * 0.25, y - s * 0.15);
      g.fillTriangle(x, y + s * 0.5, x - s * 0.25, y + s * 0.15, x + s * 0.25, y + s * 0.15);
      g.fillRect(x - s * 0.06, y - s * 0.2, s * 0.12, s * 0.4);
      break;
    case 'mutation':
      g.strokeCircle(x, y, s * 0.4);
      g.lineBetween(x - s * 0.25, y - s * 0.3, x + s * 0.25, y + s * 0.3);
      g.lineBetween(x + s * 0.25, y - s * 0.3, x - s * 0.25, y + s * 0.3);
      break;
    default:
      g.fillCircle(x, y, s * 0.35);
  }
}
