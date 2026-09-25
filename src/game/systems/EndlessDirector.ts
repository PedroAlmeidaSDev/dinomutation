import { BALANCE } from '../../data/balance';
import { ENDLESS_CONFIG, ERA_MUTATIONS, type EndlessPhase, type EraMutationId } from '../../data/endless';
import { ENEMIES, type EnemyId, type EnemyRank } from '../../data/enemies';
import type { RunContext } from '../core/RunContext';
import type { Enemy, EnemyScaling } from '../entities/enemies/Enemy';
import { randInt, weightedPick } from '../../utils/math';

interface Meteor { x: number; y: number; t: number }

/**
 * Pacing of the endless mode ("Era Sem Fim"). Owned by RunDirector once the player
 * chooses to continue after the story boss. Each Era: horde → event → elites → boss;
 * killing the boss advances the Era.
 */
export class EndlessDirector {
  era = 1;
  /** Seconds into the current Era (stops while the Era boss is alive). */
  eraClock = 0;
  readonly mutations: EraMutationId[] = [];
  private calm: number = ENDLESS_CONFIG.calmTime;
  private spawnTimer = 0;
  private pool: [EnemyId, number][] = [];
  private eventFired = false;
  private eliteWarned = false;
  private elitesSpawned = false;
  private bossWarned = false;
  bossSpawned = false;
  private meteorTimer: number = ENDLESS_CONFIG.meteor.interval;
  private meteors: Meteor[] = [];

  /**
   * @param base Normal-enemy multipliers at the end of the story; Era growth stacks on top.
   */
  constructor(
    private readonly ctx: RunContext,
    private readonly base: { hpMult: number; damageMult: number },
  ) {
    this.rollPool();
    this.syncRunState();
  }

  has(m: EraMutationId): boolean {
    return this.mutations.includes(m);
  }

  /** Continuous Era progress: 0 at the start of Era 1, 1 at the start of Era 2... */
  private get progress(): number {
    return this.era - 1 + Math.min(1, this.eraClock / ENDLESS_CONFIG.eraLength);
  }

  scaling(rank: EnemyRank): EnemyScaling {
    const C = ENDLESS_CONFIG;
    const armorAdd = this.has('thickSkin') ? 20 : 0;
    if (rank !== 'normal') {
      // Bosses/elites step up once per Era.
      const n = this.era - 1;
      return { hpMult: Math.pow(C.hpPerEra, n), damageMult: Math.pow(C.damagePerEra, n), armorAdd };
    }
    const p = this.progress;
    return {
      hpMult: this.base.hpMult * Math.pow(C.hpPerEra, p),
      damageMult: this.base.damageMult * Math.pow(C.damagePerEra, p),
      speedMult: 1 + Math.min(C.speedMax, C.speedPerEra * p) + (this.has('feral') ? 0.2 : 0),
      armorAdd,
    };
  }

  private get phase(): EndlessPhase {
    let current = ENDLESS_CONFIG.phases[0];
    for (const p of ENDLESS_CONFIG.phases) if (this.eraClock >= p.start) current = p;
    return current;
  }

  update(dt: number): void {
    const ctx = this.ctx;
    const C = ENDLESS_CONFIG;
    ctx.run.endlessTime += dt;
    this.updateMeteors(dt);

    if (this.calm > 0) {
      this.calm -= dt;
      return;
    }
    if (!this.bossSpawned) this.eraClock += dt;

    // Horde
    const phase = this.phase;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const eraMult = Math.max(C.minIntervalMult, Math.pow(C.intervalPerEra, this.era - 1));
      this.spawnTimer = phase.interval * eraMult / (this.has('swarm') ? 1.35 : 1);
      const maxAlive = Math.min(phase.maxAlive, BALANCE.maxEnemies - 10);
      const alive = ctx.enemies.length;
      if (alive < maxAlive) {
        const n = Math.min(randInt(phase.batch[0], phase.batch[1]), maxAlive - alive);
        for (let i = 0; i < n; i++) {
          const pick = weightedPick(this.pool, ([, w]) => w);
          if (pick) ctx.spawner.spawnOffscreen(pick[0]);
        }
      }
    }

    if (!this.eventFired && this.eraClock >= C.eventTime) this.fireEvent();

    if (!this.eliteWarned && this.eraClock >= C.eliteTime - C.warningTime) {
      this.eliteWarned = true;
      ctx.bus.emit('banner', { text: '⚠ ELITES SE APROXIMAM', sub: `${this.eliteCount}× Carnotaurus Alfa`, color: 0xff5030 });
    }
    if (!this.elitesSpawned && this.eraClock >= C.eliteTime) this.spawnElites();

    if (!this.bossWarned && this.eraClock >= C.eraLength - C.warningTime) {
      this.bossWarned = true;
      ctx.bus.emit('banner', { text: 'O CHÃO TREME...', sub: `O predador da Era ${this.era} está vindo`, color: 0xff3020 });
      ctx.fx.shake(0.004, 1500);
    }
    if (!this.bossSpawned && this.eraClock >= C.eraLength) this.spawnBoss();

    if (this.has('meteors')) {
      this.meteorTimer -= dt;
      if (this.meteorTimer <= 0) {
        this.meteorTimer = C.meteor.interval;
        this.dropMeteor();
      }
    }
  }

  private get eliteCount(): number {
    return Math.min(ENDLESS_CONFIG.maxElites, 1 + Math.floor(this.era / 2));
  }

  spawnElites(): void {
    this.elitesSpawned = true;
    this.eliteWarned = true;
    const ctx = this.ctx;
    let first: Enemy | null = null;
    for (let i = 0; i < this.eliteCount; i++) {
      const pos = ctx.spawner.ringPosition();
      const e = ctx.spawner.spawn('carnoAlpha', pos.x, pos.y);
      first ??= e;
    }
    ctx.director.elite = first;
  }

  spawnBoss(): void {
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    this.bossWarned = true;
    const ctx = this.ctx;
    const pos = ctx.spawner.ringPosition();
    ctx.director.boss = ctx.spawner.spawn('giganotosaurus', pos.x, pos.y);
    ctx.bus.emit('banner', { text: `GIGANOTOSAURUS · ERA ${this.era}`, sub: 'Derrote-o para avançar de Era', color: 0xff2010 });
    ctx.fx.shake(0.01, 800);
  }

  /** The Era boss died: advance to the next Era. */
  onBossKilled(): void {
    const C = ENDLESS_CONFIG;
    this.era++;
    this.eraClock = 0;
    this.calm = C.eraCalmTime;
    this.eventFired = this.eliteWarned = this.elitesSpawned = this.bossWarned = this.bossSpawned = false;
    this.rollPool();

    let sub = 'Os inimigos ficam mais fortes';
    if (this.era >= C.mutationFromEra) {
      const options = (Object.keys(ERA_MUTATIONS) as EraMutationId[]).filter((m) => !this.has(m));
      const pick = options[Math.floor(Math.random() * options.length)];
      if (pick) {
        this.mutations.push(pick);
        sub = `Mutação: ${ERA_MUTATIONS[pick].name} — ${ERA_MUTATIONS[pick].description}`;
      }
    }
    this.syncRunState();
    this.ctx.bus.emit('banner', { text: `ERA ${this.era}`, sub, color: 0xd070ff });
  }

  private syncRunState(): void {
    const run = this.ctx.run;
    run.era = this.era;
    run.mutations = this.mutations.map((m) => ERA_MUTATIONS[m].name);
  }

  /** A fresh random enemy mix per Era (Compys always common, Carnotaurus kept rarer). */
  private rollPool(): void {
    this.pool = ENDLESS_CONFIG.pool.map((id) => {
      const w = id === 'compy' ? 3 + Math.random() * 2 : 0.4 + Math.random() * 2.2;
      return [id, id === 'carnotaurus' ? w * 0.5 : w];
    });
  }

  private fireEvent(): void {
    this.eventFired = true;
    const ctx = this.ctx;
    const ring = Math.random() < 0.5;
    const id = ring ? 'compy' : (weightedPick(this.pool.filter(([e]) => e !== 'compy'), ([, w]) => w)?.[0] ?? 'wildRaptor');
    const count = ring ? Math.min(100, 40 + 10 * this.era) : Math.min(40, 8 + 3 * this.era);
    if (ring) ctx.spawner.spawnRing(id, count);
    else ctx.spawner.spawnSwarm(id, count);
    ctx.bus.emit('banner', { text: ring ? 'A horda se fecha!' : `Bando de ${ENEMIES[id].name}!`, color: 0xffc070 });
  }

  // ─────────────────────────── Chuva de Meteoros ───────────────────────────

  private dropMeteor(): void {
    const M = ENDLESS_CONFIG.meteor;
    const pl = this.ctx.player;
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() < 0.4 ? 0 : 60 + Math.random() * 200;
    const x = pl.x + pl.vx * 0.6 + Math.cos(a) * d;
    const y = pl.y + pl.vy * 0.6 + Math.sin(a) * d;
    this.ctx.telegraphs.circle(x, y, M.radius, M.windup, 0xff8030);
    this.meteors.push({ x, y, t: M.windup });
  }

  private updateMeteors(dt: number): void {
    if (!this.meteors.length) return;
    const M = ENDLESS_CONFIG.meteor;
    const ctx = this.ctx;
    const pl = ctx.player;
    for (const m of this.meteors) {
      m.t -= dt;
      if (m.t > 0) continue;
      ctx.fx.explosion(m.x, m.y, M.radius, 0xff7020, 'dust');
      if (Math.hypot(pl.x - m.x, pl.y - m.y) <= M.radius + pl.radius) {
        ctx.damage.hitPlayer({
          amount: M.damage * ctx.director.scaling('normal').damageMult, // includes the run's difficulty
          tags: ['aoe'],
          knockAngle: Math.atan2(pl.y - m.y, pl.x - m.x),
          knockForce: 300,
        });
      }
    }
    this.meteors = this.meteors.filter((m) => m.t > 0);
  }
}
