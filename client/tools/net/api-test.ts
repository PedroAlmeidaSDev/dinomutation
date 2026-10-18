/**
 * Teste do cliente HTTP com um fetch falso: Bearer, renovação automática em 401 (uma única
 * renovação para pedidos simultâneos), erros ProblemDetail e servidor fora do ar.
 *
 * Uso: npm run test:net
 */
import { ApiError, api, onSessionLost, refreshSession, setAccessToken, setFetch, setRequestTimeout } from '../../src/net/api.ts';

let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? '  ✔' : '  ✘'} ${msg}`);
  if (!ok) failures++;
};

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const auth = (c: Call) => (c.init.headers as Record<string, string> | undefined)?.Authorization;
function fake(handler: (url: string, init: RequestInit) => Response | Promise<Response>): void {
  calls = [];
  setFetch((async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

console.log('\n── Bearer ──');
{
  setAccessToken('abc');
  fake(() => json(200, { ok: true }));
  const res = await api<{ ok: boolean }>('/players/me/save');
  check(res.ok && calls[0].url === '/api/players/me/save', 'chama /api + caminho');
  check(auth(calls[0]) === 'Bearer abc', 'envia Authorization: Bearer');
}

console.log('\n── 401 → renova e repete ──');
{
  setAccessToken('velho');
  fake((url, init) => {
    if (url === '/api/auth/refresh') return json(200, { accessToken: 'novo', expiresIn: 900 });
    return (init.headers as Record<string, string>).Authorization === 'Bearer velho' ? json(401) : json(200, { ok: true });
  });
  const res = await api<{ ok: boolean }>('/players/me/save');
  check(res.ok, 'o pedido acaba dando certo');
  check(calls.map((c) => c.url).join(' ') === '/api/players/me/save /api/auth/refresh /api/players/me/save', 'pedido → refresh → pedido');
  check(auth(calls[2]) === 'Bearer novo', 'repete com o token novo');
}

console.log('\n── Dois 401 simultâneos → um só refresh ──');
{
  setAccessToken('velho');
  fake(async (url, init) => {
    if (url === '/api/auth/refresh') {
      await sleep(20);
      return json(200, { accessToken: 'novo', expiresIn: 900 });
    }
    return (init.headers as Record<string, string>).Authorization === 'Bearer velho' ? json(401) : json(200, {});
  });
  await Promise.all([api('/a'), api('/b')]);
  check(calls.filter((c) => c.url === '/api/auth/refresh').length === 1, 'refresh chamado uma vez');
}

console.log('\n── Refresh recusado → sessão perdida ──');
{
  setAccessToken('velho');
  let lost = 0;
  onSessionLost(() => lost++);
  fake((url) => (url === '/api/auth/refresh' ? json(401) : json(401)));
  try {
    await api('/players/me/save');
    check(false, 'deveria lançar');
  } catch (e) {
    check(e instanceof ApiError && e.status === 401, 'lança ApiError 401');
  }
  check(lost === 1, 'avisa onSessionLost');
  onSessionLost(() => {});
}

console.log('\n── ProblemDetail → código ──');
{
  setAccessToken('abc');
  fake(() => json(409, { code: 'INSUFFICIENT_FOSSILS', detail: 'Fósseis insuficientes.' }));
  try {
    await api('/shop/purchases', { method: 'POST', body: { dino: 'trex', itemId: 'meta_vida' } });
    check(false, 'deveria lançar');
  } catch (e) {
    check(e instanceof ApiError && e.code === 'INSUFFICIENT_FOSSILS' && e.message === 'Fósseis insuficientes.', 'code e detail');
  }
  check(calls[0].init.body === '{"dino":"trex","itemId":"meta_vida"}', 'corpo em JSON');
  check((calls[0].init.headers as Record<string, string>)['Content-Type'] === 'application/json', 'Content-Type JSON');
}

console.log('\n── Servidor fora do ar ──');
{
  fake(() => { throw new TypeError('fetch failed'); });
  try {
    await api('/players/me/save');
    check(false, 'deveria lançar');
  } catch (e) {
    check(e instanceof ApiError && e.offline, 'ApiError offline (status 0)');
  }
  fake(() => json(502));
  check((await refreshSession()) === 'offline', 'refresh com 502 = offline');
  fake(() => json(401));
  check((await refreshSession()) === 'expired', 'refresh com 401 = expired');
}

console.log('\n── auth: false ──');
{
  setAccessToken('abc');
  fake(() => json(401, { code: 'INVALID_CREDENTIALS', detail: 'E-mail ou senha inválidos.' }));
  try {
    await api('/auth/login', { method: 'POST', body: {}, auth: false });
  } catch (e) {
    check(e instanceof ApiError && e.code === 'INVALID_CREDENTIALS', 'erro de login chega como está');
  }
  check(calls.length === 1 && auth(calls[0]) === undefined, 'sem Authorization e sem tentar refresh');
}

console.log('\n── Tempo limite ──');
{
  setRequestTimeout(30);
  setAccessToken('abc');
  fake((_url, init) => new Promise<Response>((_resolve, reject) => {
    // AbortSignal.timeout() uses an unref'd timer; without other pending I/O (there's no
    // real fetch here) the event loop would never tick it, so this keeps it alive to test it.
    const keepAlive = setInterval(() => {}, 1000);
    init.signal?.addEventListener('abort', () => {
      clearInterval(keepAlive);
      reject(init.signal!.reason);
    });
  }));
  try {
    await api('/players/me/save');
    check(false, 'deveria lançar');
  } catch (e) {
    check(e instanceof ApiError && e.offline, 'ApiError offline (status 0) ao expirar o tempo');
  }
  check((await refreshSession()) === 'offline', 'refresh também expira para offline');
  setRequestTimeout(45_000);
}

console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo');
process.exit(failures ? 1 : 0);
