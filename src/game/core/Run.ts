import type Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { ARENA_OBSTACLES } from '../../data/arena';
import { DINOSAURS, type DinoId } from '../../data/dinosaurs';
import { AbilitySystem } from '../abilities/AbilitySystem';
import { AutoAttackSystem } from '../combat/AutoAttackSystem';
import { DamageSystem } from '../combat/DamageSystem';
import { ProjectileSystem } from '../combat/ProjectileSystem';
import { SummonSystem } from '../combat/SummonSystem';
import type { Enemy } from '../entities/enemies/Enemy';
import { Player } from '../entities/Player';
import { FX } from '../fx/FX';
import { Telegraphs } from '../fx/Telegraphs';
import { StatusSystem } from '../statuses/StatusSystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import { PickupSystem } from '../systems/PickupSystem';
import { RunDirector } from '../systems/RunDirector';
import { SpawnSystem } from '../systems/SpawnSystem';
import { XPSystem } from '../systems/XPSystem';
import { UpgradeSystem } from '../upgrades/UpgradeSystem';
import { EventBus } from './EventBus';
import type { RunContext } from './RunContext';
import { createRunState, type RunState } from './RunState';

export type RunOutcome = 'victory' | 'defeat' | null;

/**
 * One run of the game: builds every system, wires them through the RunContext
 * and advances the simulation. Rendering-agnostic apart from the Phaser scene handle.
 */
export class Run implements RunContext {
  readonly bus = new EventBus();
  readonly run: RunState;
  readonly enemies: Enemy[] = [];
  readonly player: Player;
  readonly fx: FX;
  readonly telegraphs: Telegraphs;
  readonly damage: DamageSystem;
  readonly status: StatusSystem;
  readonly projectiles: ProjectileSystem;
  readonly summons: SummonSystem;
  readonly upgrades: UpgradeSystem;
  readonly abilities: AbilitySystem;
  readonly pickups: PickupSystem;
  readonly spawner: SpawnSystem;
  readonly collision: CollisionSystem;
  readonly director: RunDirector;
  readonly xp: XPSystem;
  readonly autoAttack: AutoAttackSystem;

  hitstopTimer = 0;
  outcome: RunOutcome = null;
  private deferred: (() => void)[] = [];
  private statusHosts: (Player | Enemy)[] = [];

  constructor(readonly scene: Phaser.Scene, dinoId: DinoId) {
    const def = DINOSAURS[dinoId];
    this.run = createRunState(dinoId);
    this.fx = new FX(scene);
    this.telegraphs = new Telegraphs(scene);
    this.player = new Player(scene, def, BALANCE.world.width / 2, BALANCE.world.height / 2);
    this.collision = new CollisionSystem(this, ARENA_OBSTACLES);
    this.damage = new DamageSystem(this);
    this.status = new StatusSystem(this);
    this.projectiles = new ProjectileSystem(this);
    this.summons = new SummonSystem(this);
    this.xp = new XPSystem(this);
    this.upgrades = new UpgradeSystem(this, def);
    this.abilities = new AbilitySystem(this, def.ability);
    this.pickups = new PickupSystem(this);
    this.spawner = new SpawnSystem(this);
    this.director = new RunDirector(this);
    this.autoAttack = new AutoAttackSystem(this);

    this.bus.on('onKill', ({ enemy }) => this.handleKill(enemy));
  }

  // ─────────────────────────── RunContext helpers ───────────────────────────

  queryEnemies(x: number, y: number, r: number): Enemy[] {
    return this.collision.grid.query(x, y, r);
  }

  nearestEnemy(x: number, y: number, maxRange: number, filter?: (e: Enemy) => boolean): Enemy | undefined {
    let best: Enemy | undefined;
    let bestD = Infinity;
    for (const e of this.collision.grid.query(x, y, maxRange)) {
      if (e.dead || (filter && !filter(e))) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.radius;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  defer(fn: () => void): void {
    this.deferred.push(fn);
  }

  hitstop(seconds: number): void {
    this.hitstopTimer = Math.min(0.12, Math.max(this.hitstopTimer, seconds));
  }

  // ─────────────────────────── simulation ───────────────────────────

  update(dt: number, inputX: number, inputY: number): void {
    const p = this.player;
    if (p.isAlive()) {
      p.update(dt, inputX, inputY, this.status.moveMult(p));
      this.collision.resolvePlayer();
    }

    // Between the story boss dying and the player choosing to go endless, nothing spawns.
    const awaitingChoice = this.run.bossKilled && !this.director.endless;
    if (!this.outcome && !awaitingChoice) this.director.update(dt);

    for (const e of this.enemies) if (!e.dead) e.update(dt, this);
    this.collision.rebuildGrid(this.enemies);
    this.collision.resolveEnemies(this.enemies);
    this.collision.resolvePlayerContacts();

    if (p.isDashing) p.updateDashHits(this.queryEnemies(p.x, p.y, p.dashHitRadius));
    if (p.isAlive()) this.autoAttack.update(dt);
    this.summons.update(dt);
    this.projectiles.update(dt);

    this.statusHosts.length = 0;
    this.statusHosts.push(p);
    for (const e of this.enemies) if (!e.dead) this.statusHosts.push(e);
    this.status.update(dt, this.statusHosts);

    this.abilities.update(dt);
    p.stats.update(dt);
    this.bus.emit('tick', { dt });
    this.telegraphs.update(dt);
    this.pickups.update(dt);

    for (let pass = 0; pass < 6 && this.deferred.length; pass++) {
      const batch = this.deferred;
      this.deferred = [];
      for (const fn of batch) fn();
    }

    this.removeDead();

    if (!this.outcome && p.health.current <= 0) {
      p.markDead();
      this.outcome = 'defeat';
    }
  }

  private handleKill(enemy: Enemy): void {
    const run = this.run;
    run.kills++;
    const bleeding = this.status.has(enemy, 'bleed');
    this.fx.enemyDeath(enemy.x, enemy.y, enemy.radius, bleeding);

    if (enemy.def.rank === 'boss') {
      const endless = this.director.endless;
      if (endless) {
        // Era boss: next Era plus a guaranteed legendary pick.
        endless.onBossKilled();
        this.xp.pendingLegendary++;
      } else {
        // Story boss: the win is recorded now; the scene asks whether to end or go endless.
        run.bossKilled = true;
        run.victory = true;
        this.bus.emit('storyBossDefeated', {});
      }
      this.fx.bigExplosion(enemy.x, enemy.y);
      this.fx.shake(0.02, 900);
      this.hitstop(0.12);
      this.defer(() => {
        for (const e of this.enemies) {
          if (e.dead) continue;
          e.dead = true;
          this.fx.enemyDeath(e.x, e.y, e.radius, false);
        }
      });
    } else if (enemy.def.rank === 'elite') {
      run.eliteKilled = true;
      this.pickups.spawn('mutagen', enemy.x, enemy.y);
      for (let i = 0; i < 6; i++) this.pickups.spawnDNA(enemy.x + (Math.random() - 0.5) * 80, enemy.y + (Math.random() - 0.5) * 80, enemy.def.xp / 6);
      this.fx.explosion(enemy.x, enemy.y, 180, 0xff5030, 'blood');
      this.fx.shake(0.012, 400);
      this.hitstop(0.1);
      this.bus.emit('banner', { text: 'ELITE DERROTADA!', sub: 'Colete o mutagênico', color: 0xd070ff });
    } else if (!enemy.noRewards) {
      this.pickups.spawnDNA(enemy.x, enemy.y, enemy.def.xp);
      const drought = this.director.endless?.has('drought') ?? false;
      if (!drought && Math.random() < BALANCE.drops.meatChance) this.pickups.spawn('meat', enemy.x, enemy.y);
      else if (Math.random() < BALANCE.drops.magnetChance) this.pickups.spawn('magnet', enemy.x, enemy.y);
      if (enemy.def.id === 'carnotaurus') this.fx.shake(BALANCE.feel.shakeLight, 100);
    }
    this.bus.emit('onEnemyDeath', { enemy });
  }

  private removeDead(): void {
    let any = false;
    for (const e of this.enemies) {
      if (e.dead) {
        e.destroy(this);
        any = true;
      }
    }
    if (!any) return;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].removed) this.enemies.splice(i, 1);
    }
    if (this.director.boss?.removed) this.director.boss = null;
    // Endless Eras can field several elites: the HUD bar moves on to the next one alive.
    if (this.director.elite?.removed) this.director.elite = this.enemies.find((e) => e.def.rank === 'elite' && !e.dead) ?? null;
  }

  // ─────────────────────────── debug ───────────────────────────

  debugLevelUp(): void {
    this.xp.add(Math.ceil((this.xp.next - this.xp.xp) / this.player.stats.get('xpGain')) + 0.01);
  }

  debugKillAll(): void {
    for (const e of [...this.enemies]) {
      if (e.dead) continue;
      this.damage.hitEnemy({ target: e, base: e.hp + 99999, tags: ['debug'], rawBase: true, canCrit: false, noProcs: true });
    }
  }

  destroy(): void {
    this.upgrades.destroy();
    this.bus.clear();
    this.telegraphs.clear();
    this.projectiles.clear();
    this.summons.clear();
    this.pickups.clear();
    for (const e of this.enemies) e.destroy();
    this.enemies.length = 0;
    this.player.destroy();
  }
}
