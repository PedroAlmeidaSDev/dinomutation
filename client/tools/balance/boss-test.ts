/**
 * Teste headless do Giganotosaurus: roda o GiganotosaurusBehavior e o Enemy REAIS com um
 * contexto falso (jogador-robô, dano, telegraphs, spawner) e confere as 3 fases.
 *
 * Uso: npm run test:boss
 */
import { BALANCE } from '../../src/data/balance.ts';
import { ENEMIES } from '../../src/data/enemies.ts';
import { Enemy } from '../../src/game/entities/enemies/Enemy.ts';
import { GiganotosaurusBehavior } from '../../src/game/entities/enemies/Giganotosaurus.ts';

type Bot = 'tank' | 'kite' | 'behind';

interface Log {
  t: number;
  phase: number;
  kind: string;
  detail?: string;
}

// Chainable no-op: stands in for scene.add.*, tweens, sprites, fx.
const chain: any = new Proxy(function () {}, {
  get: (_t, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : chain),
  apply: () => chain,
});

function runFight(bot: Bot, playerDps: number, opts: { seconds?: number; spawnNearWall?: boolean } = {}) {
  const W = BALANCE.world;
  const logs: Log[] = [];
  const damageBy = new Map<string, number>();
  let t = 0;
  let iFrames = 0;
  let rawTaken = 0;
  const reduction = 0.45;

  const player: any = {
    kind: 'player', x: W.width / 2, y: W.height / 2, vx: 0, vy: 0, radius: 24,
    statuses: new Map(), ccResist: 0.4, isAlive: () => true,
  };
  const behavior = new GiganotosaurusBehavior();
  const b = behavior as any;
  const phaseOf = () => b.phase as number;
  const log = (kind: string, detail?: string) => logs.push({ t, phase: phaseOf(), kind, detail });

  const ctx: any = {
    scene: chain,
    fx: chain,
    player,
    hitstop() {},
    telegraphs: { circle: () => ({ cancel() {}, done: false }), cone: () => ({ cancel() {}, done: false }), line: () => ({ cancel() {}, done: false }) },
    bus: { emit: (name: string, p: any) => { if (name === 'banner') log('banner', p.text); } },
    spawner: { spawnAround: (id: string, _x: number, _y: number, n: number) => log('summon', `${n}× ${id}`) },
    status: {
      apply: (host: any, id: string) => { if (host === player) log('playerStatus', id); },
      moveMult: () => 1, canAct: () => true, isFleeing: () => false, has: () => false,
    },
    damage: {
      hitPlayer(req: any) {
        if (iFrames > 0) return 0;
        iFrames = BALANCE.player.iFrames;
        rawTaken += req.amount;
        const red = Math.min(BALANCE.combat.maxDamageReduction, reduction) * (1 - (req.pierce ?? 0));
        const taken = req.amount * (1 - red);
        const src = b.state === 'charging' ? 'charge' : b.pending.length || b.state === 'quake' ? 'rock/' + b.attack : b.shockwaves.length ? 'shockwave' : b.attack;
        damageBy.set(src, (damageBy.get(src) ?? 0) + taken);
        return taken;
      },
    },
  };

  // Instrument the behaviour's private steps.
  const proto = GiganotosaurusBehavior.prototype as any;
  const wrap = (name: string, fn: (...a: any[]) => void) => {
    const orig = proto[name];
    b[name] = function (...args: any[]) { fn(...args); return orig.apply(this, args); };
  };
  wrap('beginAttack', (_e, _c, attack) => log('attack', attack));
  wrap('aimComboBite', () => log('comboBite'));
  wrap('aimCharge', () => log('charge'));
  wrap('onBlocked', () => { if (b.state === 'charging') log('stunned'); });
  wrap('enrage', () => log('enrage'));
  wrap('dropRock', () => log('rock'));

  const start = opts.spawnNearWall ? { x: W.wallThickness + 400, y: W.height / 2 } : { x: W.width / 2 + 400, y: W.height / 2 };
  const e = new Enemy(chain, ENEMIES.giganotosaurus, start.x, start.y, { hpMult: 1, damageMult: 1 }, behavior);
  behavior.onSpawn(e, ctx);
  if (opts.spawnNearWall) player.x = W.wallThickness + 150;

  const dt = 1 / 60;
  const maxT = opts.seconds ?? 400;
  let vulnerableSeen = false;
  let orbit = 0;
  while (t < maxT && e.hp > 0) {
    t += dt;
    iFrames -= dt;

    // Player bot
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    let tx = player.x, ty = player.y;
    if (bot === 'tank') { tx = e.x + (dx / d) * 110; ty = e.y + (dy / d) * 110; }
    if (bot === 'kite') { orbit += dt * 0.8; tx = e.x + Math.cos(orbit) * 280; ty = e.y + Math.sin(orbit) * 280; }
    if (bot === 'behind') { const a = e.facing + Math.PI; tx = e.x + Math.cos(a) * 120; ty = e.y + Math.sin(a) * 120; }
    const md = Math.hypot(tx - player.x, ty - player.y);
    const step = Math.min(md, 230 * dt);
    player.vx = md > 1 ? ((tx - player.x) / md) * 230 : 0;
    player.vy = md > 1 ? ((ty - player.y) / md) * 230 : 0;
    if (md > 0) { player.x += ((tx - player.x) / md) * step; player.y += ((ty - player.y) / md) * step; }
    const m = W.wallThickness + player.radius;
    player.x = Math.min(W.width - m, Math.max(m, player.x));
    player.y = Math.min(W.height - m, Math.max(m, player.y));

    e.update(dt, ctx);

    // Walls (what CollisionSystem.resolveStatic does for bosses).
    const em = W.wallThickness + e.radius * 0.9;
    const cx = Math.min(W.width - em, Math.max(em, e.x));
    const cy = Math.min(W.height - em, Math.max(em, e.y));
    if (cx !== e.x || cy !== e.y) {
      e.x = cx; e.y = cy;
      if (e.ignoreSeparation) behavior.onBlocked(e, ctx);
    }
    if (e.damageTakenMult > 1) vulnerableSeen = true;

    e.takeDamage(playerDps * dt * e.damageTakenMult);
  }

  return { logs, damageBy, ttk: e.hp <= 0 ? t : null, vulnerableSeen, finalPhase: phaseOf(), hpLeft: e.hpRatio, rawDps: rawTaken / t };
}

// ─────────────────────────── checks ───────────────────────────
// The boss picks attacks at random, so every check aggregates several fights.
const FIGHTS = 10;
let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? '  ✔' : '  ✘'} ${msg}`);
  if (!ok) failures++;
};
type Fight = ReturnType<typeof runFight>;
const many = (bot: Bot, dps: number, opts: { seconds?: number; spawnNearWall?: boolean } = {}) =>
  Array.from({ length: FIGHTS }, () => runFight(bot, dps, opts));
const all = (fs: Fight[]) => fs.flatMap((f) => f.logs);
const count = (logs: Log[], kind: string, detail?: string, phase?: number) =>
  logs.filter((l) => l.kind === kind && (detail === undefined || l.detail === detail) && (phase === undefined || l.phase === phase)).length;

/**
 * Lengths of completed sequences: `starter` attack followed by `step` logs. Sequences cut short
 * by a stun, a phase change or the fight ending are discarded.
 */
function sequences(fs: Fight[], starter: string, step: string, phase: number): number[] {
  const out: number[] = [];
  for (const f of fs) {
    let cur = -1;
    for (const l of f.logs) {
      if (l.kind === 'attack') {
        if (cur >= 0) out.push(cur);
        cur = l.detail === starter && l.phase === phase ? 0 : -1;
      } else if (l.kind === step && cur >= 0) cur++;
      else if (l.kind === 'stunned' || l.kind === 'banner') cur = -1;
    }
  }
  return out;
}
const fmt = (xs: number[]) => (xs.length ? xs.join(',') : 'nenhuma');

console.log(`\n── ${FIGHTS} lutas "kite" (orbita a 280px, 300 DPS) ──`);
const kite = many('kite', 300);
const ttks = kite.map((f) => f.ttk);
check(ttks.every((t) => t !== null), `chefe sempre morre (TTK ${ttks.map((t) => t?.toFixed(0)).join(', ')}s)`);
const firstBanner = (f: Fight, text: string) => f.logs.find((l) => l.kind === 'banner' && l.detail === text);
check(kite.every((f) => { const b = firstBanner(f, 'FÚRIA DO GIGANOTOSAURUS'); return b !== undefined && b.phase === 2; }), 'sempre entra na fase 2 (Fúria)');
check(kite.every((f) => { const b = firstBanner(f, 'PREDADOR SUPREMO'); return b !== undefined && b.phase === 3; }), 'sempre entra na fase 3 (Predador Supremo)');
const kl = all(kite);
for (const ph of [1, 2, 3]) {
  const mix = new Map<string, number>();
  for (const l of kl) if (l.kind === 'attack' && l.phase === ph) mix.set(l.detail!, (mix.get(l.detail!) ?? 0) + 1);
  console.log(`  fase ${ph}: ${[...mix].map(([k, v]) => `${k} ${v}`).join(' · ')}`);
}
check(count(kl, 'attack', 'quake', 1) + count(kl, 'attack', 'quake', 2) === 0, 'terremoto nunca antes da fase 3');
check(count(kl, 'attack', 'quake', 3) > 0, `terremoto na fase 3 (${count(kl, 'attack', 'quake', 3)}×, ${count(kl, 'rock')} pedras)`);
const summonsStarted = count(kl, 'attack', 'summon', 3);
const carnos = kl.filter((l) => l.kind === 'summon' && l.phase === 3 && l.detail?.includes('carnotaurus')).length;
check(carnos > 0, `invoca Carnotaurus na fase 3 (${carnos} de ${summonsStarted} invocações iniciadas)`);
check(!kl.some((l) => l.kind === 'summon' && l.phase < 3 && l.detail?.includes('carnotaurus')), 'não invoca Carnotaurus antes da fase 3');
const c1 = sequences(kite, 'charge', 'charge', 1);
const c2 = sequences(kite, 'charge', 'charge', 2);
check(c1.length > 0 && c1.every((n) => n === 1), `fase 1: investida única (${fmt(c1)})`);
check(c2.length > 0 && c2.every((n) => n === 3), `fase 2: investidas em sequência de 3 (${fmt(c2)})`);

console.log(`\n── ${FIGHTS} lutas "tank" (colado no chefe, 300 DPS) ──`);
const tank = many('tank', 300);
const tl = all(tank);
const b1 = sequences(tank, 'comboBite', 'comboBite', 1);
const b3 = sequences(tank, 'comboBite', 'comboBite', 3);
check(b1.length > 0 && b1.every((n) => n === 2), `fase 1: combo de 2 mordidas (${fmt(b1)})`);
check(b3.length > 0 && b3.every((n) => n === 3), `fase 3: combo de 3 mordidas (${fmt(b3)})`);
check(tl.some((l) => l.kind === 'playerStatus' && l.detail === 'slow' && l.phase >= 2), 'rugido aplica Lento na fase 2+');
check(!tl.some((l) => l.kind === 'playerStatus' && l.phase === 1), 'rugido não aplica Lento na fase 1');
const rawDps = tank.reduce((s, f) => s + f.rawDps, 0) / tank.length;
console.log(`  dano bruto médio recebido tankando: ${rawDps.toFixed(1)}/s (referência para ASSUME.bossTankHitRate do sim)`);

console.log(`\n── ${FIGHTS} lutas "behind" (fica atrás do chefe, 300 DPS) ──`);
const behind = all(many('behind', 300));
check(count(behind, 'attack', 'tailSweep', 1) === 0, 'sem varrida de cauda na fase 1');
check(count(behind, 'attack', 'tailSweep', 2) + count(behind, 'attack', 'tailSweep', 3) > 0,
  `varrida de cauda pune quem fica atrás na fase 2+ (${count(behind, 'attack', 'tailSweep')}×)`);

console.log(`\n── ${FIGHTS} lutas perto da parede ──`);
const wall = many('kite', 300, { spawnNearWall: true });
check(count(all(wall), 'stunned') > 0, `chefe fica atordoado ao bater na parede (${count(all(wall), 'stunned')}×)`);
check(wall.some((f) => f.vulnerableSeen), 'recebe +50% de dano enquanto atordoado');

console.log('\n── Luta lenta (100 DPS, fúria por tempo) ──');
const slow = runFight('kite', 100, { seconds: 160 });
const enr = slow.logs.find((l) => l.kind === 'enrage');
check(enr !== undefined && Math.abs(enr.t - ENEMIES.giganotosaurus.params.enrageTime) < 0.1, `enfurece aos ${enr?.t.toFixed(1)}s`);

console.log(failures ? `\n${failures} verificação(ões) falharam.` : '\nTodas as verificações passaram.');
process.exitCode = failures ? 1 : 0;

