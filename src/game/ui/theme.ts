import Phaser from 'phaser';
import type { Rarity } from '../../data/balance';
import { fullscreenSupported, isFullscreen, toggleFullscreen } from '../core/Fullscreen';

/** Chakra Petch is bundled (see main.ts) in two weights: 500 for text, 700 for emphasis. */
export const FONT = '"Chakra Petch", "Segoe UI", sans-serif';
export const WEIGHT = { regular: '500', bold: '700' } as const;

/** "Magma" palette: warm charcoal surfaces, lava accent, acid-green secondary. */
export const COLORS = {
  bg: 0x0f0a09,
  panel: 0x17100f,
  panelLight: 0x251a17,
  border: 0x3d2b25,
  track: 0x2a1e1b,
  text: '#fff3ea',
  muted: '#c4a79b',
  dim: '#6e5a52',
  accent: 0xff5a36,
  accentText: '#ff7a55',
  acid: 0xc8ff3d,
  acidText: '#c8ff3d',
  danger: '#ff5a6e',
  hp: 0xff3f5e,
  hpBack: 0x2c1216,
  xp: 0xc8ff3d,
  xpBack: 0x20260f,
};

export const RARITY_COLORS: Record<Rarity, number> = {
  common: 0xb9aea6,
  rare: 0x4ab8ff,
  legendary: 0xffb020,
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'COMMON',
  rare: 'RARE',
  legendary: 'LEGENDARY',
};

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.ValueToColor(color);
  return (amount >= 0 ? c.lighten(amount) : c.darken(-amount)).color;
}

/** Dark or light label colour, whichever reads better on `fill`. */
export function inkOn(fill: number): string {
  const c = Phaser.Display.Color.ValueToColor(fill);
  return 0.299 * c.red + 0.587 * c.green + 0.114 * c.blue > 150 ? hex(COLORS.panel) : '#ffffff';
}

export function text(
  scene: Phaser.Scene, x: number, y: number, content: string,
  size = 18, color = COLORS.text, bold = false,
): Phaser.GameObjects.Text {
  // A thin dark stroke keeps text legible when it sits directly on the ground texture.
  return scene.add.text(x, y, content, {
    fontFamily: FONT,
    fontStyle: bold ? WEIGHT.bold : WEIGHT.regular,
    fontSize: `${size}px`,
    color,
    stroke: hex(COLORS.bg),
    strokeThickness: 2,
  });
}

/** Heading: solid colour, soft shadow, slight tracking. */
export function title(
  scene: Phaser.Scene, x: number, y: number, content: string, size = 42, color = 0xfff3ea,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, content, {
    fontFamily: FONT, fontStyle: WEIGHT.bold, fontSize: `${size}px`, color: hex(color), align: 'center',
    letterSpacing: Math.round(size * 0.03),
    shadow: { offsetX: 0, offsetY: Math.max(2, Math.round(size / 16)), color: 'rgba(0,0,0,0.6)', blur: Math.round(size / 4), fill: true },
  });
}

export interface PanelOptions {
  fill?: number;
  alpha?: number;
  /** Size of the chamfer cut into the top-left and bottom-right corners. */
  cut?: number;
  /** Outline colour; `null` draws no outline. */
  stroke?: number | null;
  strokeWidth?: number;
  strokeAlpha?: number;
  /** Optional coloured bar along the top edge (rarity, selection…). */
  accent?: number;
}

function chamfer(x: number, y: number, w: number, h: number, cut: number): Phaser.Types.Math.Vector2Like[] {
  const c = Math.max(0, Math.min(cut, w / 2, h / 2));
  return [
    { x: x + c, y }, { x: x + w, y }, { x: x + w, y: y + h - c },
    { x: x + w - c, y: y + h }, { x, y: y + h }, { x, y: y + c },
  ];
}

/**
 * Flat panel with chamfered corners: the one surface every panel, card, button and
 * HUD frame is built from.
 */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, o: PanelOptions = {}): void {
  const cut = o.cut ?? 10;
  const pts = chamfer(x, y, w, h, cut);
  g.fillStyle(o.fill ?? COLORS.panel, o.alpha ?? 0.92);
  g.fillPoints(pts, true);
  if (o.stroke !== null) {
    g.lineStyle(o.strokeWidth ?? 1, o.stroke ?? COLORS.border, o.strokeAlpha ?? 1);
    g.strokePoints(pts, true, true);
  }
  if (o.accent !== undefined) {
    g.fillStyle(o.accent, 1);
    g.fillRect(x + Math.min(cut, w / 2), y, w - Math.min(cut, w / 2), 3);
  }
}

/** A static panel (its own Graphics object). */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, o: PanelOptions = {}): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawPanel(g, x, y, w, h, o);
  return g;
}

/** Flat bar (HP, XP, boss…). `ratio` in [0, 1]. */
export function drawBar(
  g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, ratio: number, fill: number, back: number = COLORS.track,
): void {
  g.fillStyle(back, 0.9);
  g.fillRect(x, y, w, h);
  const fw = w * Phaser.Math.Clamp(ratio, 0, 1);
  if (fw <= 0) return;
  g.fillStyle(fill, 1);
  g.fillRect(x, y, fw, h);
}

export interface ButtonOptions {
  width?: number;
  height?: number;
  color?: number;
  fontSize?: number;
  /** Outline-only button for secondary actions. */
  ghost?: boolean;
}

/** Chamfered button: solid (primary) or outlined (ghost). Hover brightens, press shrinks a touch. */
export function button(
  scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, opts: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? 240;
  const h = opts.height ?? 56;
  const color = opts.color ?? COLORS.accent;
  const size = opts.fontSize ?? 22;
  const cut = Math.round(h * 0.22);
  const bg = scene.add.graphics();
  const t = scene.add.text(0, 0, label, {
    fontFamily: FONT, fontStyle: WEIGHT.bold, fontSize: `${size}px`,
    color: opts.ghost ? COLORS.text : inkOn(color), letterSpacing: Math.max(1, Math.round(size * 0.06)),
  }).setOrigin(0.5);
  const draw = (hover: boolean) => {
    bg.clear();
    if (opts.ghost) {
      drawPanel(bg, -w / 2, -h / 2, w, h, {
        cut, fill: hover ? COLORS.panelLight : COLORS.panel, alpha: 0.85,
        stroke: hover ? color : 0xfff3ea, strokeAlpha: hover ? 1 : 0.35, strokeWidth: 1.5,
      });
    } else {
      drawPanel(bg, -w / 2, -h / 2, w, h, { cut, fill: hover ? shade(color, 8) : color, alpha: 1, stroke: null });
    }
  };
  draw(false);
  // [bg, label] — ResultScene reaches into list[1] to relabel the copy button.
  const c = scene.add.container(x, y, [bg, t]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => draw(true));
  c.on('pointerout', () => { draw(false); scene.tweens.add({ targets: c, scale: 1, duration: 80 }); });
  c.on('pointerdown', () => {
    scene.tweens.add({ targets: c, scale: 0.96, duration: 60, yoyo: true });
    scene.time.delayedCall(90, onClick);
  });
  return c;
}

/**
 * Square ⛶ button that toggles browser fullscreen. Fires on pointerup (not in
 * a tween callback) because browsers only allow fullscreen inside the gesture.
 * Returns null where fullscreen is unavailable (iPhone Safari).
 */
export function fullscreenButton(scene: Phaser.Scene, x: number, y: number, size = 52): Phaser.GameObjects.Container | null {
  if (!fullscreenSupported()) return null;
  const g = scene.add.graphics();
  const draw = (hover: boolean) => {
    const h = size / 2;
    const a = size * 0.2;
    const inset = size * 0.28;
    g.clear();
    drawPanel(g, -h, -h, size, size, { cut: 8, fill: hover ? COLORS.panelLight : COLORS.panel, stroke: hover ? COLORS.accent : COLORS.border });
    g.lineStyle(3, hover ? COLORS.accent : 0xfff3ea, 1);
    // Corner brackets pointing out (enter) or in (exit).
    const out = !isFullscreen();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = sx * (h - inset);
      const cy = sy * (h - inset);
      const d = out ? -1 : 1;
      g.lineBetween(cx, cy, cx + d * sx * a, cy);
      g.lineBetween(cx, cy, cx, cy + d * sy * a);
    }
  };
  draw(false);
  const c = scene.add.container(x, y, [g]);
  c.setSize(size, size).setInteractive({ useHandCursor: true });
  c.on('pointerover', () => draw(true));
  c.on('pointerout', () => draw(false));
  c.on('pointerup', () => toggleFullscreen());
  const redraw = () => draw(false);
  document.addEventListener('fullscreenchange', redraw);
  document.addEventListener('webkitfullscreenchange', redraw);
  c.once(Phaser.GameObjects.Events.DESTROY, () => {
    document.removeEventListener('fullscreenchange', redraw);
    document.removeEventListener('webkitfullscreenchange', redraw);
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
