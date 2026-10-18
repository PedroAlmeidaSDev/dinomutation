import { BALANCE } from '../../data/balance';
import { DIFFICULTY_BY_ID } from '../../data/difficulty';
import { DIRECTOR_CONFIG, type DirectorEvent, type SpawnPhase } from '../../data/director';
import type { EnemyId, EnemyRank } from '../../data/enemies';
import type { RunContext } from '../core/RunContext';
import type { Enemy, EnemyScaling } from '../entities/enemies/Enemy';
import { randInt, weightedPick } from '../../utils/math';
import { EndlessDirector } from './EndlessDirector';

/**
 * Single owner of run pacing: time, spawn rate, enemy mix, events, elite and boss.
 * No other class keeps spawn timers. After the story boss, pacing can be handed to
 * an EndlessDirector (endless mode).
 */
export class RunDirector {
  /** Set once the player continues into the endless mode. */
  endless: EndlessDirector | null = null;
  elapsed = 0;
  private spawnTimer = 1;
  private recycleTimer = 2;
  private firedEvents = new Set<DirectorEvent>();
  private eliteWarned = false;
  private bossWarned = false;
  eliteSpawned = false;
  bossSpawned = false;
  boss: Enemy | null = null;
  elite: Enemy | null = null;

  constructor(private readonly ctx: RunContext) {}

  get phase(): SpawnPhase {
    const phases = DIRECTOR_CONFIG.phases;
    let current = phases[0];
    for (const p of phases) if (this.elapsed >= p.start) current = p;
    return current;
  }

  get minutes(): number {
    return this.elapsed / 60;
  }

  /**
   * Enemy stat multipliers. Story: normal enemies grow over time, elite/boss are fixed.
   * The run's difficulty multiplies on top (also in the endless mode).
   */
  scaling(rank: EnemyRank = 'normal'): EnemyScaling {
    const d = DIFFICULTY_BY_ID[this.ctx.run.difficulty];
    const base = this.baseScaling(rank);
    return rank === 'boss'
      ? { ...base, hpMult: base.hpMult * d.bossHp, damageMult: base.damageMult * d.bossDamage }
      : { ...base, hpMult: base.hpMult * d.enemyHp, damageMult: base.damageMult * d.enemyDamage };
  }

  private baseScaling(rank: EnemyRank): EnemyScaling {
    if (this.endless) return this.endless.scaling(rank);
    if (rank === 'boss') return { ...BALANCE.bossScaling };
    if (rank !== 'normal') return { hpMult: 1, damageMult: 1 };
    return this.storyScaling(this.minutes);
  }

  private storyScaling(m: number): EnemyScaling {
    const S = BALANCE.enemyScaling;
    return {
      hpMult: 1 + S.hpPerMinute * m + S.hpPerMinuteSq * m * m,
      damageMult: 1 + S.damagePerMinute * m,
    };
  }

  /** Hand pacing over to the endless mode (after the story boss). */
  startEndless(): void {
    if (this.endless) return;
    this.boss = null;
    this.elite = null;
    this.endless = new EndlessDirector(this.ctx, this.storyScaling(DIRECTOR_CONFIG.bossTime / 60));
    this.ctx.run.endless = true;
    this.ctx.bus.emit('banner', { text: 'ERA SEM FIM', sub: 'Era 1 — sobreviva o quanto puder', color: 0xd070ff });
  }

  update(dt: number): void {
    const ctx = this.ctx;
    this.elapsed += dt;
    ctx.run.elapsedTime = this.elapsed;
    if (this.endless) {
      this.endless.update(dt);
      this.recycle(dt);
      return;
    }
    const cfg = DIRECTOR_CONFIG;

    // Regular spawns
    const phase = this.phase;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = phase.interval;
      const alive = ctx.enemies.length;
      if (alive < phase.maxAlive) {
        const n = Math.min(randInt(phase.batch[0], phase.batch[1]), phase.maxAlive - alive);
        const entries = Object.entries(phase.pool) as [EnemyId, number][];
        for (let i = 0; i < n; i++) {
          const pick = weightedPick(entries, ([, w]) => w);
          if (pick) ctx.spawner.spawnOffscreen(pick[0]);
        }
      }
    }

    // Scripted events
    for (const ev of cfg.events) {
      if (this.firedEvents.has(ev) || this.elapsed < ev.time || this.bossSpawned) continue;
      this.firedEvents.add(ev);
      if (ev.type === 'ring') ctx.spawner.spawnRing(ev.enemy, ev.count);
      else ctx.spawner.spawnSwarm(ev.enemy, ev.count);
      if (ev.banner) ctx.bus.emit('banner', { text: ev.banner, color: 0xffc070 });
    }

    // Elite
    if (!this.eliteWarned && this.elapsed >= cfg.eliteTime - cfg.warningTime) {
      this.eliteWarned = true;
      ctx.bus.emit('banner', { text: '⚠ ELITE SE APROXIMA', sub: 'Carnotaurus Alfa', color: 0xff5030 });
    }
    if (!this.eliteSpawned && this.elapsed >= cfg.eliteTime) this.spawnElite();

    // Boss
    if (!this.bossWarned && this.elapsed >= cfg.bossTime - cfg.warningTime) {
      this.bossWarned = true;
      ctx.bus.emit('banner', { text: 'O CHÃO TREME...', sub: 'Algo gigantesco está vindo', color: 0xff3020 });
      ctx.fx.shake(0.004, 1500);
    }
    if (!this.bossSpawned && this.elapsed >= cfg.bossTime) this.spawnBoss();

    this.recycle(dt);
  }

  private recycle(dt: number): void {
    this.recycleTimer -= dt;
    if (this.recycleTimer <= 0) {
      this.recycleTimer = 2;
      this.ctx.spawner.recycleFar();
    }
  }

  spawnElite(): void {
    if (this.endless) return this.endless.spawnElites();
    if (this.eliteSpawned) return;
    this.eliteSpawned = true;
    const pos = this.ctx.spawner.ringPosition();
    this.elite = this.ctx.spawner.spawn('carnoAlpha', pos.x, pos.y);
    this.ctx.bus.emit('banner', { text: 'CARNOTAURUS ALFA', sub: 'Derrote-o para um mutagênico raro', color: 0xff5030 });
  }

  spawnBoss(): void {
    if (this.endless) return this.endless.spawnBoss();
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    this.eliteSpawned = true;
    const pos = this.ctx.spawner.ringPosition();
    this.boss = this.ctx.spawner.spawn('giganotosaurus', pos.x, pos.y);
    this.ctx.bus.emit('banner', { text: 'GIGANOTOSAURUS', sub: 'O predador supremo', color: 0xff2010 });
    this.ctx.fx.shake(0.01, 800);
  }

  /** Debug: jump forward in time. */
  skip(seconds: number): void {
    this.elapsed += seconds;
    if (this.endless) this.endless.eraClock += seconds;
  }
}
