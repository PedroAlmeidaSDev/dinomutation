import Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import type { RunContext } from '../core/RunContext';

export type PickupKind = 'dna' | 'meat' | 'magnet' | 'mutagen';

export interface Pickup {
  kind: PickupKind;
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  value: number;
  magnet: boolean;
  speed: number;
  dead: boolean;
  age: number;
}

/** DNA orbs and special drops, with magnet pull toward the player. */
export class PickupSystem {
  private list: Pickup[] = [];

  constructor(private readonly ctx: RunContext) {}

  /** Pickups currently in the world (read-only; used by the pause minimap). */
  get active(): readonly Pickup[] {
    return this.list;
  }

  spawnDNA(x: number, y: number, value: number): void {
    // Merge into an existing orb if too many exist (keeps the count bounded).
    const dnaCount = this.list.length;
    if (dnaCount >= BALANCE.drops.maxOrbs) {
      const target = this.list.find((p) => p.kind === 'dna' && !p.magnet && !p.dead);
      if (target) {
        target.value += value;
        this.styleDNA(target);
        return;
      }
    }
    const p = this.create('dna', x + Phaser.Math.Between(-8, 8), y + Phaser.Math.Between(-8, 8), value);
    this.styleDNA(p);
  }

  spawn(kind: Exclude<PickupKind, 'dna'>, x: number, y: number): void {
    const p = this.create(kind, x, y, 0);
    if (kind === 'mutagen') {
      p.sprite.setScale(1.3);
      this.ctx.scene.tweens.add({ targets: p.sprite, scale: 1.6, yoyo: true, repeat: -1, duration: 500 });
    }
  }

  private create(kind: PickupKind, x: number, y: number, value: number): Pickup {
    const texture = kind === 'dna' ? 'dna1' : kind;
    const sprite = this.ctx.scene.add.image(x, y, texture).setDepth(12);
    const p: Pickup = { kind, sprite, x, y, value, magnet: false, speed: 0, dead: false, age: 0 };
    this.list.push(p);
    return p;
  }

  private styleDNA(p: Pickup): void {
    const tex = p.value >= 20 ? 'dna3' : p.value >= 5 ? 'dna2' : 'dna1';
    p.sprite.setTexture(tex);
  }

  magnetizeAll(): void {
    for (const p of this.list) if (p.kind === 'dna') p.magnet = true;
  }

  update(dt: number): void {
    const ctx = this.ctx;
    const pl = ctx.player;
    const range = pl.stats.get('pickupRange');
    for (const p of this.list) {
      if (p.dead) continue;
      p.age += dt;
      const dx = pl.x - p.x;
      const dy = pl.y - p.y;
      const d = Math.hypot(dx, dy);
      // The elite's mutagen always flies to the player after a short showcase.
      if (!p.magnet && (d < range || (p.kind === 'mutagen' && p.age > 1.2))) p.magnet = true;
      if (p.magnet && pl.isAlive()) {
        p.speed = Math.min(1100, p.speed + 1800 * dt);
        const step = Math.min(d, p.speed * dt);
        p.x += (dx / (d || 1)) * step;
        p.y += (dy / (d || 1)) * step;
      }
      p.sprite.setPosition(p.x, p.y + Math.sin(p.age * 5 + p.x) * 2);
      if (d < pl.radius + 8 && pl.isAlive()) this.collect(p);
    }
    if (this.list.some((p) => p.dead)) {
      for (const p of this.list) if (p.dead) p.sprite.destroy();
      this.list = this.list.filter((p) => !p.dead);
    }
  }

  private collect(p: Pickup): void {
    const ctx = this.ctx;
    p.dead = true;
    switch (p.kind) {
      case 'dna':
        ctx.xp.add(p.value);
        ctx.fx.dnaCollect(p.x, p.y);
        break;
      case 'meat': {
        const healed = ctx.player.health.heal(ctx.player.health.max * BALANCE.drops.meatHealPercent);
        ctx.fx.floatText(p.x, p.y - 20, `+${Math.round(healed)} HP`, '#6aff8a', 18);
        break;
      }
      case 'magnet':
        this.magnetizeAll();
        ctx.fx.floatText(p.x, p.y - 20, 'ÍMÃ DE DNA!', '#60ffd0', 18);
        break;
      case 'mutagen':
        ctx.xp.pendingRare++;
        ctx.fx.levelUp(p.x, p.y);
        ctx.fx.floatText(p.x, p.y - 30, 'MUTAGÊNICO RARO!', '#d070ff', 22);
        break;
    }
  }

  clear(): void {
    for (const p of this.list) p.sprite.destroy();
    this.list = [];
  }
}
