import Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import type { DinoDef } from '../../data/dinosaurs';
import { HealthComponent } from '../components/HealthComponent';
import { StatsComponent } from '../components/StatsComponent';
import type { StatusHost, StatusId, StatusInstance } from '../statuses/StatusDefinitions';
import type { Enemy } from './enemies/Enemy';
import { angleDiff, rotateTowards, TAU } from '../../utils/math';

export interface DashOptions {
  angle: number;
  distance: number;
  duration: number;
  /** Radius added to the player radius when checking dash hits. */
  hitPadding: number;
  onHit?: (enemy: Enemy) => void;
  onEnd?: (x: number, y: number) => void;
  /** Stop early on obstacles/walls. */
  stopOnObstacle?: boolean;
  afterImageColor?: number;
}

interface DashState extends DashOptions {
  speed: number;
  remaining: number;
  hit: Set<Enemy>;
  afterImageTimer: number;
}

/**
 * The player-controlled dinosaur. Owns movement, dash physics and the visual
 * representation (which evolves with the build). Combat lives in systems.
 */
export class Player implements StatusHost {
  readonly kind = 'player' as const;
  x: number;
  y: number;
  statuses = new Map<StatusId, StatusInstance>();
  ccResist = 0.4;

  readonly stats: StatsComponent;
  readonly health: HealthComponent;
  /** Mechanic switches granted by upgrades (e.g. 'carnage'). */
  readonly flags = new Set<string>();

  facing = 0;
  moveAngle = 0;
  isMoving = false;
  momentum = 0;
  /** Momentum captured when the current dash started (Massa Imparável). */
  dashMomentum = 0;
  iFrames = 0;
  vx = 0;
  vy = 0;
  private kx = 0;
  private ky = 0;
  private aimAngle: number | null = null;
  private aimTimer = 0;
  private flashTimer = 0;
  private dash: DashState | null = null;
  private dead = false;

  readonly root: Phaser.GameObjects.Container;
  private readonly bodyC: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly extras: Phaser.GameObjects.Graphics;
  private readonly aura: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private auraColor: number | null = null;
  private visualTags = new Set<string>();
  private time = 0;

  constructor(private readonly scene: Phaser.Scene, readonly def: DinoDef, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.stats = new StatsComponent({ ...def.stats, pickupRange: BALANCE.player.basePickupRange }, BALANCE.player.softCaps);
    this.health = new HealthComponent(this.stats.get('maxHealth'));
    this.stats.onChange = () => {
      const max = Math.round(this.stats.get('maxHealth'));
      if (max !== this.health.max) this.health.setMax(max);
    };

    this.shadow = scene.add.ellipse(0, 6, def.radius * 2.6, def.radius * 1.5, 0x000000, 0.28);
    this.aura = scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(2.2);
    this.body = scene.add.image(0, 0, def.texture);
    this.extras = scene.add.graphics();
    this.bodyC = scene.add.container(0, 0, [this.body, this.extras]);
    this.root = scene.add.container(x, y, [this.shadow, this.aura, this.bodyC]);
    this.root.setDepth(50);
  }

  get radius(): number {
    return this.def.radius * this.stats.get('size');
  }

  get isInvulnerable(): boolean {
    return this.dash !== null;
  }

  get isDashing(): boolean {
    return this.dash !== null;
  }

  isAlive(): boolean {
    return !this.dead && this.health.current > 0;
  }

  markDead(): void {
    this.dead = true;
  }

  /** Face towards a target briefly (used by attacks). */
  aimAt(angle: number, duration = 0.35): void {
    this.aimAngle = angle;
    this.aimTimer = duration;
    this.facing = rotateTowards(this.facing, angle, 1.2);
  }

  applyKnockback(angle: number, force: number): void {
    if (this.dash) return;
    const resist = Math.min(0.8, (this.stats.get('size') - 1) * 0.6 + this.stats.get('armor') / 200);
    const f = force * (1 - resist);
    this.kx += Math.cos(angle) * f;
    this.ky += Math.sin(angle) * f;
  }

  flash(): void {
    this.flashTimer = 0.09;
    this.body.setTintFill(0xffffff);
  }

  startDash(opts: DashOptions): void {
    this.dash = {
      ...opts,
      speed: opts.distance / opts.duration,
      remaining: opts.duration,
      hit: new Set(),
      afterImageTimer: 0,
    };
    this.facing = opts.angle;
    this.kx = 0;
    this.ky = 0;
  }

  /** Called by the collision system when the dash hits a wall/obstacle. */
  notifyBlocked(): void {
    if (this.dash?.stopOnObstacle) this.endDash();
  }

  private endDash(): void {
    const d = this.dash;
    if (!d) return;
    this.dash = null;
    this.vx = Math.cos(d.angle) * this.stats.get('moveSpeed') * 0.5;
    this.vy = Math.sin(d.angle) * this.stats.get('moveSpeed') * 0.5;
    d.onEnd?.(this.x, this.y);
  }

  /** Dash collision check against enemies (called by the run loop). */
  updateDashHits(candidates: readonly Enemy[]): void {
    const d = this.dash;
    if (!d || !d.onHit) return;
    for (const e of candidates) {
      if (e.dead || d.hit.has(e)) continue;
      d.hit.add(e);
      d.onHit(e);
    }
  }

  get dashHitRadius(): number {
    return this.dash ? this.radius + this.dash.hitPadding : 0;
  }

  update(dt: number, inputX: number, inputY: number, moveMult: number): void {
    this.time += dt;
    if (this.iFrames > 0) this.iFrames -= dt;
    if (this.aimTimer > 0) this.aimTimer -= dt;

    const regen = this.stats.get('regen');
    if (regen > 0 && this.isAlive()) this.health.heal(regen * dt);

    if (this.dash) {
      const d = this.dash;
      this.x += Math.cos(d.angle) * d.speed * dt;
      this.y += Math.sin(d.angle) * d.speed * dt;
      d.remaining -= dt;
      d.afterImageTimer -= dt;
      if (d.afterImageTimer <= 0) {
        d.afterImageTimer = 0.025;
        this.spawnAfterImage(d.afterImageColor ?? 0xffffff);
      }
      if (d.remaining <= 0) this.endDash();
    } else {
      const len = Math.hypot(inputX, inputY);
      const speed = this.stats.get('moveSpeed') * moveMult;
      let tx = 0;
      let ty = 0;
      if (len > 0.01) {
        tx = (inputX / len) * speed;
        ty = (inputY / len) * speed;
        const angle = Math.atan2(inputY, inputX);
        // Momentum: builds while holding a consistent heading.
        if (this.isMoving && Math.abs(angleDiff(this.moveAngle, angle)) < BALANCE.player.momentumAngleTolerance) {
          this.momentum = Math.min(1, this.momentum + dt / BALANCE.player.momentumBuildTime);
        } else {
          this.momentum *= 0.5;
        }
        this.moveAngle = angle;
        this.isMoving = true;
      } else {
        this.isMoving = false;
        this.momentum = Math.max(0, this.momentum - dt * 2);
      }
      const accel = this.def.accel * dt;
      this.vx = approach(this.vx, tx, accel);
      this.vy = approach(this.vy, ty, accel);
      this.x += (this.vx + this.kx) * dt;
      this.y += (this.vy + this.ky) * dt;
    }

    const kd = Math.exp(-10 * dt);
    this.kx *= kd;
    this.ky *= kd;

    // Facing: aim at the attack target briefly, otherwise follow movement.
    const turn = (this.def.id === 'raptor' ? 18 : this.def.id === 'trex' ? 9 : 7) * dt;
    if (this.dash) this.facing = this.dash.angle;
    else if (this.aimTimer > 0 && this.aimAngle !== null) this.facing = rotateTowards(this.facing, this.aimAngle, turn * 1.6);
    else if (this.isMoving) this.facing = rotateTowards(this.facing, this.moveAngle, turn);

    this.syncVisual(dt);
  }

  private syncVisual(dt: number): void {
    this.root.setPosition(this.x, this.y);
    const size = this.stats.get('size');
    this.root.setScale(size);
    this.bodyC.setRotation(this.facing);

    // Walk bob / squash
    const bob = this.isMoving ? Math.sin(this.time * (this.def.id === 'raptor' ? 26 : 14)) * 0.04 : 0;
    this.body.setScale(1 + bob, 1 - bob);

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.body.clearTint();
    }
    this.root.setAlpha(this.iFrames > 0 && !this.dash ? (Math.floor(this.time * 30) % 2 ? 0.55 : 1) : 1);

    if (this.auraColor !== null) {
      this.aura.setAlpha(0.35 + Math.sin(this.time * 4) * 0.12);
      this.aura.setRotation(this.time * 0.6);
    }
    if (this.visualTags.has('spikes')) this.extras.rotation = 0;
  }

  private spawnAfterImage(color: number): void {
    const img = this.scene.add.image(this.x, this.y, this.def.texture)
      .setRotation(this.facing)
      .setScale(this.stats.get('size'))
      .setTintFill(color)
      .setAlpha(0.45)
      .setDepth(49)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: img, alpha: 0, duration: 220, onComplete: () => img.destroy() });
  }

  /**
   * Rebuild the evolving body based on the build: spikes, plates, jaw, aura...
   * Visual tags come from upgrade definitions.
   */
  refreshVisuals(tags: Set<string>, auraColor: number | null): void {
    this.visualTags = tags;
    this.auraColor = auraColor;
    if (auraColor !== null) this.aura.setTint(auraColor);
    else this.aura.setAlpha(0);

    const g = this.extras;
    g.clear();
    const r = this.def.radius;

    if (tags.has('plates')) {
      g.fillStyle(0xd8d0b0, 1);
      g.lineStyle(1.5, 0x5a5040, 1);
      for (let i = 0; i < 4; i++) {
        const px = -r * 0.9 + i * r * 0.42;
        g.fillTriangle(px - 5, 0, px + 5, 0, px, -9);
        g.fillTriangle(px - 5, 0, px + 5, 0, px, 9);
      }
    }
    if (tags.has('spikes')) {
      g.fillStyle(0xf2ead0, 1);
      g.lineStyle(1, 0x3a3020, 1);
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const rr = r * 1.05;
        const x1 = Math.cos(a - 0.14) * rr;
        const y1 = Math.sin(a - 0.14) * rr;
        const x2 = Math.cos(a + 0.14) * rr;
        const y2 = Math.sin(a + 0.14) * rr;
        const x3 = Math.cos(a) * (rr + 11);
        const y3 = Math.sin(a) * (rr + 11);
        g.fillTriangle(x1, y1, x2, y2, x3, y3);
        g.strokeTriangle(x1, y1, x2, y2, x3, y3);
      }
    }
    if (tags.has('jaw')) {
      g.fillStyle(0xfff4e0, 1);
      const hx = r * 1.35;
      for (let i = 0; i < 4; i++) {
        g.fillTriangle(hx + i * 4, -7, hx + i * 4 + 3, -7, hx + i * 4 + 1.5, -2);
        g.fillTriangle(hx + i * 4, 7, hx + i * 4 + 3, 7, hx + i * 4 + 1.5, 2);
      }
    }
    if (tags.has('horns')) {
      g.fillStyle(0xfff0c8, 1);
      g.fillTriangle(r * 1.2, -8, r * 1.2, -2, r * 2.1, -12);
      g.fillTriangle(r * 1.2, 8, r * 1.2, 2, r * 2.1, 12);
    }
    if (tags.has('bleed')) {
      g.fillStyle(0xff2030, 0.9);
      g.fillCircle(r * 1.1, -4, 2.2);
      g.fillCircle(r * 1.1, 4, 2.2);
    }
    if (tags.has('crit')) {
      g.lineStyle(2, 0xffd84a, 0.9);
      g.strokeCircle(r * 1.1, -4, 3.2);
      g.strokeCircle(r * 1.1, 4, 3.2);
    }
    if (tags.has('acid')) {
      g.fillStyle(0x8cff40, 0.85);
      g.fillCircle(-r * 0.4, -r * 0.35, 3);
      g.fillCircle(-r * 0.1, r * 0.4, 2.5);
      g.fillCircle(r * 0.3, -r * 0.2, 2);
    }
    if (tags.has('colossus')) {
      g.lineStyle(3, 0x2a1a10, 0.8);
      g.strokeEllipse(0, 0, r * 2.4, r * 1.7);
    }
    if (tags.has('mutation')) {
      g.fillStyle(0xd040ff, 0.8);
      g.fillCircle(-r * 0.6, 0, 3.5);
      g.fillCircle(0, -r * 0.45, 3);
      g.fillCircle(r * 0.2, r * 0.4, 2.5);
    }
  }

  destroy(): void {
    this.root.destroy();
  }
}

function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}
