import { BALANCE } from '../../data/balance';
import { DIRECTOR_CONFIG } from '../../data/director';
import { ENEMIES, type EnemyId } from '../../data/enemies';
import type { RunContext } from '../core/RunContext';
import type { Enemy } from '../entities/enemies/Enemy';
import { createEnemy } from '../entities/enemies/EnemyFactory';

/**
 * Creates enemies at valid positions. Knows nothing about *when* to spawn —
 * that is the RunDirector's job.
 */
export class SpawnSystem {
  constructor(private readonly ctx: RunContext) {}

  spawn(id: EnemyId, x: number, y: number): Enemy | null {
    const ctx = this.ctx;
    const def = ENEMIES[id];
    if (def.rank === 'normal' && ctx.enemies.length >= BALANCE.maxEnemies) return null;
    const scaling = def.rank === 'normal'
      ? ctx.director.scaling()
      : { hpMult: 1, damageMult: 1 };
    const e = createEnemy(ctx.scene, id, x, y, scaling);
    ctx.enemies.push(e);
    e.behavior.onSpawn?.(e, ctx);
    return e;
  }

  /** A random free position on the ring just outside the camera view. */
  ringPosition(angle?: number, spread = 0): { x: number; y: number } {
    const p = this.ctx.player;
    const W = BALANCE.world;
    const { min, max } = DIRECTOR_CONFIG.spawnRing;
    for (let i = 0; i < 12; i++) {
      const a = (angle ?? Math.random() * Math.PI * 2) + (Math.random() - 0.5) * spread;
      const d = min + Math.random() * (max - min);
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d;
      const m = W.wallThickness + 40;
      if (x < m || y < m || x > W.width - m || y > W.height - m) continue;
      if (this.ctx.collision.pointBlocked(x, y, 40)) continue;
      return { x, y };
    }
    // Fallback: clamp into the world.
    const a = Math.random() * Math.PI * 2;
    const m = W.wallThickness + 40;
    return {
      x: Math.min(W.width - m, Math.max(m, p.x + Math.cos(a) * min)),
      y: Math.min(W.height - m, Math.max(m, p.y + Math.sin(a) * min)),
    };
  }

  spawnOffscreen(id: EnemyId): Enemy | null {
    const pos = this.ringPosition();
    return this.spawn(id, pos.x, pos.y);
  }

  /** A pack coming from one direction. */
  spawnSwarm(id: EnemyId, count: number): void {
    const angle = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const pos = this.ringPosition(angle, 0.7);
      this.spawn(id, pos.x, pos.y);
    }
  }

  /** Enemies evenly encircling the player. */
  spawnRing(id: EnemyId, count: number): void {
    const p = this.ctx.player;
    const r = DIRECTOR_CONFIG.spawnRing.min * 0.85;
    const W = BALANCE.world;
    const m = W.wallThickness + 30;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x = Math.min(W.width - m, Math.max(m, p.x + Math.cos(a) * r));
      const y = Math.min(W.height - m, Math.max(m, p.y + Math.sin(a) * r));
      this.spawn(id, x, y);
    }
  }

  /** Spawn around a point (boss summons). Summons give no rewards by default. */
  spawnAround(id: EnemyId, x: number, y: number, count: number, radius: number, noRewards = true): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const e = this.spawn(id, x + Math.cos(a) * radius, y + Math.sin(a) * radius);
      if (!e) continue;
      e.noRewards = noRewards;
      this.ctx.fx.dust(e.x, e.y, 4);
    }
  }

  /** Move stragglers that drifted too far back into play. */
  recycleFar(): void {
    const p = this.ctx.player;
    for (const e of this.ctx.enemies) {
      if (e.dead || e.isBossLike) continue;
      if (Math.abs(e.x - p.x) + Math.abs(e.y - p.y) < BALANCE.recycleDistance) continue;
      const pos = this.ringPosition();
      e.x = pos.x;
      e.y = pos.y;
    }
  }
}
