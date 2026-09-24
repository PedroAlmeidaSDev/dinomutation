import { xpToNext } from '../../data/balance';
import type { RunContext } from '../core/RunContext';

/** DNA → XP → levels. Queues pending upgrade choices for the scene to present. */
export class XPSystem {
  level = 1;
  xp = 0;
  next = xpToNext(1);
  pendingLevelUps = 0;
  /** Rare choices granted by elite mutagens. */
  pendingRare = 0;

  constructor(private readonly ctx: RunContext) {}

  get progress(): number {
    return this.xp / this.next;
  }

  add(amount: number): void {
    this.xp += amount * this.ctx.player.stats.get('xpGain');
    while (this.xp >= this.next) {
      this.xp -= this.next;
      this.level++;
      this.next = xpToNext(this.level);
      this.pendingLevelUps++;
      this.ctx.bus.emit('onLevelUp', { level: this.level });
    }
    this.ctx.run.level = this.level;
    this.ctx.run.xp = this.xp;
  }

  get hasPending(): boolean {
    return this.pendingLevelUps > 0 || this.pendingRare > 0;
  }
}
