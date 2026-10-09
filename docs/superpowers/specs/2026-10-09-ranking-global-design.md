# Ranking global de melhores tempos

> Data: 09/10/2026 · Branch: `feat/backend-fase2` · Status: aprovado pelo dono do projeto ("faça logo")

## Objetivo

Um ranking público dos maiores tempos sobrevividos (o mesmo "Melhor tempo" que o menu já mostra), visível no jogo e pela API, com filtros opcionais por dinossauro e por dificuldade.

## Decisões

- **Métrica:** `run.elapsed_time` (maior tempo sobrevivido). Não precisa de campo novo.
- **Uma linha por jogador:** a melhor run dele dentro do filtro.
- **Desempate:** em tempos iguais, fica na frente quem registrou primeiro (`created_at` mais antigo).
- **Consulta direta na tabela `run`** com `DISTINCT ON` e `RANK()`, sem tabela desnormalizada nem cache.
- **Endpoint público.** Visitantes veem o ranking; quem está logado recebe também a própria posição.
- **Privacidade:** o ranking mostra apenas o `display_name`. O e-mail nunca sai na resposta.
- **Fora do escopo:**
  - **Antitrapaça.** Hoje o servidor só confere a consistência da run, então um `elapsedTime` forjado (até 14400 s) entraria no ranking. A proteção planejada é **runs com seed**: o servidor entrega uma seed, o cliente envia a seed e os comandos do jogador, e o servidor reproduz a partida com o motor do jogo para conferir o resultado. Isso exige simulação determinística e rodar o motor TS no servidor, então vira uma fase própria. O README documenta o risco.
  - Paginação além do Top 50, ranking semanal e cache (Redis).

## API

`GET /api/leaderboard?dino=<id>&difficulty=<id>&limit=<n>`

- `dino` e `difficulty` são opcionais (ausentes = todos) e usam os ids de sempre. Um id desconhecido responde `400 VALIDATION_ERROR`.
- `limit` vai de 1 a 50, com padrão 20. Fora disso, `400 VALIDATION_ERROR`.
- É público (`permitAll`). Se vier `Authorization: Bearer` válido, a resposta inclui `me`.

Resposta `200`:

```json
{
  "entries": [
    { "rank": 1, "displayName": "Ana", "elapsedTime": 1733.3, "dino": "raptor",
      "difficulty": "filhote", "era": 4, "achievedAt": "2026-10-09T12:00:00Z" }
  ],
  "me": { "rank": 37, "displayName": "Pedro", "elapsedTime": 610.2, "dino": "trex",
          "difficulty": "normal", "era": 0, "achievedAt": "2026-10-08T22:10:00Z" }
}
```

- `rank` usa `RANK()`, então empates exatos (mesmo tempo e mesma data) dividem a posição.
- `me` é omitido sem token, ou quando o jogador ainda não tem run dentro do filtro.

### Consulta

```sql
WITH best AS (
  SELECT DISTINCT ON (r.player_id)
         r.player_id, r.elapsed_time, r.dino, r.difficulty, r.era, r.created_at
  FROM run r
  WHERE (CAST(:dino AS varchar) IS NULL OR r.dino = :dino)
    AND (CAST(:difficulty AS varchar) IS NULL OR r.difficulty = :difficulty)
  ORDER BY r.player_id, r.elapsed_time DESC, r.created_at ASC
), ranked AS (
  SELECT b.*, RANK() OVER (ORDER BY b.elapsed_time DESC, b.created_at ASC) AS rank
  FROM best b
)
SELECT ranked.rank, p.display_name, ranked.elapsed_time, ranked.dino, ranked.difficulty, ranked.era, ranked.created_at
FROM ranked JOIN player p ON p.id = ranked.player_id
ORDER BY ranked.rank, p.display_name
LIMIT :limit
```

A posição do jogador logado vem da mesma CTE, filtrada por `player_id`.

Migration `V4__leaderboard_index.sql`: `CREATE INDEX run_player_elapsed_idx ON run (player_id, elapsed_time DESC, created_at);`

### Código

- Pacote `leaderboard/` com `LeaderboardController`, `LeaderboardService` e `LeaderboardRepository`. O repositório usa `NamedParameterJdbcTemplate`, porque a consulta é SQL nativo e não uma entidade. Os records são `LeaderboardEntry` e `LeaderboardResponse`.
- `SecurityConfig`: `GET /api/leaderboard` entra no `permitAll`.

## Jogo

- **`client/src/net/leaderboard.ts`:** `fetchLeaderboard({dino?, difficulty?})`, que chama `api('/leaderboard?…')`. O `api` só manda o token quando há sessão, então visitantes fazem a chamada sem token.
- **Cena `RankingScene`:** título "RANKING"; seletores ◀ ▶ de dinossauro (Todos, T-Rex, Raptor, Triceratops) e de dificuldade (Todas, Filhote, Normal, Predador, Extinção); tabela com posição, nome, tempo (`formatTime`), dino, dificuldade e Era (se > 0).
  - A linha do jogador fica destacada. Se ele estiver fora da lista, aparece uma linha extra separada no fim.
  - **Estados:** "Carregando…"; "Sem conexão com o servidor." com o botão "TENTAR DE NOVO"; e "Ninguém no ranking ainda. Seja o primeiro!".
  - Botão "VOLTAR" e ESC voltam ao menu.
- **Menu:** quando `VITE_API_ENABLED=true`, um botão "RANKING" fica ao lado do botão de conta, na mesma linha (os dois com 290 px de largura). Sem a flag, o menu não muda.

## Testes

- **Servidor** (`LeaderboardApiTest`, integração com Testcontainers):
  - ordena pelo maior tempo e mostra uma linha por jogador (a melhor run);
  - desempata pela data;
  - aplica os filtros de dino e de dificuldade;
  - inclui `me` com token, inclusive fora do limite, e omite sem token;
  - não traz o e-mail na resposta;
  - `limit` fora de 1–50 dá `400`, e um dino inválido dá `400`;
  - a rota é pública.
- **Jogo** (`tools/net/leaderboard-test.ts`, com `fetch` falso): monta a query string só com os filtros presentes e repassa a resposta. A cena entra no roteiro manual.
