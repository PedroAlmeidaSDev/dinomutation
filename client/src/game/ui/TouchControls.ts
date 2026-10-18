import Phaser from 'phaser';
import { safeInsets } from './layout';
import { COLORS, drawPanel } from './theme';

const STICK_RADIUS = 90;
const DEAD_ZONE = 0.18;
const PAUSE_Y = 56;
const PAUSE_SIZE = 60;

/** True on phones/tablets (primary pointer is a finger). */
export function prefersTouch(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
}

export interface TouchControlsOptions {
  /** Hit area of the ability button (drawn by the HUD). */
  abilityZone: () => { x: number; y: number; r: number };
  /** Movement/ability input is ignored while the run is paused or picking an upgrade. */
  isBlocked: () => boolean;
  onAbility: () => void;
  onPause: () => void;
  /** Called once when the controls become visible (first touch, or at start on touch devices). */
  onShow: () => void;
}

/**
 * On-screen controls for touch devices: a floating joystick (touch anywhere
 * and drag), the ability button and a pause button. Only reacts to touch
 * pointers, so mouse play on desktop is unaffected.
 */
export class TouchControls {
  /** Movement vector, each axis in [-1, 1]. */
  x = 0;
  y = 0;
  private stickId: number | null = null;
  private baseX = 0;
  private baseY = 0;
  private visible = false;
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene, private readonly opts: TouchControlsOptions) {
    this.g = scene.add.graphics().setDepth(900);
    const input = scene.input;
    input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    scene.game.events.on(Phaser.Core.Events.BLUR, this.release, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    if (prefersTouch()) this.show();
  }

  private show(): void {
    if (this.visible) return;
    this.visible = true;
    this.opts.onShow();
  }

  /** Pause button sits in the top-right corner of the actual screen. */
  private get pauseX(): number {
    return this.scene.scale.width - safeInsets(this.scene).right - 52;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch) return;
    this.show();
    if (this.opts.isBlocked()) return;

    if (Math.abs(p.x - this.pauseX) < PAUSE_SIZE * 0.7 && Math.abs(p.y - PAUSE_Y) < PAUSE_SIZE * 0.7) {
      this.release();
      this.opts.onPause();
      return;
    }
    const ab = this.opts.abilityZone();
    if (Math.hypot(p.x - ab.x, p.y - ab.y) < ab.r * 1.3) {
      this.opts.onAbility();
      return;
    }
    if (this.stickId === null) {
      this.stickId = p.id;
      this.baseX = p.x;
      this.baseY = p.y;
      this.x = 0;
      this.y = 0;
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.stickId) return;
    let dx = p.x - this.baseX;
    let dy = p.y - this.baseY;
    const dist = Math.hypot(dx, dy);
    if (dist > STICK_RADIUS) {
      // Drag the base along so reversing direction is instant.
      this.baseX = p.x - (dx / dist) * STICK_RADIUS;
      this.baseY = p.y - (dy / dist) * STICK_RADIUS;
      dx = p.x - this.baseX;
      dy = p.y - this.baseY;
    }
    const mag = Math.min(1, dist / STICK_RADIUS);
    if (mag < DEAD_ZONE) {
      this.x = 0;
      this.y = 0;
    } else {
      this.x = dx / STICK_RADIUS;
      this.y = dy / STICK_RADIUS;
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.stickId) this.release();
  }

  private release(): void {
    this.stickId = null;
    this.x = 0;
    this.y = 0;
  }

  update(): void {
    const g = this.g;
    g.clear();
    if (!this.visible) return;

    // Pause button
    const h = PAUSE_SIZE / 2;
    const PAUSE_X = this.pauseX;
    drawPanel(g, PAUSE_X - h, PAUSE_Y - h, PAUSE_SIZE, PAUSE_SIZE, { cut: 10, alpha: 0.8 });
    g.fillStyle(0xfff3ea, 1);
    g.fillRect(PAUSE_X - 11, PAUSE_Y - 14, 7, 28);
    g.fillRect(PAUSE_X + 4, PAUSE_Y - 14, 7, 28);

    // Joystick
    if (this.stickId !== null && !this.opts.isBlocked()) {
      g.fillStyle(COLORS.bg, 0.35);
      g.fillCircle(this.baseX, this.baseY, STICK_RADIUS);
      g.lineStyle(1.5, 0xfff3ea, 0.35);
      g.strokeCircle(this.baseX, this.baseY, STICK_RADIUS);
      const kx = this.baseX + this.x * STICK_RADIUS;
      const ky = this.baseY + this.y * STICK_RADIUS;
      g.fillStyle(COLORS.accent, 0.85);
      g.fillCircle(kx, ky, 38);
    }
  }

  destroy(): void {
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.release, this);
    this.g.destroy();
  }
}
