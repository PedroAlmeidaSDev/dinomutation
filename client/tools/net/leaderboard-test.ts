/**
 * Teste da chamada do ranking: monta a query só com os filtros presentes, funciona sem
 * sessão (sem Authorization) e devolve a resposta da API.
 *
 * Uso: npm run test:net
 */
import { fetchLeaderboard } from '../../src/net/leaderboard.ts';
import { setAccessToken, setFetch } from '../../src/net/api.ts';

let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? '  ✔' : '  ✘'} ${msg}`);
  if (!ok) failures++;
};

const calls: { url: string; init: RequestInit }[] = [];
const board = {
  entries: [{ rank: 1, displayName: 'Ana', elapsedTime: 1500.5, dino: 'raptor', difficulty: 'filhote', era: 3, achievedAt: '2026-10-02T10:00:00Z' }],
};
setFetch((async (input: RequestInfo | URL, init: RequestInit = {}) => {
  calls.push({ url: String(input), init });
  return new Response(JSON.stringify(board), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch);

console.log('\n── Ranking ──');
setAccessToken(null);
{
  const res = await fetchLeaderboard();
  check(calls[0].url === '/api/leaderboard?limit=20', `sem filtros: ${calls[0].url}`);
  check((calls[0].init.headers as Record<string, string>).Authorization === undefined, 'visitante não manda Authorization');
  check(res.entries[0].displayName === 'Ana' && res.me === undefined, 'devolve a resposta da API');
}
{
  await fetchLeaderboard({ dino: 'raptor', difficulty: 'normal' }, 10);
  check(calls[1].url === '/api/leaderboard?dino=raptor&difficulty=normal&limit=10', `com filtros: ${calls[1].url}`);
}
setAccessToken('t');
{
  await fetchLeaderboard({ difficulty: 'extincao' });
  check(calls[2].url === '/api/leaderboard?difficulty=extincao&limit=20', 'só o filtro presente');
  check((calls[2].init.headers as Record<string, string>).Authorization === 'Bearer t', 'com sessão manda o token (para vir o "me")');
}

console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo');
process.exit(failures ? 1 : 0);
