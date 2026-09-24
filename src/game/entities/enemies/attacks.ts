import type { RunContext } from '../../core/RunContext';
import { circleInCone } from '../../../utils/math';
import type { Enemy } from './Enemy';

/** Shared geometry helpers for enemy attacks, so every telegraphed hit resolves the same way. */

export function resolveCone(
  ctx: RunContext, e: Enemy, angle: number, arc: number, reach: number, damage: number, knockForce: number,
): boolean {
  const p = ctx.player;
  if (!circleInCone(p.x, p.y, p.radius, e.x, e.y, angle, arc, reach)) return false;
  ctx.damage.hitPlayer({
    amount: damage * e.damageMult,
    attacker: e,
    tags: ['melee', 'heavy'],
    knockAngle: Math.atan2(p.y - e.y, p.x - e.x),
    knockForce,
  });
  return true;
}

export function resolveCircle(
  ctx: RunContext, e: Enemy, x: number, y: number, r: number, damage: number, knockForce: number, melee = true,
): boolean {
  const p = ctx.player;
  if (Math.hypot(p.x - x, p.y - y) > r + p.radius) return false;
  ctx.damage.hitPlayer({
    amount: damage * e.damageMult,
    attacker: e,
    tags: melee ? ['melee', 'aoe'] : ['aoe'],
    knockAngle: Math.atan2(p.y - y, p.x - x),
    knockForce,
  });
  return true;
}

export function slamFx(ctx: RunContext, x: number, y: number, radius: number, color = 0xffa060): void {
  ctx.fx.ring(x, y, radius, color, 320);
  ctx.fx.dust(x, y, 14);
  const dist = Math.hypot(ctx.player.x - x, ctx.player.y - y);
  if (dist < 600) ctx.fx.shake(0.005, 140);
}
