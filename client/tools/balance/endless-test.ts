/**
 * Teste headless do modo infinito ("Era Sem Fim"): roda a classe Run REAL (todos os
 * sistemas) com uma cena falsa e um jogador invencível parado no centro.
 *
 * Uso: npm run test:endless
 */
import { ENDLESS_CONFIG } from '../../src/data/endless.ts';
import { ENEMIES } from '../../src/data/enemies.ts';
import { Run } from '../../src/game/core/Run.ts';

// Chainable no-op: stands in for scene.add.*, tweens, sprites, fx, particles.
const chain: any = new Proxy(function () {}, {
  get: (_t, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : chain),
  apply: () => chain,
});

let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? '  ✔' : '  ✘'} ${msg}`);
  if (!ok) failures++;
};

const DT = 1 / 30;
const run = new Run(chain, 'trex');
run.damage.invincible = true;
const kill = (e: any) => run.damage.hitEnemy({ target: e, base: 1e9, tags: ['debug'], rawBase: true, canCrit: false, noProcs: true });
const step = (seconds: number, each?: () => void) => {
  for (let t = 0; t < seconds; t += DT) {
    run.update(DT, 0, 0);
    each?.();
  }
};
// Level-ups pile up without a UI; clear them so upgrade rolls stay cheap.
const clearPending = () => { run.xp.pendingLevelUps = 0; run.xp.pendingRare = 0; };

// Spy on player hits (meteors have no attacker and the 'aoe' tag).
let meteorHits = 0;
const hitPlayer = run.damage.hitPlayer.bind(run.damage);
run.damage.hitPlayer = (req) => {
  if (!req.attacker && req.tags.includes('aoe')) meteorHits++;
  return hitPlayer(req);
};

console.log('\n── Vitória na história ──');
let storyDefeated = 0;
run.bus.on('storyBossDefeated', () => storyDefeated++);
step(5);
run.director.spawnBoss();
const storyBoss = run.director.boss!;
const presentAtKill = run.enemies.filter((e) => e !== storyBoss && !e.dead);
kill(storyBoss);
step(0.5);
check(storyDefeated === 1, 'emite storyBossDefeated ao matar o Giganotosaurus');
check(run.outcome === null, 'a run NÃO termina sozinha (a cena pergunta)');
check(run.run.victory && run.run.bossKilled, 'vitória registrada no estado da run');
check(presentAtKill.length > 0 && presentAtKill.every((e) => e.dead), `a arena é limpa (${presentAtKill.length} inimigos)`);
const elapsedAtWin = run.director.elapsed;
step(3);
check(run.enemies.length === 0 && run.director.elapsed === elapsedAtWin, 'nada nasce enquanto o jogador decide');

console.log('\n── Início da Era Sem Fim ──');
run.director.startEndless();
run.xp.pendingLegendary++;
const endless = run.director.endless!;
check(!!endless && run.run.endless && run.run.era === 1, 'director entra no modo infinito na Era 1');
const legendaryRoll = run.upgrades.roll({ minRarity: 'legendary' });
check(legendaryRoll.length === 3 && legendaryRoll.some((c) => c.def.rarity === 'legendary'),
  `escolha lendária oferece lendários (${legendaryRoll.map((c) => c.def.rarity).join(', ')})`);
const base = endless.scaling('normal').hpMult;
const alive0 = run.enemies.length;
step(ENDLESS_CONFIG.calmTime - 1, clearPending);
check(run.enemies.length <= alive0, `${ENDLESS_CONFIG.calmTime}s de calma sem spawns`);
step(10, clearPending);
check(run.enemies.length > alive0, `horda volta depois da calma (${run.enemies.length} inimigos)`);

console.log('\n── Ciclo da Era 1 ──');
let elitesAt = -1;
let bossAt = -1;
let maxAlive = 0;
const clockStart = endless.eraClock;
while (bossAt < 0 && endless.eraClock < ENDLESS_CONFIG.eraLength + 5) {
  step(DT, clearPending);
  maxAlive = Math.max(maxAlive, run.enemies.length);
  if (elitesAt < 0 && run.enemies.some((e) => e.def.rank === 'elite')) elitesAt = endless.eraClock;
  if (bossAt < 0 && run.director.boss) bossAt = endless.eraClock;
}
check(Math.abs(elitesAt - ENDLESS_CONFIG.eliteTime) < 1, `elites surgem aos ${elitesAt.toFixed(1)}s da Era`);
check(Math.abs(bossAt - ENDLESS_CONFIG.eraLength) < 1, `chefe da Era surge aos ${bossAt.toFixed(1)}s`);
check(maxAlive <= 230, `limite de inimigos respeitado (máx ${maxAlive})`);
const eraBoss = run.director.boss!;
check(eraBoss.maxHp === ENEMIES.giganotosaurus.hp, `chefe da Era 1 com HP base (${eraBoss.maxHp})`);
const clockAtBoss = endless.eraClock;
step(5, clearPending);
check(endless.eraClock === clockAtBoss, 'relógio da Era para enquanto o chefe vive');
void clockStart;

console.log('\n── Avanço de Era ──');
kill(eraBoss);
step(0.5, clearPending);
check(run.run.era === 2 && endless.eraClock === 0, 'matar o chefe leva à Era 2');
check(run.xp.pendingLegendary === 2, `ganha mais uma escolha lendária (pendentes: ${run.xp.pendingLegendary})`);
check(run.outcome === null, 'a run continua');
check(run.run.mutations.length === 0, 'sem mutações antes da Era 3');
run.director.spawnBoss();
const boss2 = run.director.boss!;
check(Math.abs(boss2.maxHp - ENEMIES.giganotosaurus.hp * ENDLESS_CONFIG.hpPerEra) < 1, `chefe da Era 2 com ×${ENDLESS_CONFIG.hpPerEra} de HP (${boss2.maxHp})`);
kill(boss2);
step(0.5, clearPending);
check(run.run.era === 3 && run.run.mutations.length === 1, `Era 3 traz uma mutação (${run.run.mutations.join(', ')})`);
const era3 = endless.scaling('normal').hpMult;
check(era3 > base * 1.8, `inimigos comuns escalam (HP ×${base.toFixed(2)} → ×${era3.toFixed(2)})`);

console.log('\n── Mutações ──');
(endless.mutations as string[]).push('thickSkin', 'feral', 'meteors');
step(ENDLESS_CONFIG.eraCalmTime + 12, clearPending);
const fresh = run.enemies.filter((e) => !e.dead && e.def.id === 'compy');
check(fresh.length > 0 && fresh.every((c) => c.armor >= 20), 'Pele Grossa: +20 de armadura nos novos inimigos');
check(fresh.every((c) => c.speed > ENEMIES.compy.speed * 1.2), 'Frenesi Selvagem: inimigos mais rápidos');
check(meteorHits > 0, `Chuva de Meteoros acerta quem fica parado (${meteorHits}×)`);

console.log('\n── Evoluções Infinitas ──');
// Max out everything the T-Rex can take, then roll: only repeatable cards should remain.
for (let guard = 0; guard < 500; guard++) {
  const choice = run.upgrades.roll().find((c) => !c.def.consumable);
  if (!choice) break;
  run.upgrades.acquire(choice.def.id);
}
const exhausted = run.upgrades.roll();
check(exhausted.every((c) => c.def.consumable), 'pool esgotado → só cartas repetíveis');
const seen = new Set<string>();
for (let i = 0; i < 40; i++) for (const c of run.upgrades.roll()) seen.add(c.def.id);
check(['evo_presas', 'evo_reflexos', 'evo_couraca'].every((id) => seen.has(id)), `Evoluções Infinitas aparecem (${[...seen].join(', ')})`);

console.log(failures ? `\n${failures} verificação(ões) falharam.` : '\nTodas as verificações passaram.');
process.exitCode = failures ? 1 : 0;
