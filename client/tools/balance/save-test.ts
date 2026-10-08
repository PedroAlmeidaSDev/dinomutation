/**
 * Teste headless do save de visitante (LocalSaveStore): a vitória (desbloqueio da próxima
 * dificuldade + bônus da 1ª vitória) precisa ficar gravada no momento em que o
 * Giganotosaurus cai, mesmo que o jogador siga na Era Sem Fim e saia pelo menu de pausa
 * (sem passar pela tela de resultado). Também cobre a compra no Covil.
 *
 * Uso: npm run test:save
 */
import { DIFFICULTY_BY_ID } from '../../src/data/difficulty.ts';
import { SHOP } from '../../src/data/meta.ts';
import { createRunState } from '../../src/game/core/RunState.ts';
import { clearedIndex, shopLevel } from '../../src/game/core/Save.ts';
import { LocalSaveStore, debugGrant } from '../../src/game/core/save/LocalSaveStore.ts';

// In-memory localStorage.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const saves = new LocalSaveStore();
const loadSave = () => saves.current();
const recordClear = saves.recordClear.bind(saves);
const recordRun = saves.recordRun.bind(saves);

let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? '  ✔' : '  ✘'} ${msg}`);
  if (!ok) failures++;
};

const bonus = DIFFICULTY_BY_ID.filhote.firstWinBonus;

console.log('\n── Vitória e saída pelo menu de pausa (sem tela de resultado) ──');
store.clear();
{
  const state = createRunState('trex', 'filhote');
  state.victory = true;
  state.firstClear = await recordClear(state.dinosaur, state.difficulty);
  // ...o jogador segue na Era Sem Fim e sai: nada mais é gravado.
  const s = loadSave();
  check(clearedIndex(s, 'trex') === 0, 'Filhote vencido fica gravado na hora');
  check(s.fossils === bonus, `bônus da 1ª vitória já creditado (${s.fossils}/${bonus})`);
  check(state.firstClear?.unlockedDifficulty === 'Normal', 'informa que Normal foi liberada');
}

console.log('\n── Vitória seguida da tela de resultado ──');
store.clear();
{
  const state = createRunState('trex', 'filhote');
  state.victory = true;
  state.firstClear = await recordClear(state.dinosaur, state.difficulty);
  const { save, rewards } = await recordRun(state, true);
  check(clearedIndex(save, 'trex') === 0, 'continua vencido');
  check(rewards.firstWinBonus === bonus, 'tela de resultado mostra o bônus da 1ª vitória');
  check(rewards.unlockedDifficulty === 'Normal', 'tela de resultado mostra Normal liberada');
  check(save.fossils === rewards.fossils, `bônus não é pago duas vezes (save ${save.fossils}, run ${rewards.fossils})`);
}

console.log('\n── Segunda vitória na mesma dificuldade ──');
{
  const state = createRunState('trex', 'filhote');
  state.victory = true;
  state.firstClear = await recordClear(state.dinosaur, state.difficulty);
  const before = loadSave().fossils;
  const { save, rewards } = await recordRun(state, true);
  check(state.firstClear === undefined, 'não é 1ª vitória');
  check(rewards.firstWinBonus === 0 && !rewards.unlockedDifficulty, 'sem bônus nem desbloqueio');
  check(save.fossils === before + rewards.fossils, 'só os fósseis da run');
}

console.log('\n── Vitória sem recordClear (caminho antigo) ──');
store.clear();
{
  const state = createRunState('raptor', 'filhote');
  state.victory = true;
  const { save, rewards } = await recordRun(state, true);
  check(clearedIndex(save, 'raptor') === 0, 'recordRun ainda grava a vitória');
  check(rewards.firstWinBonus === bonus && save.fossils === rewards.fossils, 'e paga o bônus uma vez');
}

console.log('\n── Derrota ──');
store.clear();
{
  const { save, rewards } = await recordRun(createRunState('trex', 'filhote'), false);
  check(clearedIndex(save, 'trex') === -1 && rewards.firstWinBonus === 0, 'derrota não libera nada');
}

console.log('\n── Compra no Covil ──');
store.clear();
{
  const item = SHOP.trex[0];
  check((await saves.purchase('trex', item)) === null, 'sem fósseis: compra recusada');
  debugGrant(item.costs[0], 0);
  const after = await saves.purchase('trex', item);
  check(after !== null && shopLevel(after, 'trex', item.id) === 1, 'com fósseis: nível 1');
  check(loadSave().fossils === 0, 'custo debitado e gravado');
}

console.log('\n── Run ganha um id ──');
{
  const a = createRunState('trex');
  const b = createRunState('trex');
  check(/^[0-9a-f-]{36}$/.test(a.id) && a.id !== b.id, `ids distintos no formato UUID (${a.id})`);
}

console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo');
process.exit(failures ? 1 : 0);
