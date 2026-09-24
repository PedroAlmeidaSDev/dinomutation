import type { AbilityId } from '../../data/dinosaurs';
import type { RunContext } from '../core/RunContext';

/** A dinosaur's SPACE ability. Implementations only describe what happens on activation. */
export interface Ability {
  readonly id: AbilityId;
  readonly name: string;
  readonly baseCooldown: number;
  readonly tags: readonly string[];
  activate(ctx: RunContext): void;
}
