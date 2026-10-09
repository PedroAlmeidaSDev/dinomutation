# Ranking global: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ranking público dos maiores tempos sobrevividos, com filtros por dinossauro e dificuldade, exposto pela API e numa tela do jogo.

**Architecture:** Consulta SQL nativa sobre a tabela `run` (`DISTINCT ON` para a melhor run por jogador, `RANK()` para a posição), servida por `GET /api/leaderboard`, que é público. O jogo ganha `client/src/net/leaderboard.ts` e uma cena `RankingScene`, acessada por um botão no menu que só aparece com a API ligada.

**Tech Stack:** Spring Boot 4.1.1, `NamedParameterJdbcTemplate`, PostgreSQL 16, Flyway, JUnit + MockMvc + Testcontainers; TypeScript + Phaser 3.

**Spec:** `docs/superpowers/specs/2026-10-09-ranking-global-design.md`

## Global Constraints

- Métrica: `run.elapsed_time` (maior tempo sobrevivido). Uma linha por jogador (a melhor run dele dentro do filtro). Desempate: `created_at` mais antigo vem antes. Posição: `RANK()`.
- `GET /api/leaderboard` é público. Com `Authorization: Bearer` válido, a resposta inclui `me`; sem token, ou sem run dentro do filtro, `me` é omitido.
- Parâmetros: `dino` e `difficulty` opcionais, com os ids `trex|raptor|triceratops` e `filhote|normal|predador|extincao`; `limit` de 1 a 50, padrão 20. Valor inválido → `400` com `code` `VALIDATION_ERROR`.
- A resposta nunca contém o e-mail; só o `displayName`.
- Formato: `{ entries: [{rank, displayName, elapsedTime, dino, difficulty, era, achievedAt}], me? }`.
- Comentários de código em inglês; textos de UI e mensagens em português.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Os testes do servidor precisam do Docker Desktop rodando (Testcontainers).
- Sem `VITE_API_ENABLED=true`, o menu do jogo fica exatamente como está.

---

### Task 1: Endpoint `GET /api/leaderboard`

**Files:**
- Create: `server/src/main/resources/db/migration/V4__leaderboard_index.sql`, `server/src/main/java/com/dinomutation/leaderboard/LeaderboardEntry.java`, `.../leaderboard/LeaderboardResponse.java`, `.../leaderboard/LeaderboardRepository.java`, `.../leaderboard/LeaderboardService.java`, `.../leaderboard/LeaderboardController.java`
- Modify: `server/src/main/java/com/dinomutation/common/SecurityConfig.java`
- Test: `server/src/test/java/com/dinomutation/leaderboard/LeaderboardApiTest.java`

**Interfaces:**
- Consumes: tabela `run` (V3) e `player` (V1); `IntegrationTest` (com `mvc`, `jdbc`, `register`, `accessToken`, `bearer`, `PASSWORD`); `DinoId.fromId`, `DifficultyId.fromId`; `ApiException`/`ErrorCode.VALIDATION_ERROR`; `CurrentPlayer.id(Jwt)`.
- Produces: `GET /api/leaderboard` com o JSON da seção Global Constraints.

- [ ] **Step 1: Escrever o teste**

`server/src/test/java/com/dinomutation/leaderboard/LeaderboardApiTest.java`:
```java
package com.dinomutation.leaderboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

class LeaderboardApiTest extends IntegrationTest {

	record Account(UUID id, String token) {}

	private Account account(String name) throws Exception {
		String email = name.toLowerCase() + "@example.com";
		MvcResult result = register(email, PASSWORD, name);
		assertThat(result.getResponse().getStatus()).isEqualTo(201);
		UUID id = jdbc.queryForObject("select id from player where email = ?", UUID.class, email);
		return new Account(id, accessToken(result));
	}

	/** Inserts a finished run directly: the ranking only reads the table, so setup skips the economy rules. */
	private void run(Account who, String dino, String difficulty, double elapsed, int era, String createdAt) {
		boolean endless = era > 0;
		jdbc.update("""
				insert into run (id, player_id, dino, difficulty, victory, elite_killed, boss_killed, endless, elapsed_time,
				  endless_time, kills, level, era, damage_dealt, damage_taken, upgrades, fossils_earned, first_win_bonus,
				  mastery_xp_earned, mastery_level_before, mastery_level_after, created_at)
				values (?, ?, ?, ?, ?, false, ?, ?, ?, 0, 0, 1, ?, 0, 0, '[]'::jsonb, 0, 0, 0, 1, 1, ?::timestamptz)
				""", UUID.randomUUID(), who.id(), dino, difficulty, endless, endless, endless, elapsed, era, createdAt);
	}

	@Test
	void ranksByLongestTimeWithOneLinePerPlayer() throws Exception {
		Account ana = account("Ana");
		Account bia = account("Bia");
		Account caio = account("Caio");
		run(ana, "trex", "filhote", 900, 0, "2026-10-01T10:00:00Z");
		run(ana, "raptor", "filhote", 1500.5, 3, "2026-10-02T10:00:00Z");
		run(bia, "triceratops", "filhote", 1200, 0, "2026-10-01T11:00:00Z");
		run(caio, "trex", "filhote", 300, 0, "2026-10-01T12:00:00Z");

		mvc.perform(get("/api/leaderboard")).andExpect(status().isOk())
				.andExpect(jsonPath("$.entries.length()").value(3))
				.andExpect(jsonPath("$.entries[0].rank").value(1))
				.andExpect(jsonPath("$.entries[0].displayName").value("Ana"))
				.andExpect(jsonPath("$.entries[0].elapsedTime").value(1500.5))
				.andExpect(jsonPath("$.entries[0].dino").value("raptor"))
				.andExpect(jsonPath("$.entries[0].difficulty").value("filhote"))
				.andExpect(jsonPath("$.entries[0].era").value(3))
				.andExpect(jsonPath("$.entries[0].achievedAt").exists())
				.andExpect(jsonPath("$.entries[1].displayName").value("Bia"))
				.andExpect(jsonPath("$.entries[2].displayName").value("Caio"))
				.andExpect(jsonPath("$.entries[2].rank").value(3));
	}

	@Test
	void tieGoesToWhoGotThereFirst() throws Exception {
		Account ana = account("Ana");
		Account bia = account("Bia");
		run(ana, "trex", "filhote", 1000, 0, "2026-10-02T10:00:00Z");
		run(bia, "trex", "filhote", 1000, 0, "2026-10-01T10:00:00Z");

		mvc.perform(get("/api/leaderboard"))
				.andExpect(jsonPath("$.entries[0].displayName").value("Bia"))
				.andExpect(jsonPath("$.entries[0].rank").value(1))
				.andExpect(jsonPath("$.entries[1].displayName").value("Ana"))
				.andExpect(jsonPath("$.entries[1].rank").value(2));
	}

	@Test
	void filtersByDinoAndDifficulty() throws Exception {
		Account ana = account("Ana");
		Account bia = account("Bia");
		run(ana, "trex", "normal", 1500, 0, "2026-10-01T10:00:00Z");
		run(ana, "raptor", "filhote", 600, 0, "2026-10-01T11:00:00Z");
		run(bia, "raptor", "filhote", 1200, 0, "2026-10-01T12:00:00Z");

		mvc.perform(get("/api/leaderboard").param("dino", "raptor"))
				.andExpect(jsonPath("$.entries.length()").value(2))
				.andExpect(jsonPath("$.entries[0].displayName").value("Bia"))
				.andExpect(jsonPath("$.entries[1].displayName").value("Ana"))
				.andExpect(jsonPath("$.entries[1].elapsedTime").value(600.0));
		mvc.perform(get("/api/leaderboard").param("difficulty", "normal"))
				.andExpect(jsonPath("$.entries.length()").value(1))
				.andExpect(jsonPath("$.entries[0].displayName").value("Ana"));
		mvc.perform(get("/api/leaderboard").param("dino", "raptor").param("difficulty", "normal"))
				.andExpect(jsonPath("$.entries").isEmpty());
	}

	@Test
	void signedInPlayerSeesTheirPlaceEvenOutsideTheLimit() throws Exception {
		Account ana = account("Ana");
		Account bia = account("Bia");
		Account caio = account("Caio");
		run(ana, "trex", "filhote", 3000, 0, "2026-10-01T10:00:00Z");
		run(bia, "trex", "filhote", 2000, 0, "2026-10-01T10:00:00Z");
		run(caio, "trex", "filhote", 1000, 0, "2026-10-01T10:00:00Z");

		mvc.perform(get("/api/leaderboard").param("limit", "2").header("Authorization", bearer(caio.token())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.entries.length()").value(2))
				.andExpect(jsonPath("$.me.rank").value(3))
				.andExpect(jsonPath("$.me.displayName").value("Caio"))
				.andExpect(jsonPath("$.me.elapsedTime").value(1000.0));
	}

	@Test
	void isPublicAndOmitsMeWithoutTokenOrRuns() throws Exception {
		Account ana = account("Ana");
		Account bia = account("Bia");
		run(ana, "trex", "filhote", 3000, 0, "2026-10-01T10:00:00Z");

		mvc.perform(get("/api/leaderboard")).andExpect(status().isOk()).andExpect(jsonPath("$.me").doesNotExist());
		mvc.perform(get("/api/leaderboard").header("Authorization", bearer(bia.token())))
				.andExpect(status().isOk()).andExpect(jsonPath("$.me").doesNotExist());
	}

	@Test
	void neverExposesEmails() throws Exception {
		Account ana = account("Ana");
		run(ana, "trex", "filhote", 3000, 0, "2026-10-01T10:00:00Z");

		String body = mvc.perform(get("/api/leaderboard").header("Authorization", bearer(ana.token())))
				.andReturn().getResponse().getContentAsString();
		assertThat(body).doesNotContain("@example.com").doesNotContain("email");
	}

	@Test
	void invalidParametersAre400() throws Exception {
		mvc.perform(get("/api/leaderboard").param("limit", "0"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		mvc.perform(get("/api/leaderboard").param("limit", "51")).andExpect(status().isBadRequest());
		mvc.perform(get("/api/leaderboard").param("dino", "stego"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		mvc.perform(get("/api/leaderboard").param("difficulty", "impossivel")).andExpect(status().isBadRequest());
	}

}
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd server && ./mvnw -q test -Dtest=LeaderboardApiTest
```
Expected: os testes falham com `401` (a rota ainda não é pública) ou `404`.

- [ ] **Step 3: Migration**

`server/src/main/resources/db/migration/V4__leaderboard_index.sql`:
```sql
-- Best run per player for the leaderboard (DISTINCT ON player_id ORDER BY elapsed_time DESC, created_at).
CREATE INDEX run_player_elapsed_idx ON run (player_id, elapsed_time DESC, created_at);
```

- [ ] **Step 4: Records, repositório, serviço e controller**

`leaderboard/LeaderboardEntry.java`:
```java
package com.dinomutation.leaderboard;

import java.time.Instant;

/** One line of the ranking: a player's best run within the filter. Never carries the e-mail. */
public record LeaderboardEntry(int rank, String displayName, double elapsedTime, String dino, String difficulty, int era,
		Instant achievedAt) {}
```

`leaderboard/LeaderboardResponse.java`:
```java
package com.dinomutation.leaderboard;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** `me` is the signed-in player's own line (omitted for guests or without a run in the filter). */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LeaderboardResponse(List<LeaderboardEntry> entries, LeaderboardEntry me) {}
```

`leaderboard/LeaderboardRepository.java`:
```java
package com.dinomutation.leaderboard;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Ranking straight from the run table: DISTINCT ON keeps each player's best run (longest
 * time, earliest on ties) and RANK() numbers them. Native SQL, so plain JDBC instead of JPA.
 */
@Repository
public class LeaderboardRepository {

	private static final String RANKED = """
			WITH best AS (
			  SELECT DISTINCT ON (r.player_id)
			         r.player_id, r.elapsed_time, r.dino, r.difficulty, r.era, r.created_at
			  FROM run r
			  WHERE (CAST(:dino AS varchar) IS NULL OR r.dino = :dino)
			    AND (CAST(:difficulty AS varchar) IS NULL OR r.difficulty = :difficulty)
			  ORDER BY r.player_id, r.elapsed_time DESC, r.created_at ASC
			), ranked AS (
			  SELECT b.*, RANK() OVER (ORDER BY b.elapsed_time DESC, b.created_at ASC) AS place
			  FROM best b
			)
			SELECT ranked.place, p.display_name, ranked.elapsed_time, ranked.dino, ranked.difficulty, ranked.era, ranked.created_at
			FROM ranked JOIN player p ON p.id = ranked.player_id
			""";

	private final NamedParameterJdbcTemplate jdbc;

	public LeaderboardRepository(NamedParameterJdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public List<LeaderboardEntry> top(String dino, String difficulty, int limit) {
		MapSqlParameterSource params = filter(dino, difficulty).addValue("limit", limit);
		return jdbc.query(RANKED + " ORDER BY ranked.place, p.display_name LIMIT :limit", params, LeaderboardRepository::entry);
	}

	public Optional<LeaderboardEntry> placeOf(UUID playerId, String dino, String difficulty) {
		MapSqlParameterSource params = filter(dino, difficulty).addValue("playerId", playerId);
		return jdbc.query(RANKED + " WHERE ranked.player_id = :playerId", params, LeaderboardRepository::entry).stream().findFirst();
	}

	/** Typed nulls: Postgres must know the parameter type even when the filter is absent. */
	private static MapSqlParameterSource filter(String dino, String difficulty) {
		return new MapSqlParameterSource()
				.addValue("dino", dino, Types.VARCHAR)
				.addValue("difficulty", difficulty, Types.VARCHAR);
	}

	private static LeaderboardEntry entry(ResultSet rs, int row) throws SQLException {
		return new LeaderboardEntry(rs.getInt("place"), rs.getString("display_name"), rs.getDouble("elapsed_time"),
				rs.getString("dino"), rs.getString("difficulty"), rs.getInt("era"),
				rs.getObject("created_at", OffsetDateTime.class).toInstant());
	}
}
```

`leaderboard/LeaderboardService.java`:
```java
package com.dinomutation.leaderboard;

import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LeaderboardService {

	private final LeaderboardRepository repository;

	public LeaderboardService(LeaderboardRepository repository) {
		this.repository = repository;
	}

	/** `playerId` is null for guests; then the response has no `me`. */
	@Transactional(readOnly = true)
	public LeaderboardResponse leaderboard(DinoId dino, DifficultyId difficulty, int limit, UUID playerId) {
		String dinoId = dino == null ? null : dino.id();
		String difficultyId = difficulty == null ? null : difficulty.id();
		LeaderboardEntry me = playerId == null ? null : repository.placeOf(playerId, dinoId, difficultyId).orElse(null);
		return new LeaderboardResponse(repository.top(dinoId, difficultyId, limit), me);
	}
}
```

`leaderboard/LeaderboardController.java`:
```java
package com.dinomutation.leaderboard;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.CurrentPlayer;
import com.dinomutation.common.ErrorCode;
import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.function.Function;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Public ranking of the longest survival times; a bearer token adds the caller's own place. */
@RestController
@RequestMapping("/api/leaderboard")
public class LeaderboardController {

	private final LeaderboardService service;

	public LeaderboardController(LeaderboardService service) {
		this.service = service;
	}

	@GetMapping
	public LeaderboardResponse leaderboard(
			@RequestParam(required = false) String dino,
			@RequestParam(required = false) String difficulty,
			@RequestParam(defaultValue = "20") @Min(1) @Max(50) int limit,
			@AuthenticationPrincipal Jwt jwt) {
		return service.leaderboard(parse(dino, DinoId::fromId), parse(difficulty, DifficultyId::fromId), limit,
				jwt == null ? null : CurrentPlayer.id(jwt));
	}

	/** Request ids are lower-case ("trex"), so Spring's enum-name conversion doesn't apply. */
	private static <T> T parse(String value, Function<String, T> fromId) {
		if (value == null || value.isBlank()) {
			return null;
		}
		try {
			return fromId.apply(value);
		} catch (IllegalArgumentException e) {
			throw new ApiException(ErrorCode.VALIDATION_ERROR, e.getMessage());
		}
	}
}
```

- [ ] **Step 5: Liberar a rota no `SecurityConfig`**

Em `common/SecurityConfig.java`, adicione o import `org.springframework.http.HttpMethod` e, logo depois da linha `.requestMatchers("/api/auth/**").permitAll()`, adicione:
```java
						.requestMatchers(HttpMethod.GET, "/api/leaderboard").permitAll()
```

- [ ] **Step 6: Rodar e ver passar**

```bash
cd server && ./mvnw -q test -Dtest=LeaderboardApiTest && ./mvnw -q verify
```
Expected: `LeaderboardApiTest` com 7 testes verdes; `verify` com `BUILD SUCCESS` (os 73 testes anteriores mais estes 7).

- [ ] **Step 7: Commit**

```bash
git add server
git commit -m "feat(server): ranking global de maiores tempos (GET /api/leaderboard)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tela de ranking no jogo

**Files:**
- Create: `client/src/net/leaderboard.ts`, `client/tools/net/leaderboard-test.ts`, `client/src/game/scenes/RankingScene.ts`
- Modify: `client/package.json` (`test:net`), `client/src/game/Game.ts` (registrar a cena), `client/src/game/scenes/MenuScene.ts` (botão)

**Interfaces:**
- Consumes: `api<T>(path)` e `setFetch`/`setAccessToken` de `client/src/net/api.ts`; `DINOSAURS`, `DINO_ORDER` (`data/dinosaurs`); `DIFFICULTIES`, `DIFFICULTY_BY_ID` (`data/difficulty`); `formatTime` (`utils/math`); `centerDesign` (`ui/layout`); `COLORS`, `button`, `text`, `title` (`ui/theme`); o JSON da Task 1.
- Produces: `fetchLeaderboard(filter?, limit?)`; a cena com a chave `'Ranking'`.

- [ ] **Step 1: Escrever o teste do cliente**

`client/tools/net/leaderboard-test.ts`:
```ts
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
```

No `client/package.json`, acrescente ao fim do script `test:net`:
```
 && node --experimental-transform-types --no-warnings --import ./tools/balance/loader/register.mjs tools/net/leaderboard-test.ts
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd client && npm run test:net
```
Expected: os três testes antigos passam; `leaderboard-test` falha ao importar `src/net/leaderboard.ts`.

- [ ] **Step 3: `client/src/net/leaderboard.ts`**

```ts
import type { DifficultyId } from '../data/difficulty';
import type { DinoId } from '../data/dinosaurs';
import { api } from './api';

/** One line of GET /api/leaderboard (a player's best run within the filter). */
export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  elapsedTime: number;
  dino: DinoId;
  difficulty: DifficultyId;
  era: number;
  achievedAt: string;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  /** The signed-in player's own line, even outside the list. */
  me?: LeaderboardEntry;
}

export interface LeaderboardFilter {
  dino?: DinoId;
  difficulty?: DifficultyId;
}

/** Public endpoint: guests call it without a token; with a session the API adds `me`. */
export function fetchLeaderboard(filter: LeaderboardFilter = {}, limit = 20): Promise<Leaderboard> {
  const query = new URLSearchParams();
  if (filter.dino) query.set('dino', filter.dino);
  if (filter.difficulty) query.set('difficulty', filter.difficulty);
  query.set('limit', String(limit));
  return api<Leaderboard>(`/leaderboard?${query}`);
}
```

- [ ] **Step 4: Rodar o teste do cliente**

```bash
cd client && npm run test:net
```
Expected: as quatro suítes com `Tudo certo`.

- [ ] **Step 5: A cena `RankingScene`**

`client/src/game/scenes/RankingScene.ts`:
```ts
import Phaser from 'phaser';
import { DIFFICULTIES, DIFFICULTY_BY_ID, type DifficultyId } from '../../data/difficulty';
import { DINOSAURS, DINO_ORDER, type DinoId } from '../../data/dinosaurs';
import { fetchLeaderboard, type Leaderboard, type LeaderboardEntry } from '../../net/leaderboard';
import { formatTime } from '../../utils/math';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { centerDesign } from '../ui/layout';
import { COLORS, button, text, title } from '../ui/theme';

/** undefined = no filter ("todos"). */
const DINO_FILTER: (DinoId | undefined)[] = [undefined, ...DINO_ORDER];
const DIFFICULTY_FILTER: (DifficultyId | undefined)[] = [undefined, ...DIFFICULTIES.map((d) => d.id)];
const TOP = 222;
const ROW_H = 19;
const COLS = { rank: 250, name: 300, time: 640, dino: 680, difficulty: 860, era: 1030 };

/** Global ranking of the longest survival times (GET /api/leaderboard). */
export class RankingScene extends Phaser.Scene {
  private dinoIndex = 0;
  private difficultyIndex = 0;
  /** Only the latest request may draw (filters can change while one is in flight). */
  private request = 0;
  private dinoLabel!: Phaser.GameObjects.Text;
  private difficultyLabel!: Phaser.GameObjects.Text;
  private content!: Phaser.GameObjects.Container;

  constructor() {
    super('Ranking');
  }

  create(): void {
    this.dinoIndex = 0;
    this.difficultyIndex = 0;
    this.request = 0;
    centerDesign(this, [
      this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground').setAlpha(0.5),
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.8),
    ]);
    title(this, GAME_WIDTH / 2, 50, 'RANKING', 38).setOrigin(0.5);
    text(this, GAME_WIDTH / 2, 92, 'Maiores tempos sobrevividos', 16, COLORS.muted).setOrigin(0.5);

    this.dinoLabel = this.selector(GAME_WIDTH / 2 - 230, 140, (dir) => {
      this.dinoIndex = wrap(this.dinoIndex + dir, DINO_FILTER.length);
      this.load();
    });
    this.difficultyLabel = this.selector(GAME_WIDTH / 2 + 230, 140, (dir) => {
      this.difficultyIndex = wrap(this.difficultyIndex + dir, DIFFICULTY_FILTER.length);
      this.load();
    });
    this.header();
    this.content = this.add.container(0, 0);

    button(this, 150, GAME_HEIGHT - 40, 'VOLTAR', () => this.scene.start('Menu'), { width: 200, height: 50, fontSize: 18, ghost: true });
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start('Menu'));
    this.load();
    this.cameras.main.fadeIn(250);
  }

  private selector(x: number, y: number, onChange: (dir: number) => void): Phaser.GameObjects.Text {
    const arrow = (dx: number, glyph: string, dir: number) =>
      text(this, x + dx, y, glyph, 22, COLORS.accentText, true)
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => onChange(dir));
    arrow(-150, '◀', -1);
    arrow(150, '▶', 1);
    return text(this, x, y, '', 17, COLORS.text, true).setOrigin(0.5);
  }

  private header(): void {
    const y = TOP - 26;
    const cell = (x: number, label: string, right = false) => {
      const t = text(this, x, y, label, 13, COLORS.muted, true);
      if (right) t.setOrigin(1, 0);
    };
    cell(COLS.rank, '#');
    cell(COLS.name, 'JOGADOR');
    cell(COLS.time, 'TEMPO', true);
    cell(COLS.dino, 'DINO');
    cell(COLS.difficulty, 'DIFICULDADE');
    cell(COLS.era, 'ERA');
  }

  private load(): void {
    const dino = DINO_FILTER[this.dinoIndex];
    const difficulty = DIFFICULTY_FILTER[this.difficultyIndex];
    this.dinoLabel.setText(dino ? DINOSAURS[dino].name : 'TODOS OS DINOS');
    this.difficultyLabel.setText(difficulty ? DIFFICULTY_BY_ID[difficulty].name.toUpperCase() : 'TODAS AS DIFICULDADES');
    const request = ++this.request;
    this.showStatus('Carregando…');
    fetchLeaderboard({ dino, difficulty })
      .then((board) => {
        if (request === this.request && this.sys.isActive()) this.render(board);
      })
      .catch(() => {
        if (request === this.request && this.sys.isActive()) this.showError();
      });
  }

  private showStatus(message: string): void {
    this.content.removeAll(true);
    this.content.add(text(this, GAME_WIDTH / 2, 400, message, 18, COLORS.muted, true).setOrigin(0.5));
  }

  private showError(): void {
    this.showStatus('Sem conexão com o servidor.');
    this.content.add(button(this, GAME_WIDTH / 2, 460, 'TENTAR DE NOVO', () => this.load(), {
      width: 260, height: 46, fontSize: 16, ghost: true,
    }));
  }

  private render(board: Leaderboard): void {
    this.content.removeAll(true);
    if (board.entries.length === 0) {
      this.showStatus('Ninguém no ranking ainda. Seja o primeiro!');
      return;
    }
    const me = board.me;
    board.entries.forEach((e, i) => this.row(e, TOP + i * ROW_H, me !== undefined && sameEntry(e, me)));
    if (me && !board.entries.some((e) => sameEntry(e, me))) {
      // The player is outside the list: their own line goes below a separator.
      const y = TOP + board.entries.length * ROW_H + 10;
      const line = this.add.graphics();
      line.lineStyle(1, COLORS.border, 0.8);
      line.lineBetween(COLS.rank - 10, y - 4, COLS.era + 60, y - 4);
      this.content.add(line);
      this.row(me, y + 2, true);
    }
  }

  private row(e: LeaderboardEntry, y: number, highlight: boolean): void {
    const color = highlight ? COLORS.acidText : COLORS.text;
    if (highlight) {
      this.content.add(this.add.rectangle(COLS.rank - 10, y - 2, COLS.era + 70 - COLS.rank, ROW_H, COLORS.acid, 0.12).setOrigin(0));
    }
    const cell = (x: number, value: string, right = false) => {
      const t = text(this, x, y, value, 14, color, highlight);
      if (right) t.setOrigin(1, 0);
      this.content.add(t);
    };
    cell(COLS.rank, `${e.rank}º`);
    cell(COLS.name, e.displayName.slice(0, 24));
    cell(COLS.time, formatTime(e.elapsedTime), true);
    cell(COLS.dino, DINOSAURS[e.dino]?.name ?? e.dino);
    cell(COLS.difficulty, DIFFICULTY_BY_ID[e.difficulty]?.name ?? e.difficulty);
    cell(COLS.era, e.era > 0 ? `${e.era}` : '—');
  }
}

/** Display names aren't unique: an entry is the player's own when place, name and date all match. */
function sameEntry(a: LeaderboardEntry, b: LeaderboardEntry): boolean {
  return a.rank === b.rank && a.displayName === b.displayName && a.achievedAt === b.achievedAt;
}

function wrap(i: number, n: number): number {
  return (i + n) % n;
}
```

- [ ] **Step 6: Registrar a cena e pôr o botão no menu**

Em `client/src/game/Game.ts`: adicione `import { RankingScene } from './scenes/RankingScene';` e inclua `RankingScene` no array `scene`, logo depois de `LairScene`.

Em `client/src/game/scenes/MenuScene.ts`:
1. Troque a linha `if (API_ENABLED) this.accountButton();` por:
```ts
    if (API_ENABLED) {
      button(this, GAME_WIDTH / 2 - 155, 604, 'RANKING', () => this.openRanking(), {
        width: 290, height: 40, fontSize: 14, ghost: true, color: COLORS.acid,
      }).setDepth(1);
      this.accountButton();
    }
```
2. Em `accountButton()`, troque `button(this, GAME_WIDTH / 2, 604, label,` por `button(this, GAME_WIDTH / 2 + 155, 604, label,` e `width: 300` por `width: 290`.
3. Adicione o método:
```ts
  private openRanking(): void {
    if (this.modal || this.leaving) return;
    this.leaving = true;
    this.scene.start('Ranking');
  }
```

- [ ] **Step 7: Verificar**

```bash
cd client && npm run typecheck && npm test && npm run build
```
Expected: sem erros de tipo; todas as suítes com `Tudo certo`; build ok.

- [ ] **Step 8: Commit**

```bash
git add client
git commit -m "feat: tela de ranking global no jogo, com filtros por dino e dificuldade

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: o endpoint e a tela das Tasks 1 e 2.
- Produces: documentação atualizada.

- [ ] **Step 1: Atualizar o README**

1. Na tabela de endpoints, depois da linha de `POST /api/shop/purchases`, adicione:
```
| `GET /api/leaderboard` | Ranking público dos maiores tempos sobrevividos: uma linha por jogador, filtros por dino e dificuldade, consulta com `DISTINCT ON` + `RANK()`. Com token, inclui a sua posição |
```
2. No fim do item **Confiança no cliente** (seção "Decisões de segurança"), troque `a detecção estatística de runs impossíveis está prevista para a fase 3.` por:
```
a próxima fase troca isso por **runs com seed**: o servidor entrega uma seed, o jogo envia a seed e os comandos do jogador, e o servidor reproduz a partida para conferir o resultado. Enquanto isso não existe, o ranking público aceita qualquer run consistente, até 4 h de tempo.
```
3. Troque o item **Fase 3** de "Próximas fases" por:
```
- **Fase 3:** antitrapaça com runs por seed (simulação determinística, reproduzida no servidor) para validar o ranking.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README com o ranking global e a antitrapaça por seed como próxima fase

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
