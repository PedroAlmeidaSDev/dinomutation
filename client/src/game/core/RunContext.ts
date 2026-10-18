import type Phaser from 'phaser';
import type { EventBus } from './EventBus';
import type { RunState } from './RunState';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/enemies/Enemy';
import type { DamageSystem } from '../combat/DamageSystem';
import type { StatusSystem } from '../statuses/StatusSystem';
import type { FX } from '../fx/FX';
import type { Telegraphs } from '../fx/Telegraphs';
import type { ProjectileSystem } from '../combat/ProjectileSystem';
import type { SummonSystem } from '../combat/SummonSystem';
import type { UpgradeSystem } from '../upgrades/UpgradeSystem';
import type { AbilitySystem } from '../abilities/AbilitySystem';
import type { PickupSystem } from '../systems/PickupSystem';
import type { SpawnSystem } from '../systems/SpawnSystem';
import type { CollisionSystem } from '../systems/CollisionSystem';
import type { RunDirector } from '../systems/RunDirector';
import type { XPSystem } from '../systems/XPSystem';

/**
 * The handle systems, enemies and upgrade effects use to talk to the running game.
 * Implemented by RunScene. Keeps systems decoupled from the scene class itself.
 */
export interface RunContext {
  scene: Phaser.Scene;
  bus: EventBus;
  run: RunState;
  player: Player;
  enemies: Enemy[];
  damage: DamageSystem;
  status: StatusSystem;
  fx: FX;
  telegraphs: Telegraphs;
  projectiles: ProjectileSystem;
  summons: SummonSystem;
  upgrades: UpgradeSystem;
  abilities: AbilitySystem;
  pickups: PickupSystem;
  spawner: SpawnSystem;
  collision: CollisionSystem;
  director: RunDirector;
  xp: XPSystem;

  queryEnemies(x: number, y: number, r: number): Enemy[];
  nearestEnemy(x: number, y: number, maxRange: number, filter?: (e: Enemy) => boolean): Enemy | undefined;
  /** Run a callback after the current frame's combat resolves (avoids deep recursive chains). */
  defer(fn: () => void): void;
  /** Very short freeze-frame for impact. */
  hitstop(seconds: number): void;
}
