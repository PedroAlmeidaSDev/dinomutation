# Backend fase 2 — contas e save na nuvem

> Data: 05/10/2026 · Branch: `feat/backend-fase2` · Status: aprovado (revisado em 07/10/2026: Spring Boot 4.1.1, limites da importação e detalhes de tipos)

## Objetivo

Dar ao DinoMutation uma API em Spring Boot que:

1. permite criar conta com **e-mail/senha** ou entrar com **Google**;
2. guarda o progresso (Fósseis, maestria, loja, dificuldades, recordes) **no servidor**;
3. faz do servidor a **fonte da verdade da economia**: o cliente informa o que aconteceu na run e o servidor calcula o que é pago.

O login é **opcional**. Sem conta o jogo funciona exatamente como hoje (localStorage).

O projeto também serve de portfólio de back-end Java, então as escolhas priorizam práticas de mercado (migrations, testes de integração com banco real, segurança bem resolvida) em vez do caminho mais curto.

## Fora do escopo (fases seguintes)

- Detecção estatística de runs impossíveis (abates/minuto, dano máximo) e ranking — **fase 3**.
- Deploy da API, rate limiting e observabilidade — **fase 4**.
- Confirmação de e-mail, "esqueci minha senha", troca de senha, exclusão de conta.
- Login com outros provedores além do Google.

## 1. Arquitetura

### Repositório (monorepo)

```
dinomutation/
├── client/              ← o jogo atual, movido com git mv (histórico preservado)
├── server/              ← API Spring Boot
├── shared/
│   ├── economy.json     ← números da economia (fonte única para TS e Java)
│   └── economy-cases.json ← casos de paridade (entrada → resultado esperado)
├── docker-compose.yml   ← Postgres de desenvolvimento
├── .github/workflows/ci.yml
└── README.md
```

`tools/balance` vai junto para `client/`, então os caminhos relativos para `src/` continuam válidos.

**Vercel:** depois da mudança, o projeto precisa de *Root Directory* = `client`, com *"Include files outside the Root Directory in the Build Step"* ligado (o jogo importa `../shared/economy.json`). Essa troca é feita pelo dono do projeto **logo antes** do merge na `main`, para a produção não ficar fora do ar.

### Stack do servidor

- Java 21 (LTS), Spring Boot 4.1.1 (a versão estável atual; o Spring Initializr já não oferece a linha 3), Maven com Maven Wrapper. No Boot 4 o Jackson é o 3 (pacote `tools.jackson`) e o Testcontainers é o 2.
- Spring Web, Spring Security (OAuth2 Resource Server para validar os JWTs próprios), Spring Data JPA, Bean Validation.
- PostgreSQL 16, Flyway (sem `ddl-auto=update`; o Hibernate só faz `validate`).
- springdoc-openapi 3.1.1, a linha compatível com o Boot 4 (Swagger UI em `/swagger-ui`).
- JUnit 5, MockMvc, Testcontainers.

### Pacotes (por funcionalidade)

```
com.dinomutation
├── auth/      cadastro, login, Google, refresh token, emissão de JWT
├── player/    entidade Player, DinoProgress, ShopLevel, montagem do SaveDto, preferências, importação
├── run/       registro de runs e de vitórias no chefe
├── shop/      compras
├── economy/   regras puras + leitura do economy.json (sem dependência do Spring)
└── common/    ProblemDetail/erros, configuração de segurança, propriedades
```

Cada pacote tem controller, service, repository e DTOs (records Java). O `economy/` só expõe funções puras e um record `EconomyConfig` carregado do JSON.

### Fonte única dos números

- O Maven copia `../shared/economy.json` para `target/classes` no build (`maven-resources-plugin`).
- O Vite importa o mesmo arquivo direto (`import economy from '../../../shared/economy.json'`). Se precisar, `server.fs.allow` inclui a raiz do repositório.

## 2. Modelo de dados

Migrations Flyway em `server/src/main/resources/db/migration`.

```
player
  id                 uuid PK
  email              varchar(254) NOT NULL UNIQUE      -- sempre em minúsculas
  password_hash      varchar NULL                      -- NULL = só Google
  google_sub         varchar NULL UNIQUE
  display_name       varchar(40) NOT NULL
  fossils            int NOT NULL DEFAULT 0 CHECK (fossils >= 0)
  runs               int NOT NULL DEFAULT 0
  wins               int NOT NULL DEFAULT 0
  endless_runs       int NOT NULL DEFAULT 0
  best_time          double precision NOT NULL DEFAULT 0
  best_era           int NOT NULL DEFAULT 0
  last_dino          varchar NULL
  seen_patch         varchar NULL
  imported_at        timestamptz NULL
  version            bigint NOT NULL DEFAULT 0         -- @Version
  created_at, updated_at  timestamptz NOT NULL

dino_progress                                           PK (player_id, dino)
  player_id          uuid FK → player ON DELETE CASCADE
  dino               varchar NOT NULL CHECK (dino IN ('trex','raptor','triceratops'))
  mastery_xp         int NOT NULL DEFAULT 0
  cleared_index      int NOT NULL DEFAULT -1           -- -1 = nenhuma dificuldade vencida
  preferred_difficulty varchar NULL
  best_time          double precision NOT NULL DEFAULT 0
  best_era           int NOT NULL DEFAULT 0

shop_level                                              PK (player_id, dino, item_id)
  player_id, dino, item_id varchar, level int NOT NULL

run
  id                 uuid PK                           -- gerado pelo cliente (idempotência)
  player_id          uuid FK
  dino, difficulty   varchar NOT NULL
  victory, elite_killed, boss_killed, endless  boolean
  elapsed_time, endless_time  double precision
  kills, level, era  int
  damage_dealt, damage_taken  double precision
  upgrades           jsonb                             -- histórico; não é usado em regra
  fossils_earned     int NOT NULL                      -- inclui first_win_bonus
  first_win_bonus    int NOT NULL DEFAULT 0            -- aplicado nesta chamada
  unlocked_difficulty varchar NULL
  mastery_xp_earned  int NOT NULL
  mastery_level_before, mastery_level_after  int NOT NULL
  created_at         timestamptz NOT NULL
  INDEX (player_id, created_at DESC)

refresh_token
  id                 uuid PK
  player_id          uuid FK ON DELETE CASCADE
  token_hash         varchar(64) NOT NULL UNIQUE         -- SHA-256 em hex
  expires_at         timestamptz NOT NULL
  revoked_at         timestamptz NULL
  created_at         timestamptz NOT NULL
```

Decisões:

- `dino` e `difficulty` são `varchar` + `CHECK`, mapeados para os enums Java `DinoId` e `DifficultyId` (`@Enumerated(STRING)` com conversor para os ids em minúsculas).
- Contadores e recordes ficam **gravados**, não derivados de `run`, porque um save importado tem runs sem linhas correspondentes.
- `@Version` no `Player`. Em `ObjectOptimisticLockingFailureException`, o service tenta mais uma vez. Se falhar de novo, responde `409 CONFLICT`.

## 3. Autenticação

### Tokens

- **Access token:** JWT HS256 assinado com `JWT_SECRET` (variável de ambiente, ≥ 256 bits), validade de 15 min, `sub` = id do player, `iss` = `dinomutation`. Emitido com `NimbusJwtEncoder` e validado pelo Resource Server do Spring. No cliente, fica **só em memória**.
- **Refresh token:** 32 bytes aleatórios (`SecureRandom`, base64url), validade de 30 dias, enviado como cookie `refresh_token` com `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`. Em desenvolvimento, `Secure` é desligado por propriedade.
  - **Rotação:** cada `/refresh` revoga o token usado e emite outro.
  - **Detecção de reuso:** se chegar um token já revogado, todos os refresh tokens daquele player são revogados e a resposta é `401`.

### Mesma origem

O cliente sempre chama `/api/...` no próprio domínio:

- **Produção:** `client/vercel.json` com um *rewrite* `/api/:path*` → URL da API (definido na fase 4).
- **Desenvolvimento:** `server.proxy` do Vite, `/api` → `http://localhost:8080`.

Por isso não há CORS para configurar e o cookie é *first-party*.

### Endpoints

| Método e rota | Corpo | Sucesso | Erros |
|---|---|---|---|
| `POST /api/auth/register` | `{email, password, displayName}` | `201 {accessToken, expiresIn}` + cookie | `400 VALIDATION_ERROR`, `409 EMAIL_TAKEN` |
| `POST /api/auth/login` | `{email, password}` | `200 {accessToken, expiresIn}` + cookie | `401 INVALID_CREDENTIALS` |
| `POST /api/auth/google` | `{idToken}` | `200 {accessToken, expiresIn}` + cookie | `401 INVALID_CREDENTIALS` |
| `POST /api/auth/refresh` | cookie | `200 {accessToken, expiresIn}` + cookie novo | `401 INVALID_CREDENTIALS` |
| `POST /api/auth/logout` | cookie | `204`, cookie apagado | — |

Regras:

- **Senha:** de 8 a 72 caracteres (o limite do BCrypt), guardada com `BCryptPasswordEncoder`.
- **E-mail:** formato validado e normalizado (`trim` + minúsculas).
- **`displayName`:** de 2 a 40 caracteres. No Google, vem do `name` do token, truncado.
- **Login:** a mensagem de erro é sempre a mesma, exista o e-mail ou não. Uma conta só-Google que tenta login com senha recebe o mesmo `INVALID_CREDENTIALS`.
- **Verificação do Google:** fica atrás da interface `GoogleTokenVerifier`. A implementação real usa um `NimbusJwtDecoder` com o JWKS `https://www.googleapis.com/oauth2/v3/certs` e valida: `iss` ∈ {`accounts.google.com`, `https://accounts.google.com`}, `aud` = `GOOGLE_CLIENT_ID`, expiração, e `email_verified = true`.

### Regra do mesmo e-mail (proteção contra *account pre-hijacking*)

No `POST /api/auth/google`:

1. Se existe um player com esse `google_sub`, entra nele.
2. Senão, se existe um player com esse e-mail:
   - liga o `google_sub` a ele;
   - se ele tinha senha, **apaga o `password_hash` e revoga todos os refresh tokens dele**, porque a senha pode ter sido criada por quem não é dono do e-mail (o cadastro não confirma e-mail);
   - entra nele.
3. Senão, cria um player novo, sem senha.

Essa regra deve ser explicada no README.

## 4. API do jogo

Todas as rotas exigem `Authorization: Bearer <accessToken>`. O player é sempre o do token; não existe rota que receba id de outro player.

### `SaveDto`

Mesmo formato do `SaveData` do cliente, mais os dados da conta:

```json
{
  "email": "a@b.com", "displayName": "Pedro",
  "runs": 34, "wins": 9, "bestTime": 1210.5, "bestByDino": {"trex": 1210.5},
  "lastDino": "trex", "fossils": 820,
  "mastery": {"trex": 640}, "shop": {"trex": {"meta_vida": 3}},
  "endlessRuns": 2, "bestEra": 3, "bestEraByDino": {"trex": 3},
  "seenPatch": "0.2.0",
  "cleared": {"trex": 1}, "difficulty": {"trex": "predador"}
}
```

Dinos sem linha em `dino_progress` simplesmente não aparecem nos mapas, igual ao `Partial<Record<…>>` do cliente.

### Endpoints

| Método e rota | Corpo | Sucesso | Erros |
|---|---|---|---|
| `GET /api/players/me/save` | — | `200 SaveDto` | — |
| `POST /api/players/me/import` | `{save: SaveData}` | `200 SaveDto` | `400 VALIDATION_ERROR`, `409 ALREADY_IMPORTED` |
| `POST /api/clears` | `{dino, difficulty}` | `200 {firstWinBonus, unlockedDifficulty?}` | `400` |
| `POST /api/runs` | `RunRequest` (abaixo) | `201 {rewards, save}` (`200` se for reenvio) | `400 VALIDATION_ERROR` |
| `POST /api/shop/purchases` | `{dino, itemId}` | `200 {save}` | `404 ITEM_NOT_FOUND`, `409 ITEM_MAXED`, `409 INSUFFICIENT_FOSSILS` |
| `PATCH /api/players/me/preferences` | `{seenPatch?, difficulty?: {dino, id}}` | `204` | `409 DIFFICULTY_LOCKED` |

**Importação.** É aceita só se `imported_at` for nulo **e** `runs = 0`. Caso contrário, responde `409 ALREADY_IMPORTED` e a nuvem vence. Checagens nos valores recebidos:

- todos os números ≥ 0;
- `cleared[d]` entre -1 e o último índice de dificuldade;
- `difficulty[d]` válida e já liberada;
- níveis da loja ≤ número de custos do item, e só itens que existem para aquele dino;
- `mastery[d]` entre 0 e 10.000.000 (o jogo continua somando XP depois do nível máximo, então não há teto real; o limite só barra valores absurdos);
- dinos e itens desconhecidos são recusados com `400`.

Marca `imported_at = now()`. O cliente não apaga o save local.

**Vitória no chefe (`/api/clears`).** Aplica a mesma regra do `applyClear` atual: se o índice da dificuldade for maior que `cleared_index`, atualiza o índice, soma `firstWinBonus` aos Fósseis e devolve o bônus e o nome da próxima dificuldade. Senão, devolve `{firstWinBonus: 0}`. É idempotente sem precisar de chave. Uma dificuldade ainda não liberada para o dino (índice > `cleared_index + 1`) é recusada com `409 DIFFICULTY_LOCKED`.

**`unlockedDifficulty`** (em `/api/clears` e nas recompensas de `/api/runs`) é o **id** da dificuldade liberada (`"normal"`), não o nome. Os nomes de exibição ficam só no cliente, que faz a conversão.

**`RunRequest`:**

```
id: uuid; dino; difficulty; victory: boolean; elapsedTime: number (0..14400)
kills: int ≥ 0; level: int ≥ 1; eliteKilled; bossKilled; endless: boolean
era: int ≥ 0; endlessTime: number ≥ 0; damageDealt, damageTaken: number ≥ 0
upgrades: [{id, name, rarity, level}] (máx. 100 itens)
```

Consistência (`400` se violada): `victory ⇒ bossKilled`; `era > 0 ⇒ endless ∧ bossKilled`; `endless ⇒ bossKilled`; `endlessTime ≤ elapsedTime`. Uma dificuldade ainda não liberada para o dino é recusada com `409 DIFFICULTY_LOCKED`, como em `/api/clears`.

**Processamento de `POST /api/runs` (uma transação):**

1. Se já existe `run.id` para este player, devolve `200` com as recompensas gravadas e o `SaveDto` atual. Se o id existe mas pertence a outro player, `409 CONFLICT`.
2. `runs += 1`; se vitória, `wins += 1`; atualiza `best_time` (geral e do dino) e `last_dino`.
3. Se `endless ∧ era > 0`: `endless_runs += 1` e atualiza `best_era` (geral e do dino).
4. `runFossils = fossilsForRun(...)`, usando o `fossilMult` da dificuldade.
5. Se vitória, aplica o clear (no-op se já registrado por `/api/clears`) e obtém `firstWinBonus`.
6. `fossils += runFossils + firstWinBonus`; `mastery_xp += masteryXpForRun(...)`; calcula os níveis antes e depois.
7. Grava a linha `run` e devolve `rewards = {fossils, firstWinBonus, unlockedDifficulty, masteryXp, levelBefore, levelAfter}` e o `save`.

O cliente monta os textos de desbloqueio com `unlocksAtMastery(dino, l)` para `l` entre `levelBefore+1` e `levelAfter`. Se o cliente já tinha `state.firstClear` de `/api/clears`, a tela de resultado usa esse valor para exibir o bônus, como faz hoje.

**Compra.** Numa transação: o item precisa existir em `shop[dino]` do `economy.json` (senão `404`); `nível < costs.length` (senão `ITEM_MAXED`); `fossils ≥ costs[nível]` (senão `INSUFFICIENT_FOSSILS`). Então debita os Fósseis e faz `level + 1`.

**Preferências.** `seenPatch` é texto livre (até 20 caracteres). `difficulty` precisa estar liberada (`índice ≤ min(último, cleared_index + 1)`).

### Erros

`@RestControllerAdvice` responde no formato `ProblemDetail` (RFC 9457), com a propriedade extra `code`. Em `VALIDATION_ERROR`, inclui também `errors: [{field, message}]`. Códigos: `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `INSUFFICIENT_FOSSILS`, `ITEM_MAXED`, `ITEM_NOT_FOUND`, `DIFFICULTY_LOCKED`, `ALREADY_IMPORTED`, `CONFLICT`.

## 5. Economia compartilhada

### `shared/economy.json`

```json
{
  "dinos": ["trex", "raptor", "triceratops"],
  "fossils": { "perMinute": 15, "perKills": 60, "elite": 40, "boss": 120 },
  "mastery": { "secondsPerXp": 4, "elite": 40, "boss": 100, "maxLevel": 10, "xpPerLevel": 100 },
  "difficulties": [
    { "id": "filhote",  "fossilMult": 0.75, "firstWinBonus": 60 },
    { "id": "normal",   "fossilMult": 1,    "firstWinBonus": 150 },
    { "id": "predador", "fossilMult": 1.4,  "firstWinBonus": 250 },
    { "id": "extincao", "fossilMult": 1.8,  "firstWinBonus": 400 }
  ],
  "shop": {
    "trex":        [{ "id": "meta_vida", "costs": [30, 70, 150, 300, 480] }, "…"],
    "raptor":      ["…"],
    "triceratops": ["…"]
  }
}
```

A ordem do array `difficulties` define o índice usado em `cleared_index`.

### No cliente

- `META_ECONOMY` (em `meta.ts`) passa a vir do JSON.
- Cada `DifficultyDef` em `difficulty.ts` pega `fossilMult` e `firstWinBonus` do JSON pelo `id`. Nome, descrição, cor e multiplicadores de inimigos continuam no TS.
- Cada `ShopItemDef` em `meta.ts` pega `costs` do JSON pelo `id`. Nome, descrição e efeitos continuam no TS.
- Um id presente no TS e ausente no JSON (ou o contrário) causa erro na carga do módulo, e por isso também nos testes.
- O JSON é importado com `with { type: 'json' }`, que funciona no Vite e no Node. Como `meta.ts` passa a importar módulos de verdade (antes só importava tipos), os scripts `balance*` passam a usar o mesmo loader dos testes (`tools/balance/loader/register.mjs`), que resolve imports sem extensão.
- `RunState` ganha um campo `id` (UUID gerado no início da run), usado como chave de idempotência em `POST /api/runs`.

### No servidor

O pacote `economy` tem as funções puras `fossilsForRun`, `masteryXpForRun`, `masteryLevel`, `highestUnlocked` e `difficultyIndex`, todas reproduzindo exatamente o TS atual, incluindo os `Math.floor` e o laço de `masteryLevel`.

### Paridade

`shared/economy-cases.json` traz uma lista de casos `{input, expected}` cobrindo: run curta sem chefe, vitória em cada dificuldade, modo Sem Fim, XP na borda de cada nível e XP acima do máximo.

- `npm run test:economy` (no cliente) e `EconomyParityTest` (JUnit) rodam os mesmos casos.
- Os valores `expected` são gerados uma vez a partir do TS atual, que é o comportamento de referência.

## 6. Mudanças no cliente

### `SaveStore`

```ts
interface SaveStore {
  readonly kind: 'local' | 'cloud';
  current(): SaveData;
  recordRun(state: RunState, victory: boolean): Promise<{ save: SaveData; rewards: RunRewards }>;
  recordClear(dino: DinoId, difficulty: DifficultyId): Promise<FirstClear | undefined>;
  purchase(dino: DinoId, item: ShopItemDef): Promise<SaveData | null>;
  rememberDifficulty(dino: DinoId, id: DifficultyId): void;
  markPatchSeen(version: string): void;
}
```

- **`LocalSaveStore`:** a lógica atual de `Save.ts` (load/write no localStorage), embrulhada em `Promise.resolve`. O comportamento do visitante não muda.
- **`CloudSaveStore`:** guarda o `SaveData` em memória. Cada comando chama a API e substitui a memória pelo `save` da resposta. `rememberDifficulty` e `markPatchSeen` atualizam a memória na hora e enviam o `PATCH` sem esperar; uma falha só gera log.
- **`saveStore()` / `setSaveStore()`** guardam a implementação ativa.
- As funções puras (`shopLevel`, `purchaseStatus`, `clearedIndex`, `isDifficultyUnlocked`, `preferredDifficulty`, `metaLoadout(dino, save)`) continuam em `Save.ts`. Quem hoje chama `loadSave()` passa a chamar `saveStore().current()`.
- **`debugGrant`:** só funciona com `kind === 'local'`. No modo nuvem, o botão de debug não aparece.

### Fluxos assíncronos

- **`ResultScene`:** mostra "Salvando…" enquanto aguarda `recordRun`, depois exibe as recompensas.
- **`LairScene`:** desabilita os botões de compra durante o pedido; um erro aparece como aviso curto.
- **`RunScene` (chefe derrotado):** `recordClear` usa `fetch(..., { keepalive: true })`; quando a resposta chega, preenche `state.firstClear`.

### Fila de runs pendentes

Se `recordRun` falhar no modo nuvem (rede ou `5xx`):

- o `RunRequest` é gravado em `localStorage['dino-pending-runs']`;
- a `ResultScene` mostra "Não foi possível salvar agora; tentaremos de novo" com as recompensas **calculadas localmente**, só para exibição;
- na próxima abertura do jogo no modo nuvem, a fila é reenviada em ordem, antes do `GET save`. Como o `id` é idempotente, reenviar é seguro.
- Uma resposta `4xx` tira o item da fila e gera log.

### Cliente HTTP (`client/src/net/api.ts`)

- `fetch` relativo a `/api`; injeta `Authorization`.
- Se receber `401`, chama `POST /api/auth/refresh` **uma vez** (com uma única promessa compartilhada entre pedidos simultâneos) e repete o pedido.
- Se o refresh falhar, apaga a marca de login, troca para o `LocalSaveStore` e avisa a cena.
- Converte `ProblemDetail` em `ApiError { status, code, message }`.

### Abertura do jogo (`BootScene`)

- Se `localStorage['dino-logged-in'] === '1'`: tenta `refresh`, reenvia a fila de runs, faz `GET save` e ativa o `CloudSaveStore`.
- Enquanto isso, mostra "Conectando…". Depois de 8 s, aparece também o botão "Jogar como visitante": a sessão segue com o `LocalSaveStore` sem apagar a marca de login.
- Se a marca não existir, usa o `LocalSaveStore` direto.

### Tela de conta (modal HTML)

- Um `<div>` sobre o canvas, com estilos derivados de `ui/theme.ts`, criado e destruído por `client/src/ui-dom/AuthModal.ts`.
- Abas "Entrar" e "Criar conta", com campos de e-mail, senha e nome (só no cadastro) e mensagens de erro vindas do `code`.
- Botão do Google pelo Google Identity Services (`accounts.google.com/gsi/client`, carregado sob demanda), configurado com `VITE_GOOGLE_CLIENT_ID`. O *credential* recebido vai para `POST /api/auth/google`.
- Depois de entrar:
  - marca `dino-logged-in = 1`;
  - faz `GET save`;
  - se o save local tem progresso (`runs > 0`) e a conta tem `runs === 0`, pergunta "Importar o progresso deste navegador?". "Sim" chama `/import`.
  - ativa o `CloudSaveStore`.
- No `MenuScene`: o botão "Entrar" (ou "Nome · Sair") só aparece com `VITE_API_ENABLED === 'true'`. "Sair" chama `/logout`, apaga a marca e volta para o `LocalSaveStore`.

## 7. Testes

### Servidor

- **Unitários (JUnit puro):** `economy` (fórmulas e `EconomyParityTest`), regra de ligação de conta Google e geração/hash de refresh token.
- **Integração (`@SpringBootTest` + MockMvc + Testcontainers `postgres:16`)**, com o Flyway rodando as migrations reais:
  - cadastro (sucesso, e-mail duplicado, validação), login (sucesso, senha errada, conta só-Google);
  - refresh (rotação; reuso revoga todas as sessões); logout;
  - Google: as três ramificações da regra do mesmo e-mail, incluindo a remoção da senha (`GoogleTokenVerifier` substituído por um *stub* via `@TestConfiguration`);
  - rotas do jogo sem token → `401`;
  - importação: sucesso, segunda importação → `409`, valores inválidos → `400`;
  - run: recompensas corretas, reenvio idempotente, vitória aplica o clear, consistência inválida → `400`;
  - clear: primeira vez paga, segunda não;
  - compra: sucesso, sem saldo, item no máximo, item inexistente;
  - concorrência: duas compras simultâneas com saldo para uma só, das quais exatamente uma passa;
  - preferências: dificuldade bloqueada → `409`.

### Cliente

- `npm run test:economy`: casos de paridade, no estilo dos scripts de `tools/balance`.
- `npm test` passa a incluir `test:economy`.
- Verificação manual (roteiro no plano): jogar como visitante, criar conta, importar, comprar, terminar uma run, entrar pelo Google com o mesmo e-mail, derrubar a API no meio de uma run e conferir a fila de pendentes.

### CI (`.github/workflows/ci.yml`)

Em push e PR: job `server` (`./mvnw verify`, JDK 21; o Testcontainers usa o Docker do runner) e job `client` (`npm ci`, `npm run typecheck`, `npm test`).

## 8. Configuração e passos manuais

- **Variáveis do servidor:** `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `COOKIE_SECURE` (padrão `true`). O `application-dev.yml` traz valores de desenvolvimento, exceto `GOOGLE_CLIENT_ID`.
- **Variáveis do cliente:** `VITE_API_ENABLED`, `VITE_GOOGLE_CLIENT_ID` (`client/.env.example` com as duas).
- **Passos do dono do projeto:**
  1. instalar Docker Desktop (com WSL2) e JDK 21;
  2. criar um OAuth Client ID (tipo *Web*) no Google Cloud Console, com origens autorizadas `http://localhost:5173` e o domínio da Vercel;
  3. trocar o Root Directory da Vercel para `client` antes do merge na `main`.

## Critérios de pronto

- Visitante joga exatamente como antes (sem regressão no save local).
- É possível criar conta, entrar com senha e com Google, e o progresso aparece igual em outro navegador.
- Fósseis e maestria só mudam por endpoints que calculam no servidor; um `SaveData` adulterado no cliente não altera a conta (exceto na importação única, documentada).
- `./mvnw verify` e `npm test` passam localmente e no CI.
- README explica como rodar (`docker compose up`, `./mvnw spring-boot:run`, `npm run dev`), a arquitetura e as decisões de segurança.
