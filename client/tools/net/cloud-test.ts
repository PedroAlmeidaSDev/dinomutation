/**
 * Teste do CloudSaveStore com uma API falsa: o servidor paga a run, erros de rede guardam a
 * run numa fila (e mostram uma prévia local), e a fila é reenviada ao abrir o jogo de novo.
 *
 * Uso: npm run test:net
 */
import { createRunState } from '../../src/game/core/RunState.ts';
import { CloudSaveStore } from '../../src/game/core/save/CloudSaveStore.ts';
import { enqueuePendingRun, pendingRuns } from '../../src/game/core/save/pendingRuns.ts';
import { SHOP } from '../../src/data/meta.ts';
import { setAccessToken, setFetch } from '../../src/net/api.ts';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? '  ✔' : '  ✘'} ${msg}`);
  if (!ok) failures++;
};

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Fake API: a save that grows by 111 Fósseis per accepted run.
const server = {
  online: true,
  rejectRuns: false,
  /** Answer every /api/runs with this error instead. */
  runError: null as null | { status: number; code?: string },
  runPosts: 0,
  save: { email: 'pedro@example.com', displayName: 'Pedro', runs: 0, fossils: 0, mastery: {} as Record<string, number> },
};
setAccessToken('t');
setFetch((async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = String(input);
  if (!server.online) throw new TypeError('fetch failed');
  if (url === '/api/players/me/save') return json(200, server.save);
  if (url === '/api/runs') {
    server.runPosts++;
    if (server.rejectRuns) return json(400, { code: 'VALIDATION_ERROR', detail: 'Run inconsistente.' });
    if (server.runError) return json(server.runError.status, server.runError.code && { code: server.runError.code, detail: 'Erro.' });
    server.save = { ...server.save, runs: server.save.runs + 1, fossils: server.save.fossils + 111, mastery: { trex: 143 } };
    return json(201, { rewards: { fossils: 111, firstWinBonus: 0, masteryXp: 143, levelBefore: 1, levelAfter: 2 }, save: server.save });
  }
  if (url === '/api/auth/refresh') return json(401, { code: 'INVALID_CREDENTIALS', detail: 'Sessão expirada.' });
  if (url === '/api/clears') return json(200, { firstWinBonus: 60, unlockedDifficulty: 'normal' });
  if (url === '/api/shop/purchases') return json(409, { code: 'INSUFFICIENT_FOSSILS', detail: 'Fósseis insuficientes.' });
  return json(404);
}) as typeof fetch);

function finishedRun() {
  const s = createRunState('trex', 'filhote');
  s.elapsedTime = 412.7;
  s.kills = 361;
  s.eliteKilled = true;
  return s;
}

console.log('\n── Abrir ──');
const cloud = await CloudSaveStore.open();
check(cloud.kind === 'cloud' && cloud.account.displayName === 'Pedro', 'carrega a conta');
check(cloud.current().fossils === 0 && typeof cloud.current().bestByDino === 'object' && typeof cloud.current().cleared === 'object', 'SaveData completo (campos que faltam vêm vazios)');

console.log('\n── Run com a API no ar ──');
{
  const { save, rewards, pending } = await cloud.recordRun(finishedRun(), false);
  check(!pending && rewards.fossils === 111 && save.fossils === 111, 'recompensa vem do servidor');
  check(rewards.unlocks.length === 1, 'textos de desbloqueio montados no cliente (nível 1 → 2)');
  check(cloud.current().fossils === 111, 'current() atualizado');
}

console.log('\n── Vitória no chefe ──');
{
  const clear = await cloud.recordClear('trex', 'filhote');
  check(clear?.firstWinBonus === 60 && clear.unlockedDifficulty === 'Normal', 'id da dificuldade vira o nome');
}

console.log('\n── Compra sem saldo ──');
check((await cloud.purchase('trex', SHOP.trex[0])) === null, 'INSUFFICIENT_FOSSILS → null');

console.log('\n── Run sem conexão ──');
{
  server.online = false;
  const accountFossils = cloud.current().fossils;
  const { rewards, pending } = await cloud.recordRun(finishedRun(), false);
  check(pending === true, 'marcada como pendente');
  check(rewards.fossils === 111, 'prévia calculada localmente');
  check(pendingRuns().length === 1 && pendingRuns()[0].email === 'pedro@example.com', 'guardada na fila com a conta');
  check(cloud.current().fossils === accountFossils, 'o save da conta não muda com a prévia');
}

console.log('\n── Reabrir com a API de volta ──');
{
  server.online = true;
  const before = server.runPosts;
  const reopened = await CloudSaveStore.open();
  check(server.runPosts === before + 1, 'reenvia a run da fila');
  check(pendingRuns().length === 0, 'fila vazia');
  check(reopened.current().fossils === 222, 'save recarregado depois do envio');
}

console.log('\n── Fila: recusa da API e outra conta ──');
{
  enqueuePendingRun('outra@example.com', { ...(pendingRunSample()), id: 'outra' });
  server.rejectRuns = true;
  enqueuePendingRun('pedro@example.com', { ...(pendingRunSample()), id: 'recusada' });
  await CloudSaveStore.open();
  check(pendingRuns().map((p) => p.run.id).join(',') === 'outra', 'run recusada (4xx) descartada; a de outra conta fica');
  server.rejectRuns = false;
}

console.log('\n── Vitória: bônus já pago em /api/clears aparece no resultado ──');
{
  const won = await CloudSaveStore.open();
  const s = finishedRun();
  s.bossKilled = true;
  s.victory = true;
  const before = won.current().fossils;
  s.firstClear = await won.recordClear('trex', 'filhote');
  check(won.current().fossils === before + 60, 'prévia local soma o bônus da 1ª vitória ao saldo');
  // The fake /api/runs answers like the real one after a clear: firstWinBonus 0, no unlock.
  const { rewards, pending } = await won.recordRun(s, true);
  check(!pending && rewards.firstWinBonus === 60, 'tela de resultado mostra o bônus de state.firstClear');
  check(rewards.unlockedDifficulty === 'Normal', 'e a dificuldade liberada (nome, como no visitante)');
  check(rewards.fossils === 111 + 60, 'total de Fósseis inclui o bônus');
}

console.log('\n── Sessão perdida no fim da run ──');
{
  const signedIn = await CloudSaveStore.open();
  server.runError = { status: 401 };
  const s = finishedRun();
  const { rewards, pending } = await signedIn.recordRun(s, false);
  check(pending === true && rewards.fossils === 111, '401 em /api/runs: run guardada (prévia), não descartada');
  check(pendingRuns().some((p) => p.run.id === s.id && p.email === 'pedro@example.com'), 'na fila da conta que jogou');
  setAccessToken('t');
  const before = server.runPosts;
  await CloudSaveStore.open();
  check(server.runPosts === before + 1, 'tenta reenviar ao abrir');
  check(pendingRuns().some((p) => p.run.id === s.id), '401 ao reenviar mantém na fila');
  server.runError = null;
  setAccessToken('t');
  await CloudSaveStore.open();
  check(!pendingRuns().some((p) => p.run.id === s.id), 'enviada ao entrar de novo');
}

console.log('\n── 409 CONFLICT é temporário ──');
{
  const signedIn = await CloudSaveStore.open();
  server.runError = { status: 409, code: 'CONFLICT' };
  const s = finishedRun();
  const { pending } = await signedIn.recordRun(s, false);
  check(pending === true && pendingRuns().some((p) => p.run.id === s.id), 'CONFLICT em /api/runs: vai para a fila');
  await CloudSaveStore.open();
  check(pendingRuns().some((p) => p.run.id === s.id), 'CONFLICT ao reenviar: continua na fila');
  server.runError = null;
  await CloudSaveStore.open();
  check(!pendingRuns().some((p) => p.run.id === s.id), 'enviada quando o servidor aceita');
}

function pendingRunSample() {
  const s = finishedRun();
  return {
    id: s.id, dino: s.dinosaur, difficulty: s.difficulty, victory: false, elapsedTime: s.elapsedTime, kills: s.kills,
    level: s.level, eliteKilled: s.eliteKilled, bossKilled: false, endless: false, era: 0, endlessTime: 0,
    damageDealt: 0, damageTaken: 0, upgrades: [],
  };
}

console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo');
process.exit(failures ? 1 : 0);
