import type { RunContext } from '../../core/RunContext';
import type { Enemy, EnemyBehavior } from './Enemy';

/** Tiny swarm critter: runs straight at the player with a jittery weave. */
export class CompyBehavior implements EnemyBehavior {
  private phase = Math.random() * 10;

  update(e: Enemy, dt: number, ctx: RunContext): void {
    this.phase += dt * 7;
    const wobble = Math.sin(this.phase) * e.def.params.wobble;
    e.moveAngle(e.angleToPlayer(ctx) + wobble, e.speed, dt, ctx);
  }
}
