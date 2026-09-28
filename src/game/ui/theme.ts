import Phaser from 'phaser';
import type { Rarity } from '../../data/balance';
import { fullscreenSupported, isFullscreen, toggleFullscreen } from '../core/Fullscreen';

export const FONT = '"Nunito", "Trebuchet MS", "Segoe UI", sans-serif';
export const FONT_BOLD = '"Lilita One", "Arial Black", "Segoe UI Black", sans-serif';

export const COLORS = {
  bg: 0x12150e,
  panel: 0x2f2b22,
  panelLight: 0x3d382c,
  border: 0x5a5242,
  outline: 0x0c0906,
  text: '#f2ecd8',
  muted: '#b4ab92',
  accent: 0xf0a830,
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

export function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.ValueToColor(color);
  return (amount >= 0 ? c.lighten(amount) : c.darken(-amount)).color;
}

export function text(
  scene: Phaser.Scene, x: number, y: number, content: string,
  size = 18, color = COLORS.text, bold = false,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, content, {
    fontFamily: bold ? FONT_BOLD : FONT,
    fontStyle: bold ? 'normal' : 'bold',
    fontSize: `${size}px`,
    color,
    stroke: '#000000',
    strokeThickness: bold ? Math.max(4, Math.round(size / 4.5)) : 3,
    shadow: bold ? { offsetX: 0, offsetY: 2, color: '#000000', blur: 0, stroke: true, fill: true } : undefined,
  });
}

/** Big chunky heading: vertical gradient fill (light → `color`), thick outline and a hard drop shadow. */
export function title(
  scene: Phaser.Scene, x: number, y: number, content: string, size = 42, color = COLORS.accent,
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, content, {
    fontFamily: FONT_BOLD, fontSize: `${size}px`, color: '#ffffff', align: 'center',
    stroke: '#1a0e04', strokeThickness: Math.round(size / 5),
    shadow: { offsetX: 0, offsetY: Math.round(size / 12), color: '#000000', blur: 0, stroke: true, fill: true },
  });
  const grad = t.context.createLinearGradient(0, 0, 0, t.height);
  grad.addColorStop(0.15, hex(shade(color, 38)));
  grad.addColorStop(0.7, hex(color));
  grad.addColorStop(1, hex(shade(color, -18)));
  t.setFill(grad);
  return t;
}

export interface SlabOptions {
  fill?: number;
  alpha?: number;
  radius?: number;
  /** Width of the black outline. */
  border?: number;
  /** Height of the darker "lip" along the bottom edge (3D button look). */
  lip?: number;
  /** Drop shadow offset below the slab; 0 disables it. */
  shadow?: number;
  /** Stone speckles — skip for things redrawn every frame. */
  speckle?: boolean;
  /** Optional coloured frame drawn just inside the outline. */
  frame?: number;
  frameWidth?: number;
}

/**
 * Cartoon stone slab: black outline, bevelled face with a highlight on top and a
 * darker bottom rim, optional lip and speckles. Panels, buttons, cards and HUD
 * frames all use it so the UI matches the outlined sprites.
 */
export function drawSlab(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, o: SlabOptions = {}): void {
  const fill = o.fill ?? COLORS.panel;
  const a = o.alpha ?? 1;
  const r = o.radius ?? 14;
  const b = o.border ?? 4;
  const lip = o.lip ?? 0;
  const sh = o.shadow ?? 6;
  if (sh > 0) {
    g.fillStyle(0x000000, 0.35 * a);
    g.fillRoundedRect(x + 2, y + sh, w, h, r);
  }
  g.fillStyle(COLORS.outline, a);
  g.fillRoundedRect(x, y, w, h, r);
  const ix = x + b;
  const iy = y + b;
  const iw = w - 2 * b;
  const ih = h - 2 * b;
  const ir = Math.max(2, r - b);
  if (iw <= 0 || ih <= 0) return;
  // Darker bottom layer, then the face on top of it, leaving a shaded rim / lip.
  g.fillStyle(shade(fill, -22), a);
  g.fillRoundedRect(ix, iy, iw, ih, ir);
  const faceH = ih - Math.max(3, lip);
  g.fillStyle(fill, a);
  g.fillRoundedRect(ix, iy, iw, faceH, ir);
  // Bevel highlight across the top.
  g.fillStyle(0xffffff, 0.12 * a);
  g.fillRoundedRect(ix + 3, iy + 2, iw - 6, Math.min(faceH * 0.42, 22), { tl: ir, tr: ir, bl: 3, br: 3 });
  g.fillStyle(0xffffff, 0.22 * a);
  g.fillRoundedRect(ix + ir * 0.6, iy + 2, Math.max(1, iw - ir * 1.2), 2.5, 1);
  if (o.speckle) {
    let seed = (Math.floor(Math.abs(x * 7 + y * 13 + w * 3 + h)) % 2147483646) + 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const n = Math.min(90, Math.floor((iw * ih) / 700));
    for (let i = 0; i < n; i++) {
      const dark = rnd() < 0.6;
      g.fillStyle(dark ? 0x000000 : 0xffffff, (dark ? 0.16 : 0.06) * a);
      g.fillCircle(ix + ir / 2 + rnd() * (iw - ir), iy + ir / 2 + rnd() * (faceH - ir), 0.8 + rnd() * 2);
    }
  }
  if (o.frame !== undefined) {
    const fw = o.frameWidth ?? 3;
    g.lineStyle(fw, o.frame, a);
    g.strokeRoundedRect(ix + fw / 2, iy + fw / 2, iw - fw, ih - fw, Math.max(2, ir - fw / 2));
  }
}

/** A static stone panel (its own Graphics object). */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, o: SlabOptions = {}): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawSlab(g, x, y, w, h, { speckle: true, alpha: 0.97, ...o });
  return g;
}

/** Outlined bar with a glossy fill (HP, XP, boss…). `ratio` in [0, 1]. */
export function drawBar(
  g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, ratio: number, fill: number, back: number, r = 6,
): void {
  const b = 3;
  g.fillStyle(COLORS.outline, 1);
  g.fillRoundedRect(x - b, y - b, w + 2 * b, h + 2 * b, r + b);
  g.fillStyle(back, 1);
  g.fillRoundedRect(x, y, w, h, r);
  const fw = w * Phaser.Math.Clamp(ratio, 0, 1);
  if (fw <= 0) return;
  const fr = Math.min(r, fw / 2, h / 2);
  g.fillStyle(shade(fill, -18), 1);
  g.fillRoundedRect(x, y, fw, h, fr);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, fw, h * 0.72, fr);
  if (fw > 8) {
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(x + 3, y + 2, fw - 6, Math.max(2, h * 0.22), Math.min(2, fr));
  }
}

export interface ButtonOptions {
  width?: number;
  height?: number;
  color?: number;
  fontSize?: number;
}

/** Chunky stone button with a 3D lip: hover brightens, press sinks it into the lip. */
export function button(
  scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, opts: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? 240;
  const h = opts.height ?? 56;
  const color = opts.color ?? COLORS.accent;
  const lip = Math.max(5, Math.round(h * 0.12));
  const size = opts.fontSize ?? 22;
  const bg = scene.add.graphics();
  const t = scene.add.text(0, 0, label, {
    fontFamily: FONT_BOLD, fontSize: `${size}px`, color: '#ffffff',
    stroke: '#1a0e04', strokeThickness: Math.max(4, Math.round(size / 4.5)),
    shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 0, stroke: true, fill: true },
  }).setOrigin(0.5);
  const draw = (hover: boolean, pressed = false) => {
    bg.clear();
    const dy = pressed ? lip - 2 : 0;
    drawSlab(bg, -w / 2, -h / 2 + dy, w, h - dy, {
      fill: hover ? shade(color, 10) : color, radius: 12, border: 4, lip: pressed ? 3 : lip, shadow: pressed ? 2 : 5,
    });
    t.setY(-lip / 2 + dy / 2 + 1);
  };
  draw(false);
  // [bg, label] — ResultScene reaches into list[1] to relabel the copy button.
  const c = scene.add.container(x, y, [bg, t]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => { draw(true); scene.tweens.add({ targets: c, scale: 1.04, duration: 80 }); });
  c.on('pointerout', () => { draw(false); scene.tweens.add({ targets: c, scale: 1, duration: 80 }); });
  c.on('pointerdown', () => {
    draw(true, true);
    scene.time.delayedCall(90, () => {
      if (c.active) draw(true);
      onClick();
    });
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
    drawSlab(g, -h, -h, size, size, { fill: hover ? COLORS.panelLight : COLORS.panel, radius: 12, border: 3, lip: 5, shadow: 4 });
    g.lineStyle(4, hover ? 0xffe0a0 : 0xffffff, 0.95);
    // Corner brackets pointing out (enter) or in (exit).
    const out = !isFullscreen();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = sx * (h - inset);
      const cy = sy * (h - inset) - 2;
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
  // Hard black drop shadow first, so the flat icon reads like the outlined sprites.
  drawTagShape(g, tag, x + s * 0.05, y + s * 0.08, s, 0x000000);
  drawTagShape(g, tag, x, y, s, color);
}

function drawTagShape(g: Phaser.GameObjects.Graphics, tag: string, x: number, y: number, s: number, color: number): void {
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
