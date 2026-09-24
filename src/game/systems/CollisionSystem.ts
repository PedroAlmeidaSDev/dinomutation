import { BALANCE } from '../../data/balance';
import type { ObstacleDef } from '../../data/arena';
import type { RunContext } from '../core/RunContext';
import type { Enemy } from '../entities/enemies/Enemy';
import { SpatialGrid } from '../../utils/SpatialGrid';

/**
 * Circle-based collision: world bounds, static obstacles, enemy separation,
 * enemy↔player contact damage. Also owns the spatial grid used for queries.
 */
export class CollisionSystem {
  readonly grid = new SpatialGrid<Enemy>(80);
  private readonly minX: number;
  private readonly minY: number;
  private readonly maxX: number;
  private readonly maxY: number;

  constructor(private readonly ctx: RunContext, readonly obstacles: readonly ObstacleDef[]) {
    const w = BALANCE.world;
    this.minX = w.wallThickness;
    this.minY = w.wallThickness;
    this.maxX = w.width - w.wallThickness;
    this.maxY = w.height - w.wallThickness;
  }

  rebuildGrid(enemies: readonly Enemy[]): void {
    this.grid.clear();
    for (const e of enemies) if (!e.dead) this.grid.insert(e);
  }

  pointBlocked(x: number, y: number, r: number): boolean {
    for (const o of this.obstacles) {
      const dx = x - o.x;
      const dy = y - o.y;
      const rr = o.r + r;
      if (dx * dx + dy * dy < rr * rr) return true;
    }
    return false;
  }

  /** Push a circle out of obstacles and walls. Returns true if it was blocked. */
  private resolveStatic(obj: { x: number; y: number }, r: number): boolean {
    let blocked = false;
    for (const o of this.obstacles) {
      const dx = obj.x - o.x;
      const dy = obj.y - o.y;
      const rr = o.r + r;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.001;
        obj.x = o.x + (dx / d) * rr;
        obj.y = o.y + (dy / d) * rr;
        blocked = true;
      }
    }
    if (obj.x < this.minX + r) { obj.x = this.minX + r; blocked = true; }
    if (obj.y < this.minY + r) { obj.y = this.minY + r; blocked = true; }
    if (obj.x > this.maxX - r) { obj.x = this.maxX - r; blocked = true; }
    if (obj.y > this.maxY - r) { obj.y = this.maxY - r; blocked = true; }
    return blocked;
  }

  resolvePlayer(): void {
    const p = this.ctx.player;
    if (this.resolveStatic(p, p.radius * 0.85)) p.notifyBlocked();
  }

  resolveEnemies(enemies: readonly Enemy[]): void {
    // Enemy ↔ enemy separation
    const near: Enemy[] = [];
    for (const a of enemies) {
      if (a.dead || a.ignoreSeparation) continue;
      near.length = 0;
      this.grid.query(a.x, a.y, a.radius, near);
      for (const b of near) {
        if (b === a || b.dead || b.def.flying !== a.def.flying) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const overlap = (rr - d) * 0.5;
        const nx = dx / d;
        const ny = dy / d;
        const wa = b.ignoreSeparation ? 1 : 1 - a.mass * 0.8;
        const wb = b.ignoreSeparation ? 0 : 1 - b.mass * 0.8;
        a.x -= nx * overlap * wa;
        a.y -= ny * overlap * wa;
        b.x += nx * overlap * wb;
        b.y += ny * overlap * wb;
      }
    }
    // Static geometry
    for (const e of enemies) {
      if (e.dead) continue;
      if (e.def.flying) {
        e.x = Math.min(this.maxX, Math.max(this.minX, e.x));
        e.y = Math.min(this.maxY, Math.max(this.minY, e.y));
        continue;
      }
      if (this.resolveStatic(e, e.radius * 0.9) && e.ignoreSeparation) e.behavior.onBlocked?.(e, this.ctx);
    }
  }

  /** Enemies can't stand inside the player; touching deals contact damage. */
  resolvePlayerContacts(): void {
    const ctx = this.ctx;
    const p = ctx.player;
    if (!p.isAlive()) return;
    const hits = ctx.queryEnemies(p.x, p.y, p.radius);
    for (const e of hits) {
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const rr = p.radius + e.radius;
      if (d >= rr) continue;
      if (!p.isDashing && !e.ignoreSeparation) {
        // Push the enemy out (bosses push the player instead).
        const push = rr - d;
        if (e.isBossLike) {
          p.x -= (dx / d) * push * 0.6;
          p.y -= (dy / d) * push * 0.6;
          e.x += (dx / d) * push * 0.4;
          e.y += (dy / d) * push * 0.4;
        } else {
          e.x += (dx / d) * push;
          e.y += (dy / d) * push;
        }
      }
      if (e.contactCd > 0 || p.isDashing) continue;
      if (!ctx.status.canAct(e) || ctx.status.isFleeing(e)) continue;
      const charging = e.attackContactDamage > 0;
      const dmg = (charging ? e.attackContactDamage : e.def.contactDamage) * e.damageMult;
      if (dmg <= 0) continue;
      const taken = ctx.damage.hitPlayer({
        amount: dmg,
        attacker: e,
        tags: ['melee', 'contact'],
        knockAngle: charging ? e.facing : Math.atan2(p.y - e.y, p.x - e.x),
        knockForce: charging ? 520 : 120,
      });
      if (taken > 0 || charging) {
        e.contactCd = BALANCE.combat.contactCooldown;
        // Attackers bounce off the player: keeps melee dinos from being glued in place.
        if (!e.isBossLike) e.applyKnockback(Math.atan2(e.y - p.y, e.x - p.x), 240);
      }
    }
  }
}
