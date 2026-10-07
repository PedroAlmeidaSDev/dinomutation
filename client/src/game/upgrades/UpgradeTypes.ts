import type { Rarity } from '../../data/balance';
import type { DinoId } from '../../data/dinosaurs';
import type { ModMode, StatKey } from '../components/StatsComponent';
import type { StatusId } from '../statuses/StatusDefinitions';

/** Events/hooks a trigger effect can listen to. Names match EventBus events where applicable. */
export type TriggerName =
  | 'onAttack'
  | 'onHit'
  | 'onCrit'
  | 'onKill'
  | 'onEnemyDeath'
  | 'onDamageTaken'
  | 'onAbilityUse'
  | 'onDash'
  | 'onDashHit'
  | 'onDashEnd'
  | 'onLevelUp'
  | 'onStatusApplied'
  /** Every simulation frame. */
  | 'tick'
  /** Synchronous hook into the outgoing damage pipeline (payload: DamageCalc). */
  | 'modifyDamage'
  /** Synchronous hook into incoming damage (payload: IncomingCalc). */
  | 'modifyIncoming';

export type EffectParams = Record<string, number | string>;

export type EffectDefinition =
  /** Permanent stat modifier. Value is multiplied by upgrade power (level). */
  | { type: 'stat'; stat: StatKey; mode: ModMode; value: number }
  /** Chance to apply a status when an attack with any of `tags` hits. Chance and stacks scale with power. */
  | { type: 'statusOnHit'; status: StatusId; chance: number; stacks: number; duration?: number; tags?: string[] }
  /** Named handler from UpgradeEffects, subscribed to `trigger`. */
  | { type: 'trigger'; trigger: TriggerName; effect: string; params?: EffectParams }
  /** Mechanic switch read by systems (e.g. 'carnage'). */
  | { type: 'flag'; flag: string }
  /** Instant heal (consumable cards). */
  | { type: 'heal'; percent: number };

export interface UpgradeRequirements {
  dinos?: DinoId[];
  /** Any of these must be in the basic attack's tags. */
  attackTags?: string[];
  /** Any of these must be in the ability's tags. */
  abilityTags?: string[];
  /** All of these upgrades must be owned. */
  upgrades?: string[];
  /** Any of these tags must be present in the build (owned upgrades or innate). */
  ownedTags?: string[];
  minUpgrades?: number;
}

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  tags: string[];
  maxLevel: number;
  requires?: UpgradeRequirements;
  effects: EffectDefinition[];
  /** Visual changes on the player body (spikes, plates, jaw...). */
  visual?: string[];
  /** Tag used to draw the card icon (defaults to first tag). */
  icon?: string;
  /** Only offered when nothing else is available. */
  consumable?: boolean;
}
