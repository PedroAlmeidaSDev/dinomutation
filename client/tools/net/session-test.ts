/**
 * Teste da sessão: retomar ao abrir o jogo, entrar (com oferta de importação), importar e sair.
 *
 * Uso: npm run test:net
 */
import { saveStore } from '../../src/game/core/save/SaveStore.ts';
import { hasLoginFlag, importGuestSave, resumeSession, signIn, signOut } from '../../src/game/core/save/session.ts';
import { writeLocalSave } from '../../src/game/core/save/LocalSaveStore.ts';
import { emptySave } from '../../src/game/core/Save.ts';
import { setFetch } from '../../src/net/api.ts';

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
let imported: unknown = null;
const account = { email: 'pedro@example.com', displayName: 'Pedro', runs: 0, fossils: 0 };
setFetch((async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = String(input);
  if (url === '/api/auth/refresh') return refreshStatus === 200 ? json(200, { accessToken: 'r', expiresIn: 900 }) : json(refreshStatus);
  if (url === '/api/auth/login') return json(200, { accessToken: 'l', expiresIn: 900 });
  if (url === '/api/auth/logout') return json(204);
  if (url === '/api/players/me/save') return json(200, account);
  if (url === '/api/players/me/import') {
    imported = JSON.parse(String(init.body)).save;
    return json(200, { ...account, runs: 5, fossils: 300 });
  }
  return json(404);
}) as typeof fetch);

console.log('\n── Abrir o jogo ──');
check((await resumeSession(true)) === 'guest', 'sem marca de login: visitante sem chamar a API');
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

console.log('\n── Sair ──');
{
  await signOut();
  check(!hasLoginFlag() && saveStore().kind === 'local', 'volta ao visitante');
  check(saveStore().current().runs === 5, 'o save do navegador continua lá');
}

console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo');
process.exit(failures ? 1 : 0);
