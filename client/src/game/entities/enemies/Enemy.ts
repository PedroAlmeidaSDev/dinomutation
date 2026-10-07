import Phaser from 'phaser';
import { BALANCE } from '../../../data/balance';
import type { EnemyDef } from '../../../data/enemies';
import type { RunContext } from '../../core/RunContext';
import type { TelegraphHandle } from '../../fx/Telegraphs';
import type { StatusHost, StatusId, StatusInstance } from '../../statuses/StatusDefinitions';
import { rotateTowards } from '../../../utils/math';

/** Per-enemy AI. Each enemy owns its own behaviour instance (and its state). */
export interface EnemyBehavior {
  onSpawn?(e: Enemy, ctx: RunContext): void;
  update(e: Enemy, dt: number, ctx: RunContext): void;
  onDeath?(e: Enemy, ctx: RunContext): void;
  /** The enemy ran into an obstacle or wall (used to stop charges). */
  onBlocked?(e: Enemy, ctx: RunContext): void;
}

export interface EnemyScaling {
  hpMult: number;
  damageMult: number;
  /** Movement speed multiplier (endless mode). */
  speedMult?: number;
  /** Flat armor bonus (endless mutation Pele Grossa). */
  armorAdd?: number;
}

export class Enemy implements StatusHost {
  readonly kind = 'enemy' as const;
  x: number;
  y: number;
  statuses = new Map<StatusId, StatusInstance>();
  ccResist: number;

  hp: number;
  maxHp: number;
  readonly radius: number;
  readonly speed: number;
  readonly armor: number;
  /** Mutable so bosses can enrage mid-fight. */
  damageMult: number;
  readonly mass: number;
  /** Boss minions: drop nothing and don't feed on-kill upgrades (Voracidade etc.). */
  noRewards = false;
  /** Incoming damage multiplier (bosses' vulnerable windows). */
  damageTakenMult = 1;
  dead = false;
  /** Set when the object has been removed from the world. */
  removed = false;
  contactCd = 0;
  /** Behaviours set this while an attack deals contact damage (charges, lunges). */
  attackContactDamage = 0;
  facing = 0;
  /** Disables separation / pushing (e.g. while charging). */
  ignoreSeparation = false;

  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly extras: Phaser.GameObjects.Container;
  private kx = 0;
  private ky = 0;
  private flashTimer = 0;
  private baseScale: number;
  private bobTime = Math.random() * 10;
  private telegraphs: TelegraphHandle[] = [];
  private tintColor: number | null = null;

  constructor(
    readonly scene: Phaser.Scene,
    readonly def: EnemyDef,
    x: number,
    y: number,
    scaling: EnemyScaling,
    readonly behavior: EnemyBehavior,
  ) {
    this.x = x;
    this.y = y;
    this.maxHp = Math.round(def.hp * scaling.hpMult);
    this.hp = this.maxHp;
    this.radius = def.radius;
    this.speed = def.speed * (scaling.speedMult ?? 1);
    this.armor = def.armor + (scaling.armorAdd ?? 0);
    this.mass = def.mass;
    this.damageMult = scaling.damageMult;
    this.ccResist = def.rank === 'boss' ? 0.75 : def.rank === 'elite' ? 0.5 : 0;
    this.baseScale = def.scale ?? 1;

    const shadowOffset = def.flying ? 26 : 5;
    this.shadow = scene.add.ellipse(x, y + shadowOffset, def.radius * 2.2, def.radius * 1.2, 0x000000, def.flying ? 0.18 : 0.25);
    this.shadow.setDepth(def.flying ? 5 : 9);
    this.sprite = scene.add.image(x, y, def.texture).setScale(this.baseScale);
    this.sprite.setDepth(def.flying ? 70 : def.rank === 'normal' ? 20 : 30);
    this.extras = scene.add.container(x, y);
    this.extras.setDepth(this.sprite.depth - 1);
  }

  get isBossLike(): boolean {
    return this.def.rank !== 'normal';
  }

  get hpRatio(): number {
    return this.hp / this.maxHp;
  }

  isAlive(): boolean {
    return !this.dead && this.hp > 0;
  }

  takeDamage(amount: number): number {
    const applied = Math.min(this.hp, amount);
    this.hp -= applied;
    return applied;
  }

  flash(): void {
    // Big enemies get hit constantly: a soft red pulse instead of a full white flash,
    // so they don't stay permanently white.
    if (this.isBossLike) {
      if (this.flashTimer > -0.12) return;
      this.flashTimer = 0.05;
      this.sprite.setTint(0xff8a80);
      return;
    }
    this.flashTimer = BALANCE.combat.hitFlashTime;
    this.sprite.setTintFill(0xffffff);
  }

  /** Persistent tint (elite aura, boss rage). */
  setBaseTint(color: number | null): void {
    this.tintColor = color;
    if (this.flashTimer <= 0) this.applyTint();
  }

  private applyTint(): void {
    if (this.tintColor !== null) this.sprite.setTint(this.tintColor);
    else this.sprite.clearTint();
  }

  applyKnockback(angle: number, force: number): void {
    const f = force * (1 - this.mass);
    if (f <= 0) return;
    this.kx += Math.cos(angle) * f;
    this.ky += Math.sin(angle) * f;
  }

  trackTelegraph(t: TelegraphHandle): TelegraphHandle {
    this.telegraphs.push(t);
    return t;
  }

  angleToPlayer(ctx: RunContext): number {
    return Math.atan2(ctx.player.y - this.y, ctx.player.x - this.x);
  }

  distToPlayer(ctx: RunContext): number {
    return Math.hypot(ctx.player.x - this.x, ctx.player.y - this.y);
  }

  /** Move along an angle, respecting slows/stuns. */
  moveAngle(angle: number, speed: number, dt: number, ctx: RunContext, face = true): void {
    const s = speed * ctx.status.moveMult(this);
    this.x += Math.cos(angle) * s * dt;
    this.y += Math.sin(angle) * s * dt;
    if (face) this.faceTowards(angle, dt);
  }

  moveToward(tx: number, ty: number, speedMult: number, dt: number, ctx: RunContext): void {
    this.moveAngle(Math.atan2(ty - this.y, tx - this.x), this.speed * speedMult, dt, ctx);
  }

  faceTowards(angle: number, dt: number, turnRate = 10): void {
    this.facing = rotateTowards(this.facing, angle, turnRate * dt);
  }

  update(dt: number, ctx: RunContext): void {
    if (this.contactCd > 0) this.contactCd -= dt;

    if (!ctx.status.canAct(this)) {
      // stunned: wobble in place
      this.bobTime += dt * 30;
    } else if (ctx.status.isFleeing(this) && !this.isBossLike) {
      const away = this.angleToPlayer(ctx) + Math.PI;
      this.moveAngle(away, this.speed * 0.9, dt, ctx);
    } else {
      this.behavior.update(this, dt, ctx);
    }

    this.x += this.kx * dt;
    this.y += this.ky * dt;
    const kd = Math.exp(-9 * dt);
    this.kx *= kd;
    this.ky *= kd;

    this.sync(dt, ctx);
  }

  private sync(dt: number, ctx: RunContext): void {
    this.bobTime += dt;
    const flying = this.def.flying;
    const bob = flying ? Math.sin(this.bobTime * 6) * 3 : 0;
    this.sprite.setPosition(this.x, this.y + bob);
    this.sprite.setRotation(this.facing);
    this.extras.setPosition(this.x, this.y);
    this.shadow.setPosition(this.x, this.y + (flying ? 26 : 5));

    const stunned = ctx.status.has(this, 'stun');
    if (stunned) this.sprite.setRotation(this.facing + Math.sin(this.bobTime * 3) * 0.15);

    // flashTimer > 0: flashing. Below 0 it keeps counting down as the boss pulse cooldown.
    const wasFlashing = this.flashTimer > 0;
    if (this.flashTimer > -1) this.flashTimer -= dt;
    if (wasFlashing && this.flashTimer <= 0) this.applyTint();
    if (this.flashTimer <= 0 && this.tintColor === null) {
      // status tint feedback
      if (ctx.status.has(this, 'poison')) this.sprite.setTint(0xb0ff90);
      else if (ctx.status.has(this, 'fear')) this.sprite.setTint(0xd0a0ff);
      else if (ctx.status.has(this, 'slow')) this.sprite.setTint(0xa0d0ff);
      else this.sprite.clearTint();
    }
  }

  /** Called once when the enemy dies or is despawned. */
  destroy(ctx?: RunContext): void {
    if (this.removed) return;
    this.removed = true;
    if (ctx) this.behavior.onDeath?.(this, ctx);
    for (const t of this.telegraphs) t.cancel();
    this.telegraphs.length = 0;
    this.sprite.destroy();
    this.shadow.destroy();
    this.extras.destroy();
  }
}
