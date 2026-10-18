/**
 * Teste da sessão: retomar ao abrir o jogo, entrar (com oferta de importação), importar e sair.
 *
 * Uso: npm run test:net
 */
import { saveStore, setSaveStore } from '../../src/game/core/save/SaveStore.ts';
import { hasLoginFlag, importGuestSave, resumeSession, signIn, signOut } from '../../src/game/core/save/session.ts';
import { LocalSaveStore, writeLocalSave } from '../../src/game/core/save/LocalSaveStore.ts';
import { emptySave } from '../../src/game/core/Save.ts';
import { api, setFetch } from '../../src/net/api.ts';

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

let refreshStatus = 200;
let saveStatus = 200;
let importStatus: 200 | 409 = 200;
let imported: unknown = null;
let fetchCalls = 0;
/** While set, /api/auth/refresh waits for it (a slow, cold-starting API). */
let refreshGate: Promise<void> | null = null;
const account = { email: 'pedro@example.com', displayName: 'Pedro', runs: 0, fossils: 0 };
setFetch((async (input: RequestInfo | URL, init: RequestInit = {}) => {
  fetchCalls++;
  const url = String(input);
  if (url === '/api/auth/refresh' && refreshGate) await refreshGate;
  if (url === '/api/auth/refresh') return refreshStatus === 200 ? json(200, { accessToken: 'r', expiresIn: 900 }) : json(refreshStatus);
  if (url === '/api/auth/login') return json(200, { accessToken: 'l', expiresIn: 900 });
  if (url === '/api/auth/logout') return json(204);
  if (url === '/api/players/me/save') return saveStatus === 200 ? json(200, account) : json(saveStatus);
  if (url === '/api/players/me/import') {
    if (importStatus === 409) return json(409, { code: 'ALREADY_IMPORTED', detail: 'A conta já tem progresso.' });
    imported = JSON.parse(String(init.body)).save;
    return json(200, { ...account, runs: 5, fossils: 300 });
  }
  return json(404);
}) as typeof fetch);

console.log('\n── Abrir o jogo ──');
{
  const before = fetchCalls;
  check((await resumeSession(true)) === 'guest' && fetchCalls === before, 'sem marca de login: visitante sem chamar a API');
}
store.set('dino-logged-in', '1');
check((await resumeSession(false)) === 'guest', 'API desligada no build: visitante');
check((await resumeSession(true)) === 'cloud' && saveStore().kind === 'cloud', 'com marca e refresh ok: nuvem');
refreshStatus = 401;
check((await resumeSession(true)) === 'guest' && !hasLoginFlag() && saveStore().kind === 'local', 'refresh recusado: visitante e marca apagada');
store.set('dino-logged-in', '1');
refreshStatus = 502;
check((await resumeSession(true)) === 'offline' && hasLoginFlag(), 'API fora do ar: offline, marca mantida');
refreshStatus = 200;

console.log('\n── Entrar com progresso de visitante ──');
{
  writeLocalSave({ ...emptySave(), runs: 5, fossils: 300 });
  const result = await signIn.password('pedro@example.com', 'senha-forte-123');
  check(result.account.displayName === 'Pedro' && result.canImport, 'oferece importar (conta vazia, navegador com runs)');
  check(hasLoginFlag() && saveStore().kind === 'cloud', 'marca de login e store da nuvem');
  await importGuestSave();
  check((imported as { runs: number }).runs === 5, 'envia o save do navegador');
  check(saveStore().current().fossils === 300, 'store passa a usar o save importado');
}

console.log('\n── Importar quando a conta já tem progresso ──');
{
  importStatus = 409;
  const before = saveStore().current();
  let threw = false;
  try {
    await importGuestSave();
  } catch {
    threw = true;
  }
  check(!threw, 'ALREADY_IMPORTED não lança');
  check(
    saveStore().kind === 'cloud' && saveStore().current().fossils === before.fossils && saveStore().current().runs === before.runs,
    'a nuvem vence: o save da conta não muda',
  );
  importStatus = 200;
}

console.log('\n── Sessão perdida no meio do jogo ──');
{
  saveStatus = 401;
  refreshStatus = 401;
  await api('/players/me/save').catch(() => undefined);
  check(saveStore().kind === 'local' && !hasLoginFlag(), 'chamada autenticada e refresh recusados: volta ao visitante e apaga a marca');
  saveStatus = 200;
  refreshStatus = 200;
}

console.log('\n── Retomada lenta não sobrescreve um login feito no meio ──');
{
  // Boot is still resuming the last session; the player went on as a guest and signed in.
  store.set('dino-logged-in', '1');
  setSaveStore(new LocalSaveStore());
  let release!: () => void;
  refreshGate = new Promise((r) => (release = r));
  const resuming = resumeSession(true);
  await signIn.password('pedro@example.com', 'senha-forte-123');
  const fresh = saveStore();
  release();
  const result = await resuming;
  refreshGate = null;
  check(result === 'superseded', 'a retomada percebe que foi ultrapassada');
  check(saveStore() === fresh && hasLoginFlag(), 'o login novo continua ativo');

  // Same race, but the old session had expired: the fresh login's flag must survive.
  setSaveStore(new LocalSaveStore());
  refreshStatus = 401;
  refreshGate = new Promise((r) => (release = r));
  const expiring = resumeSession(true);
  await signIn.password('pedro@example.com', 'senha-forte-123');
  const fresh2 = saveStore();
  release();
  await expiring;
  refreshGate = null;
  refreshStatus = 200;
  check(saveStore() === fresh2 && hasLoginFlag(), 'refresh recusado tarde não derruba o login novo');
}

console.log('\n── Sair ──');
{
  await signOut();
  check(!hasLoginFlag() && saveStore().kind === 'local', 'volta ao visitante');
  check(saveStore().current().runs === 5, 'o save do navegador continua lá');
}

console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo');
process.exit(failures ? 1 : 0);
