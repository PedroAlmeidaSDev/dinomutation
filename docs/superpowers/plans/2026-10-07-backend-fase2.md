# Backend fase 2 (contas e save na nuvem): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao DinoMutation uma API Spring Boot com login (e-mail/senha e Google) e save na nuvem, em que o servidor calcula Fósseis e maestria, mantendo o modo visitante igual ao de hoje.

**Architecture:** Monorepo com `client/` (o jogo Phaser atual), `server/` (Spring Boot, monólito organizado por funcionalidade) e `shared/economy.json` (os números da economia, lidos pelos dois lados). O jogo passa a falar com a persistência por uma interface `SaveStore`, com duas implementações: `LocalSaveStore` (localStorage, o comportamento atual) e `CloudSaveStore` (API). Autenticação com JWT próprio de 15 min e refresh token rotativo num cookie httpOnly; o jogo e a API ficam na mesma origem (proxy do Vite / rewrite da Vercel).

**Tech Stack:** Java 21, Spring Boot 4.1.1 (Spring Security 7, Spring Data JPA/Hibernate 7, Jackson 3), PostgreSQL 16, Flyway, springdoc-openapi 3.1.1, JUnit 6 + MockMvc + Testcontainers 2; TypeScript + Phaser 3 + Vite (cliente, sem dependências novas); GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-05-backend-fase2-design.md`

## Global Constraints

- Java 21; Spring Boot **4.1.1** (parent do Maven); `springdoc-openapi-starter-webmvc-ui` **3.1.1**; banco `postgres:16-alpine`; versões do Testcontainers vêm do BOM do Boot.
- Jackson 3: classes em `tools.jackson.*`; as anotações continuam em `com.fasterxml.jackson.annotation.*`.
- `spring.jpa.hibernate.ddl-auto: validate`. O schema só muda por migration Flyway (`server/src/main/resources/db/migration`).
- Erros da API: `ProblemDetail` (RFC 9457) com a propriedade `code`, um destes: `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `INSUFFICIENT_FOSSILS`, `ITEM_MAXED`, `ITEM_NOT_FOUND`, `DIFFICULTY_LOCKED`, `ALREADY_IMPORTED`, `CONFLICT`.
- Ids: dinos `trex`, `raptor`, `triceratops`; dificuldades `filhote`, `normal`, `predador`, `extincao` (essa ordem define o índice; `cleared_index = -1` = nenhuma vencida).
- Access token: JWT HS256, `iss = dinomutation`, 15 min. Refresh token: 32 bytes aleatórios em base64url, 30 dias, cookie `refresh_token` com `HttpOnly; SameSite=Strict; Path=/api/auth` (`Secure` controlado por `app.cookie.secure`). O banco guarda só o SHA-256 em hex.
- Senha: 8 a 72 caracteres **e** no máximo 72 bytes em UTF-8. `displayName`: 2 a 40. E-mail: até 254, guardado com `trim` + minúsculas.
- `RunRequest.elapsedTime` ≤ 14400; `upgrades` ≤ 100 itens; maestria importada ≤ 10.000.000.
- Comentários de código em inglês (padrão do repositório); textos de UI, mensagens de erro e documentação em português.
- Commits no padrão do repositório (`feat:`, `test:`, `chore:`, `docs:` + descrição em português), sempre terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- O modo visitante (sem login) precisa continuar idêntico ao atual.
- O cliente não ganha dependências npm novas.
- Comandos rodam no Git Bash, a partir da raiz do repositório, salvo indicação contrária. Branch de trabalho: `feat/backend-fase2`.

## Pré-requisitos (ação do dono do projeto)

Estes passos não podem ser feitos pelo agente; a Task 3 verifica e para se faltarem:

1. **JDK 21** instalado e no `PATH`/`JAVA_HOME` (por exemplo `winget install EclipseAdoptium.Temurin.21.JDK`). O JDK 17 pode continuar instalado.
2. **Docker Desktop** rodando, com WSL2 (`winget install Docker.DockerDesktop`; pede reinício).
3. **Google OAuth Client ID** (só necessário para testar o botão do Google à mão, Task 17): Google Cloud Console → APIs e serviços → Credenciais → Criar ID do cliente OAuth → tipo *Aplicativo da Web*, com origens JavaScript autorizadas `http://localhost:5173` e o domínio da Vercel.
4. **Vercel:** antes do merge na `main`, trocar *Root Directory* para `client` e deixar ligada a opção *Include files outside the Root Directory in the Build Step*.

## Mapa de arquivos

```
client/                                  (Task 1: tudo que hoje está na raiz do jogo)
├── package.json                         scripts: balance* via loader, test:economy, test:net
├── vite.config.ts                       fs.allow + proxy /api
├── .env.example                         VITE_API_ENABLED, VITE_GOOGLE_CLIENT_ID
├── src/
│   ├── data/economy.ts                  NOVO: lê shared/economy.json, valida ids
│   ├── data/meta.ts, difficulty.ts, dinosaurs.ts     custos/multiplicadores vindos do JSON
│   ├── utils/uuid.ts                    NOVO: UUID v4 sem depender de contexto seguro
│   ├── net/api.ts                       NOVO: fetch + Bearer + refresh com promessa única
│   ├── net/env.ts                       NOVO: flags de build
│   ├── ui-dom/AuthModal.ts, google.ts   NOVO: modal HTML de login e Google Identity Services
│   └── game/
│       ├── core/Save.ts                 vira: tipos + regras puras (applyRun, applyClear, applyPurchase…)
│       ├── core/RunState.ts             ganha `id`
│       ├── core/save/SaveStore.ts       NOVO: interface + store ativo
│       ├── core/save/LocalSaveStore.ts  NOVO: localStorage (comportamento atual)
│       ├── core/save/CloudSaveStore.ts  NOVO: API
│       ├── core/save/pendingRuns.ts     NOVO: fila de runs não enviadas
│       ├── core/save/apiTypes.ts        NOVO: DTOs da API
│       ├── core/save/session.ts         NOVO: retomar sessão, entrar, importar, sair
│       └── scenes/*                     Boot, Menu, CharacterSelect, Lair, Run, Result
└── tools/
    ├── economy/economy-test.ts          NOVO: paridade
    └── net/api-test.ts, cloud-test.ts, session-test.ts   NOVOS
shared/economy.json, shared/economy-cases.json            NOVOS
server/                                  NOVO (Spring Boot)
└── src/main/java/com/dinomutation/
    ├── ServerApplication.java
    ├── common/   AppConfig, AppProperties, ErrorCode, ApiException, GlobalExceptionHandler,
    │             SecurityConfig, CurrentPlayer, OptimisticRetry, OpenApiConfig
    ├── economy/  DinoId, DifficultyId, EconomyConfig, RunFacts, Economy
    ├── auth/     JwtConfig, AccessToken(Service), RefreshToken(+Repository, Service), RefreshCookies,
    │             AuthService, AuthController, GoogleTokenVerifier, NimbusGoogleTokenVerifier, DTOs
    ├── player/   Player, DinoProgress, ShopKey, PlayerRepository, SaveDto, ProgressRules,
    │             SaveImporter, PlayerService, PlayerController, DTOs
    ├── run/      GameRun, UpgradeEntry, GameRunRepository, RunService, RunController, DTOs
    └── shop/     ShopService, ShopController, DTOs
docker-compose.yml, .github/workflows/ci.yml, README.md                    NOVOS
```

---

## Parte A: monorepo e economia compartilhada

### Task 1: Mover o jogo para `client/`

**Files:**
- Move: `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `src/`, `tools/` → `client/`
- `docs/`, `.gitignore` e `.superpowers/` ficam na raiz.

**Interfaces:**
- Consumes: nada.
- Produces: o jogo funcionando a partir de `client/` (todas as tasks seguintes usam `client/...`).

- [ ] **Step 1: Confirmar o ponto de partida**

```bash
git status --short
git branch --show-current
```
Expected: nenhuma alteração pendente; branch `feat/backend-fase2`.

- [ ] **Step 2: Mover com histórico**

```bash
mkdir client
git mv index.html package.json package-lock.json tsconfig.json vite.config.ts src tools client/
rm -rf node_modules dist
```

As entradas `node_modules` e `dist` do `.gitignore` não têm barra inicial, então continuam valendo dentro de `client/`.

- [ ] **Step 3: Instalar e verificar tudo**

```bash
cd client && npm ci && npm run typecheck && npm test && npm run build
```
Expected: `typecheck` sem erros; os três testes (`test:boss`, `test:endless`, `test:save`) terminam com `Tudo certo`; o build gera `client/dist/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: move o jogo para client/ (monorepo)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Economia em `shared/economy.json`, com teste de paridade

**Files:**
- Create: `shared/economy-cases.json`, `shared/economy.json`, `client/src/data/economy.ts`, `client/tools/economy/economy-test.ts`
- Modify: `client/package.json` (scripts), `client/src/data/meta.ts`, `client/src/data/difficulty.ts`, `client/src/data/dinosaurs.ts`, `client/vite.config.ts`

**Interfaces:**
- Consumes: `fossilsForRun`, `masteryXpForRun`, `masteryLevel` (`client/src/data/meta.ts`); `DIFFICULTY_BY_ID` (`client/src/data/difficulty.ts`).
- Produces:
  - `shared/economy.json` com o formato `{ dinos, fossils, mastery, difficulties[{id, fossilMult, firstWinBonus}], shop{dino: [{id, costs}]} }`, que o servidor também lê (Task 4).
  - `shared/economy-cases.json` com `{ runs: [{name, input:{difficulty, elapsedTime, kills, eliteKilled, bossKilled}, expected:{fossils, masteryXp}}], masteryLevels: [{xp, level}] }`, usado também pelo `EconomyParityTest` (Task 4).
  - `client/src/data/economy.ts`: `ECONOMY: EconomyData`, `difficultyEconomy(id)`, `itemCosts(dino, id)`, `assertSameIds(what, ts, json)`.
  - Script `npm run test:economy`.

- [ ] **Step 1: Escrever os casos de paridade**

Os valores `expected` foram calculados com o código atual (antes de qualquer mudança), que é a referência. Crie `shared/economy-cases.json`:

```json
{
  "runs": [
    {
      "name": "derrota curta sem chefe (Normal)",
      "input": { "difficulty": "normal", "elapsedTime": 95.4, "kills": 59, "eliteKilled": false, "bossKilled": false },
      "expected": { "fossils": 23, "masteryXp": 23 }
    },
    {
      "name": "derrota com elite (Filhote)",
      "input": { "difficulty": "filhote", "elapsedTime": 412.7, "kills": 361, "eliteKilled": true, "bossKilled": false },
      "expected": { "fossils": 111, "masteryXp": 143 }
    },
    {
      "name": "vitória Normal",
      "input": { "difficulty": "normal", "elapsedTime": 900, "kills": 1240, "eliteKilled": true, "bossKilled": true },
      "expected": { "fossils": 405, "masteryXp": 365 }
    },
    {
      "name": "vitória Predador",
      "input": { "difficulty": "predador", "elapsedTime": 903.25, "kills": 1317, "eliteKilled": true, "bossKilled": true },
      "expected": { "fossils": 569, "masteryXp": 365 }
    },
    {
      "name": "vitória Extinção",
      "input": { "difficulty": "extincao", "elapsedTime": 911.9, "kills": 1402, "eliteKilled": true, "bossKilled": true },
      "expected": { "fossils": 739, "masteryXp": 367 }
    },
    {
      "name": "Era Sem Fim (Filhote)",
      "input": { "difficulty": "filhote", "elapsedTime": 1733.3, "kills": 3020, "eliteKilled": true, "bossKilled": true },
      "expected": { "fossils": 482, "masteryXp": 573 }
    },
    {
      "name": "run vazia",
      "input": { "difficulty": "normal", "elapsedTime": 0, "kills": 0, "eliteKilled": false, "bossKilled": false },
      "expected": { "fossils": 0, "masteryXp": 0 }
    }
  ],
  "masteryLevels": [
    { "xp": 0, "level": 1 },
    { "xp": 99, "level": 1 },
    { "xp": 100, "level": 2 },
    { "xp": 299, "level": 2 },
    { "xp": 300, "level": 3 },
    { "xp": 599, "level": 3 },
    { "xp": 600, "level": 4 },
    { "xp": 4499, "level": 9 },
    { "xp": 4500, "level": 10 },
    { "xp": 99999, "level": 10 }
  ]
}
```

- [ ] **Step 2: Escrever o teste de paridade do cliente**

Crie `client/tools/economy/economy-test.ts`:

```ts
/**
 * Paridade da economia: os mesmos casos de shared/economy-cases.json rodam aqui e no
 * servidor (EconomyParityTest). Se uma fórmula mudar só de um lado, um dos testes falha.
 *
 * Uso: npm run test:economy
 */
import cases from '../../../shared/economy-cases.json' with { type: 'json' };
import { DIFFICULTY_BY_ID, type DifficultyId } from '../../src/data/difficulty.ts';
import { fossilsForRun, masteryLevel, masteryXpForRun } from '../../src/data/meta.ts';

let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? '  ✔' : '  ✘'} ${msg}`);
  if (!ok) failures++;
};

console.log('\n── Recompensas por run ──');
for (const c of cases.runs) {
  const input = { ...c.input, fossilMult: DIFFICULTY_BY_ID[c.input.difficulty as DifficultyId].fossilMult };
  const fossils = fossilsForRun(input);
  const xp = masteryXpForRun(input);
  check(
    fossils === c.expected.fossils && xp === c.expected.masteryXp,
    `${c.name}: ${fossils} fósseis (esperado ${c.expected.fossils}), ${xp} XP (esperado ${c.expected.masteryXp})`,
  );
}

console.log('\n── Nível de maestria ──');
for (const c of cases.masteryLevels) {
  const level = masteryLevel(c.xp);
  check(level === c.level, `${c.xp} XP → nível ${level} (esperado ${c.level})`);
}

console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo');
process.exit(failures ? 1 : 0);
```

- [ ] **Step 3: Ajustar os scripts do `client/package.json`**

Troque o bloco `"scripts"` inteiro por:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "balance": "node --experimental-transform-types --no-warnings --import ./tools/balance/loader/register.mjs tools/balance/sim.ts",
    "balance:antes": "node --experimental-transform-types --no-warnings --import ./tools/balance/loader/register.mjs tools/balance/sim.ts --antes",
    "balance:carreira": "node --experimental-transform-types --no-warnings --import ./tools/balance/loader/register.mjs tools/balance/sim.ts 40 --carreira",
    "test:boss": "node --experimental-transform-types --no-warnings --import ./tools/balance/loader/register.mjs tools/balance/boss-test.ts",
    "test:endless": "node --experimental-transform-types --no-warnings --import ./tools/balance/loader/register.mjs tools/balance/endless-test.ts",
    "test:save": "node --experimental-transform-types --no-warnings --import ./tools/balance/loader/register.mjs tools/balance/save-test.ts",
    "test:economy": "node --experimental-transform-types --no-warnings --import ./tools/balance/loader/register.mjs tools/economy/economy-test.ts",
    "test": "npm run test:boss && npm run test:endless && npm run test:save && npm run test:economy"
  },
```

Os scripts `balance*` passam a usar o loader porque, depois do Step 7, `meta.ts` importa módulos sem extensão (antes só importava tipos), e o Node puro não resolve esses imports.

- [ ] **Step 4: Rodar a paridade contra o código atual (linha de base)**

```bash
cd client && npm run test:economy
```
Expected: todos os itens com `✔` e `Tudo certo` (os valores vieram deste código; isso prova que o teste lê os casos corretamente).

- [ ] **Step 5: Criar `shared/economy.json`**

```json
{
  "dinos": ["trex", "raptor", "triceratops"],
  "fossils": { "perMinute": 15, "perKills": 60, "elite": 40, "boss": 120 },
  "mastery": { "secondsPerXp": 4, "elite": 40, "boss": 100, "maxLevel": 10, "xpPerLevel": 100 },
  "difficulties": [
    { "id": "filhote", "fossilMult": 0.75, "firstWinBonus": 60 },
    { "id": "normal", "fossilMult": 1, "firstWinBonus": 150 },
    { "id": "predador", "fossilMult": 1.4, "firstWinBonus": 250 },
    { "id": "extincao", "fossilMult": 1.8, "firstWinBonus": 400 }
  ],
  "shop": {
    "trex": [
      { "id": "meta_vida", "costs": [30, 70, 150, 300, 480] },
      { "id": "meta_dano", "costs": [30, 70, 150, 300, 480] },
      { "id": "meta_armadura", "costs": [30, 70, 150, 300, 480] },
      { "id": "meta_genes", "costs": [30, 70, 150, 300, 480] },
      { "id": "meta_trex_crit", "costs": [30, 70, 150, 300, 480] }
    ],
    "raptor": [
      { "id": "meta_vida", "costs": [30, 70, 150, 300, 480] },
      { "id": "meta_dano", "costs": [30, 70, 150, 300, 480] },
      { "id": "meta_armadura", "costs": [30, 70, 150, 300, 480] },
      { "id": "meta_genes", "costs": [30, 70, 150, 300, 480] },
      { "id": "meta_raptor_claw", "costs": [30, 70, 150, 300, 480] }
    ],
    "triceratops": [
      { "id": "meta_vida", "costs": [30, 70, 150, 300, 480] },
      { "id": "meta_dano", "costs": [30, 70, 150, 300, 480] },
      { "id": "meta_armadura", "costs": [30, 70, 150, 300, 480] },
      { "id": "meta_genes", "costs": [30, 70, 150, 300, 480] },
      { "id": "meta_tri_horn", "costs": [30, 70, 150, 300, 480] }
    ]
  }
}
```

- [ ] **Step 6: Criar `client/src/data/economy.ts`**

```ts
import data from '../../../shared/economy.json' with { type: 'json' };

/**
 * Economy numbers shared with the server (shared/economy.json): the API pays Fósseis and
 * mastery with the same values, so they live in one file both sides read. Names, colours
 * and effects stay in TS: only the game needs them.
 */
export interface EconomyDifficulty {
  id: string;
  fossilMult: number;
  firstWinBonus: number;
}

export interface EconomyShopItem {
  id: string;
  costs: number[];
}

export interface EconomyData {
  dinos: string[];
  fossils: { perMinute: number; perKills: number; elite: number; boss: number };
  mastery: { secondsPerXp: number; elite: number; boss: number; maxLevel: number; xpPerLevel: number };
  difficulties: EconomyDifficulty[];
  shop: Record<string, EconomyShopItem[]>;
}

export const ECONOMY: EconomyData = data;

export function difficultyEconomy(id: string): EconomyDifficulty {
  const d = ECONOMY.difficulties.find((x) => x.id === id);
  if (!d) throw new Error(`economy.json: a dificuldade "${id}" não existe`);
  return d;
}

/** Fossil cost of each level of a shop item; the item must be sold to `dino` in economy.json. */
export function itemCosts(dino: string, id: string): number[] {
  const item = ECONOMY.shop[dino]?.find((x) => x.id === id);
  if (!item) throw new Error(`economy.json: o item "${id}" não existe na loja de "${dino}"`);
  return item.costs;
}

/** Throws when the ids defined in TS and in economy.json diverge (checked at module load). */
export function assertSameIds(what: string, ts: readonly string[], json: readonly string[]): void {
  const a = ts.join(',');
  const b = json.join(',');
  if (a !== b) throw new Error(`economy.json: ${what} diverge do TS (TS: ${a} · JSON: ${b})`);
}
```

- [ ] **Step 7: Fazer `meta.ts` ler o JSON**

Em `client/src/data/meta.ts`:

1. Logo abaixo dos imports existentes, adicione:
```ts
import { ECONOMY, assertSameIds, itemCosts } from './economy';
```
2. Troque o bloco `export const META_ECONOMY = { ... };` (as 4 linhas com `fossils` e `mastery`) por:
```ts
export const META_ECONOMY = { fossils: ECONOMY.fossils, mastery: ECONOMY.mastery };
```
3. Troque tudo, desde o comentário `/** Five tiers per item: ... */` com `const COSTS = [...]` até o fim do `export const SHOP = { ... };`, por:
```ts
/**
 * Items every dinosaur sells. Costs come from shared/economy.json: five tiers per item,
 * cheap first steps for a quick sense of progress, pricey late ones.
 */
const sharedItems = (dino: DinoId): ShopItemDef[] => [
  {
    id: 'meta_vida', name: 'Ossos Robustos', description: '+12% de vida máxima por nível.',
    effects: [{ type: 'stat', stat: 'maxHealth', mode: 'mult', value: 0.12 }], costs: itemCosts(dino, 'meta_vida'),
  },
  {
    id: 'meta_dano', name: 'Músculos Ancestrais', description: '+12% de dano por nível.',
    effects: [{ type: 'stat', stat: 'damage', mode: 'mult', value: 0.12 }], costs: itemCosts(dino, 'meta_dano'),
  },
  {
    id: 'meta_armadura', name: 'Couro Curtido', description: '+5 de armadura por nível.',
    effects: [{ type: 'stat', stat: 'armor', mode: 'add', value: 5 }], costs: itemCosts(dino, 'meta_armadura'),
  },
  {
    id: 'meta_genes', name: 'Genes Adaptativos', description: '+6% de DNA (XP) ganho por nível.',
    effects: [{ type: 'stat', stat: 'xpGain', mode: 'mult', value: 0.06 }], costs: itemCosts(dino, 'meta_genes'),
  },
];

const SIGNATURE_ITEMS: Record<DinoId, ShopItemDef> = {
  trex: {
    id: 'meta_trex_crit', name: 'Mandíbula Ancestral', description: '+3% de chance de crítico por nível.',
    effects: [{ type: 'stat', stat: 'critChance', mode: 'add', value: 0.03 }], costs: itemCosts('trex', 'meta_trex_crit'),
  },
  raptor: {
    id: 'meta_raptor_claw', name: 'Garras Afiadas', description: '+8% de dano de garra por nível.',
    effects: [{ type: 'stat', stat: 'dmg_claw', mode: 'add', value: 0.08 }], costs: itemCosts('raptor', 'meta_raptor_claw'),
  },
  triceratops: {
    id: 'meta_tri_horn', name: 'Chifres Afiados', description: '+8% de dano de chifrada por nível.',
    effects: [{ type: 'stat', stat: 'dmg_horn', mode: 'add', value: 0.08 }], costs: itemCosts('triceratops', 'meta_tri_horn'),
  },
};

export const SHOP: Record<DinoId, ShopItemDef[]> = {
  trex: [...sharedItems('trex'), SIGNATURE_ITEMS.trex],
  raptor: [...sharedItems('raptor'), SIGNATURE_ITEMS.raptor],
  triceratops: [...sharedItems('triceratops'), SIGNATURE_ITEMS.triceratops],
};

for (const dino of Object.keys(SHOP) as DinoId[]) {
  assertSameIds(`loja de ${dino}`, SHOP[dino].map((i) => i.id), (ECONOMY.shop[dino] ?? []).map((i) => i.id));
}
```

Antes de apagar o bloco antigo, confira que nomes, descrições e efeitos dos itens são exatamente estes (o código acima os copia do arquivo atual); se algum texto tiver mudado no repositório, mantenha o texto do repositório.

- [ ] **Step 8: Fazer `difficulty.ts` ler o JSON**

Em `client/src/data/difficulty.ts`:

1. No topo, adicione:
```ts
import { ECONOMY, assertSameIds, difficultyEconomy } from './economy';
```
2. Logo antes de `export const DIFFICULTIES`, adicione:
```ts
/** Fósseis multiplier and first-win bonus live in shared/economy.json (the server pays them too). */
const pay = (id: DifficultyId): Pick<DifficultyDef, 'fossilMult' | 'firstWinBonus'> => {
  const { fossilMult, firstWinBonus } = difficultyEconomy(id);
  return { fossilMult, firstWinBonus };
};
```
3. Em cada uma das 4 entradas de `DIFFICULTIES`, troque `fossilMult: X, firstWinBonus: Y,` por `...pay('<id da entrada>'),`. Por exemplo, a primeira fica:
```ts
  {
    id: 'filhote', name: 'Filhote', description: 'Para aprender. Inimigos e chefe bem mais fracos.', color: 0x8ad06a,
    enemyHp: 0.75, enemyDamage: 0.7, bossHp: 0.6, bossDamage: 0.55, ...pay('filhote'),
  },
```
(e da mesma forma `...pay('normal')`, `...pay('predador')`, `...pay('extincao')`).
4. Logo depois do array `DIFFICULTIES`, adicione:
```ts
assertSameIds('dificuldades', DIFFICULTIES.map((d) => d.id), ECONOMY.difficulties.map((d) => d.id));
```

- [ ] **Step 9: Conferir os dinos em `dinosaurs.ts`**

Em `client/src/data/dinosaurs.ts`, adicione no topo:
```ts
import { ECONOMY, assertSameIds } from './economy';
```
e no fim do arquivo, depois de `export const DINO_ORDER`:
```ts
assertSameIds('dinos', DINO_ORDER, ECONOMY.dinos);
```

- [ ] **Step 10: Permitir que o Vite leia `../shared`**

Troque `client/vite.config.ts` por:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
  },
  server: {
    // shared/economy.json lives outside client/.
    fs: { allow: ['..'] },
  },
});
```

- [ ] **Step 11: Verificar tudo**

```bash
cd client && npm run typecheck && npm test && npm run build && npm run balance -- 20
```
Expected:
- `typecheck` sem erros;
- os quatro testes terminam com `Tudo certo`;
- o build gera `dist/`;
- o simulador roda e imprime a tabela de vitórias.

Se o build reclamar da sintaxe `with { type: 'json' }`, pare e reporte (é a única suposição sobre a toolchain nesta task).

- [ ] **Step 12: Provar que a paridade pega uma divergência**

Mude temporariamente `"perMinute": 15` para `16` em `shared/economy.json` e rode `cd client && npm run test:economy`. Expected: falhas com `✘`. Desfaça a mudança e rode de novo. Expected: `Tudo certo`.

- [ ] **Step 13: Commit**

```bash
git add shared client
git commit -m "feat: números da economia em shared/economy.json com teste de paridade

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Parte B: servidor

> Todas as classes Java ficam em `server/src/main/java/com/dinomutation/...` e os testes em `server/src/test/java/com/dinomutation/...`; os caminhos abaixo omitem esse prefixo quando o pacote já deixa claro. Os comandos `./mvnw` rodam dentro de `server/`.

### Task 3: Esqueleto do servidor

**Files:**
- Create (gerados): `server/pom.xml`, `server/mvnw`, `server/mvnw.cmd`, `server/.mvn/`, `server/.gitattributes`, `server/.gitignore`, `ServerApplication.java`, `TestServerApplication.java`
- Create: `server/src/main/resources/application.yml`, `server/src/main/resources/application-dev.yml`, `server/src/test/resources/application-test.yml`, `docker-compose.yml`
- Create (test): `TestcontainersConfiguration.java`, `IntegrationTest.java`
- Modify (test, gerado): `ServerApplicationTests.java`

**Interfaces:**
- Consumes: `shared/economy.json` (copiado para o classpath como `/economy.json`).
- Produces:
  - `com.dinomutation.IntegrationTest`: classe base abstrata dos testes de integração, com os campos `protected MockMvc mvc` e `protected JdbcTemplate jdbc` e a limpeza do banco antes de cada teste.
  - `com.dinomutation.TestcontainersConfiguration` (pública).
  - Propriedades `app.jwt.secret`, `app.jwt.access-ttl`, `app.jwt.refresh-ttl`, `app.google.client-id`, `app.cookie.secure`.

- [ ] **Step 1: Verificar os pré-requisitos**

```bash
java -version
docker info --format '{{.ServerVersion}}'
```
Expected: `java -version` mostra 21 ou mais e o `docker info` imprime uma versão. **Se algum falhar, pare** e peça ao dono do projeto para fazer os pré-requisitos 1 e 2 do topo deste plano.

- [ ] **Step 2: Gerar o projeto no Spring Initializr**

```bash
curl -s https://start.spring.io/starter.zip \
  -d type=maven-project -d bootVersion=4.1.1 -d javaVersion=21 \
  -d groupId=com.dinomutation -d artifactId=server -d name=server -d packageName=com.dinomutation \
  -d dependencies=web,security,oauth2-resource-server,data-jpa,validation,postgresql,flyway,testcontainers,actuator \
  -o server.zip
unzip -q server.zip -d server && rm server.zip
rm server/HELP.md server/src/main/resources/application.properties
git add server/mvnw && git update-index --chmod=+x server/mvnw
```
Expected: `server/pom.xml` com parent `spring-boot-starter-parent` 4.1.1 e os starters `spring-boot-starter-webmvc`, `-security`, `-security-oauth2-resource-server`, `-data-jpa`, `-validation`, `-flyway`, `-actuator` (mais os `-test` correspondentes, `spring-boot-testcontainers`, `testcontainers-junit-jupiter`, `testcontainers-postgresql`).

- [ ] **Step 3: Completar o `pom.xml`**

Em `server/pom.xml`, dentro de `<dependencies>`, adicione:
```xml
		<dependency>
			<groupId>org.springdoc</groupId>
			<artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
			<version>3.1.1</version>
		</dependency>
```
E troque o bloco `<build>` inteiro por:
```xml
	<build>
		<resources>
			<resource>
				<directory>src/main/resources</directory>
			</resource>
			<!-- Economy numbers shared with the game (client/src/data/economy.ts). -->
			<resource>
				<directory>${project.basedir}/../shared</directory>
				<includes>
					<include>economy.json</include>
				</includes>
			</resource>
		</resources>
		<plugins>
			<plugin>
				<groupId>org.springframework.boot</groupId>
				<artifactId>spring-boot-maven-plugin</artifactId>
			</plugin>
		</plugins>
	</build>
```

- [ ] **Step 4: Configuração**

`server/src/main/resources/application.yml`:
```yaml
spring:
  application:
    name: dinomutation-server
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/dinomutation}
    username: ${DB_USER:dino}
    password: ${DB_PASSWORD:dino}
  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: validate

app:
  jwt:
    secret: ${JWT_SECRET:}
    access-ttl: 15m
    refresh-ttl: 30d
  google:
    client-id: ${GOOGLE_CLIENT_ID:}
  cookie:
    secure: ${COOKIE_SECURE:true}

management:
  endpoints:
    web:
      exposure:
        include: health

springdoc:
  swagger-ui:
    path: /swagger-ui
```

`server/src/main/resources/application-dev.yml`:
```yaml
# Local development (./mvnw spring-boot:run -Dspring-boot.run.profiles=dev). Never use in production.
app:
  jwt:
    secret: ${JWT_SECRET:dev-only-secret-change-me-0123456789abcdef}
  cookie:
    secure: ${COOKIE_SECURE:false}
```

`server/src/test/resources/application-test.yml`:
```yaml
app:
  jwt:
    secret: test-secret-0123456789abcdef0123456789abcdef
  google:
    client-id: test-client-id
  cookie:
    secure: false
```

`docker-compose.yml` (na raiz do repositório):
```yaml
# Postgres for local development: docker compose up -d
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: dinomutation
      POSTGRES_USER: dino
      POSTGRES_PASSWORD: dino
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 5: Base dos testes de integração**

Troque `server/src/test/java/com/dinomutation/TestcontainersConfiguration.java` por:
```java
package com.dinomutation;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

	@Bean
	@ServiceConnection
	public PostgreSQLContainer postgresContainer() {
		return new PostgreSQLContainer(DockerImageName.parse("postgres:16-alpine"));
	}

}
```

Crie `server/src/test/java/com/dinomutation/IntegrationTest.java`:
```java
package com.dinomutation;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Base for integration tests: the whole app against a real Postgres (Testcontainers).
 * Every subclass shares one Spring context (and one container), so keep the annotations here.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
public abstract class IntegrationTest {

	@Autowired
	protected MockMvc mvc;

	@Autowired
	protected JdbcTemplate jdbc;

	@BeforeEach
	void cleanDatabase() {
		List<String> tables = jdbc.queryForList(
				"select tablename from pg_tables where schemaname = 'public' and tablename <> 'flyway_schema_history'",
				String.class);
		if (!tables.isEmpty()) {
			jdbc.execute("TRUNCATE " + String.join(", ", tables) + " CASCADE");
		}
	}

}
```

Troque `server/src/test/java/com/dinomutation/ServerApplicationTests.java` por:
```java
package com.dinomutation;

import org.junit.jupiter.api.Test;

class ServerApplicationTests extends IntegrationTest {

	@Test
	void contextLoads() {
	}

}
```

- [ ] **Step 6: Rodar**

```bash
cd server && ./mvnw -q verify
```
Expected: `BUILD SUCCESS`; o log mostra o Testcontainers subindo `postgres:16-alpine` e `contextLoads` passando.

- [ ] **Step 7: Commit**

```bash
git add server docker-compose.yml
git commit -m "chore: esqueleto da API Spring Boot 4.1 com Postgres via Testcontainers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Regras da economia em Java (pacote `economy`)

**Files:**
- Create: `economy/DinoId.java`, `economy/DifficultyId.java`, `economy/EconomyConfig.java`, `economy/RunFacts.java`, `economy/Economy.java`, `common/AppConfig.java`
- Test: `economy/EconomyTest.java`, `economy/EconomyParityTest.java`

**Interfaces:**
- Consumes: `/economy.json` no classpath (Task 3); `shared/economy-cases.json` (Task 2).
- Produces:
  - `enum DinoId { TREX, RAPTOR, TRICERATOPS }` com `String id()` (`@JsonValue`) e `static DinoId fromId(String)` (`@JsonCreator`, lança `IllegalArgumentException`).
  - `enum DifficultyId { FILHOTE, NORMAL, PREDADOR, EXTINCAO }`, com a mesma API.
  - `record EconomyConfig(List<String> dinos, Fossils fossils, Mastery mastery, List<Difficulty> difficulties, Map<String, List<ShopItem>> shop)`, com os records aninhados `Fossils`, `Mastery`, `Difficulty(String id, double fossilMult, int firstWinBonus)` e `ShopItem(String id, List<Integer> costs)`.
  - `record RunFacts(DifficultyId difficulty, double elapsedTime, int kills, boolean eliteKilled, boolean bossKilled)`.
  - `final class Economy` com os métodos:
    - `static Economy loadDefault()`
    - `int fossilsForRun(RunFacts)`, `int masteryXpForRun(RunFacts)`, `int masteryLevel(int xp)`
    - `EconomyConfig.Difficulty difficulty(DifficultyId)`, `int difficultyIndex(DifficultyId)`, `int lastDifficultyIndex()`
    - `int highestUnlocked(int cleared)`, `boolean isUnlocked(DifficultyId, int cleared)`, `Optional<DifficultyId> next(DifficultyId)`
    - `Optional<EconomyConfig.ShopItem> shopItem(DinoId, String itemId)`
  - Beans Spring `Economy` e `Clock` (em `common/AppConfig`).

- [ ] **Step 1: Escrever os testes**

`server/src/test/java/com/dinomutation/economy/EconomyParityTest.java`:
```java
package com.dinomutation.economy;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import tools.jackson.databind.json.JsonMapper;

/** Same cases as client/tools/economy/economy-test.ts: both sides must pay the same. */
class EconomyParityTest {

	record Cases(List<RunCase> runs, List<LevelCase> masteryLevels) {}
	record RunCase(String name, Input input, Expected expected) {}
	record Input(String difficulty, double elapsedTime, int kills, boolean eliteKilled, boolean bossKilled) {}
	record Expected(int fossils, int masteryXp) {}
	record LevelCase(int xp, int level) {}

	private final Economy economy = Economy.loadDefault();
	private final Cases cases = JsonMapper.builder().build()
			.readValue(Path.of("..", "shared", "economy-cases.json").toFile(), Cases.class);

	@TestFactory
	Stream<DynamicTest> runRewardsMatchTheClient() {
		return cases.runs().stream().map(c -> DynamicTest.dynamicTest(c.name(), () -> {
			RunFacts facts = new RunFacts(DifficultyId.fromId(c.input().difficulty()), c.input().elapsedTime(),
					c.input().kills(), c.input().eliteKilled(), c.input().bossKilled());
			assertThat(economy.fossilsForRun(facts)).as("fósseis").isEqualTo(c.expected().fossils());
			assertThat(economy.masteryXpForRun(facts)).as("XP de maestria").isEqualTo(c.expected().masteryXp());
		}));
	}

	@TestFactory
	Stream<DynamicTest> masteryLevelsMatchTheClient() {
		return cases.masteryLevels().stream().map(c -> DynamicTest.dynamicTest(c.xp() + " XP",
				() -> assertThat(economy.masteryLevel(c.xp())).isEqualTo(c.level())));
	}

}
```

`server/src/test/java/com/dinomutation/economy/EconomyTest.java`:
```java
package com.dinomutation.economy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class EconomyTest {

	private final Economy economy = Economy.loadDefault();

	@Test
	void readsTheSharedFile() {
		assertThat(economy.difficulty(DifficultyId.PREDADOR).fossilMult()).isEqualTo(1.4);
		assertThat(economy.difficulty(DifficultyId.NORMAL).firstWinBonus()).isEqualTo(150);
		assertThat(economy.lastDifficultyIndex()).isEqualTo(3);
	}

	@Test
	void unlockLadderFollowsTheGame() {
		assertThat(economy.highestUnlocked(-1)).isZero();
		assertThat(economy.highestUnlocked(0)).isEqualTo(1);
		assertThat(economy.highestUnlocked(3)).isEqualTo(3);
		assertThat(economy.isUnlocked(DifficultyId.FILHOTE, -1)).isTrue();
		assertThat(economy.isUnlocked(DifficultyId.NORMAL, -1)).isFalse();
		assertThat(economy.isUnlocked(DifficultyId.NORMAL, 0)).isTrue();
	}

	@Test
	void nextDifficulty() {
		assertThat(economy.next(DifficultyId.FILHOTE)).contains(DifficultyId.NORMAL);
		assertThat(economy.next(DifficultyId.EXTINCAO)).isEmpty();
	}

	@Test
	void shopItemsArePerDino() {
		assertThat(economy.shopItem(DinoId.TREX, "meta_trex_crit")).get()
				.extracting(EconomyConfig.ShopItem::costs).isEqualTo(List.of(30, 70, 150, 300, 480));
		assertThat(economy.shopItem(DinoId.RAPTOR, "meta_trex_crit")).isEmpty();
	}

	@Test
	void idsRoundTrip() {
		assertThat(DinoId.fromId("triceratops")).isEqualTo(DinoId.TRICERATOPS);
		assertThat(DifficultyId.EXTINCAO.id()).isEqualTo("extincao");
		assertThatThrownBy(() -> DinoId.fromId("stego")).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void rejectsAConfigWhoseDinosDivergeFromTheEnum() {
		EconomyConfig bad = new EconomyConfig(List.of("trex"),
				new EconomyConfig.Fossils(15, 60, 40, 120), new EconomyConfig.Mastery(4, 40, 100, 10, 100),
				List.of(new EconomyConfig.Difficulty("filhote", 0.75, 60), new EconomyConfig.Difficulty("normal", 1, 150),
						new EconomyConfig.Difficulty("predador", 1.4, 250), new EconomyConfig.Difficulty("extincao", 1.8, 400)),
				Map.of());
		assertThatThrownBy(() -> new Economy(bad)).isInstanceOf(IllegalStateException.class).hasMessageContaining("dinos");
	}

}
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd server && ./mvnw -q test -Dtest='Economy*'
```
Expected: erro de compilação (`Economy`, `DinoId`... não existem).

- [ ] **Step 3: Implementar os ids**

`economy/DinoId.java`:
```java
package com.dinomutation.economy;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Playable dinosaurs; `id` is the value used by the game, the JSON and the database. */
public enum DinoId {
	TREX("trex"), RAPTOR("raptor"), TRICERATOPS("triceratops");

	private final String id;

	DinoId(String id) {
		this.id = id;
	}

	@JsonValue
	public String id() {
		return id;
	}

	@JsonCreator
	public static DinoId fromId(String id) {
		for (DinoId d : values()) {
			if (d.id.equals(id)) {
				return d;
			}
		}
		throw new IllegalArgumentException("Dinossauro desconhecido: " + id);
	}
}
```

`economy/DifficultyId.java`:
```java
package com.dinomutation.economy;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Difficulty ladder in unlock order (the ordinal is the index stored in dino_progress.cleared_index). */
public enum DifficultyId {
	FILHOTE("filhote"), NORMAL("normal"), PREDADOR("predador"), EXTINCAO("extincao");

	private final String id;

	DifficultyId(String id) {
		this.id = id;
	}

	@JsonValue
	public String id() {
		return id;
	}

	@JsonCreator
	public static DifficultyId fromId(String id) {
		for (DifficultyId d : values()) {
			if (d.id.equals(id)) {
				return d;
			}
		}
		throw new IllegalArgumentException("Dificuldade desconhecida: " + id);
	}
}
```

- [ ] **Step 4: Implementar a configuração e as regras**

`economy/EconomyConfig.java`:
```java
package com.dinomutation.economy;

import java.util.List;
import java.util.Map;

/** Shape of shared/economy.json. */
public record EconomyConfig(
		List<String> dinos,
		Fossils fossils,
		Mastery mastery,
		List<Difficulty> difficulties,
		Map<String, List<ShopItem>> shop) {

	public record Fossils(int perMinute, int perKills, int elite, int boss) {}

	public record Mastery(int secondsPerXp, int elite, int boss, int maxLevel, int xpPerLevel) {}

	public record Difficulty(String id, double fossilMult, int firstWinBonus) {}

	public record ShopItem(String id, List<Integer> costs) {}
}
```

`economy/RunFacts.java`:
```java
package com.dinomutation.economy;

/** What a finished run reports that the economy pays for. */
public record RunFacts(DifficultyId difficulty, double elapsedTime, int kills, boolean eliteKilled, boolean bossKilled) {}
```

`economy/Economy.java`:
```java
package com.dinomutation.economy;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Pure economy rules, mirroring client/src/data/meta.ts and difficulty.ts operation by
 * operation (same order of float operations, same floors), so both sides pay the same.
 * The numbers come from shared/economy.json, copied to the classpath by Maven.
 */
public final class Economy {

	private final EconomyConfig config;

	public Economy(EconomyConfig config) {
		this.config = config;
		requireSameIds("dinos", Arrays.stream(DinoId.values()).map(DinoId::id).toList(), config.dinos());
		requireSameIds("dificuldades", Arrays.stream(DifficultyId.values()).map(DifficultyId::id).toList(),
				config.difficulties().stream().map(EconomyConfig.Difficulty::id).toList());
		for (DinoId dino : DinoId.values()) {
			if (!config.shop().containsKey(dino.id())) {
				throw new IllegalStateException("economy.json: sem loja para " + dino.id());
			}
		}
	}

	public static Economy loadDefault() {
		try (InputStream in = Economy.class.getResourceAsStream("/economy.json")) {
			if (in == null) {
				throw new IllegalStateException("economy.json não está no classpath");
			}
			return new Economy(JsonMapper.builder().build().readValue(in, EconomyConfig.class));
		} catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	public int fossilsForRun(RunFacts r) {
		EconomyConfig.Fossils f = config.fossils();
		double base = (r.elapsedTime() / 60) * f.perMinute()
				+ Math.floor((double) r.kills() / f.perKills())
				+ (r.eliteKilled() ? f.elite() : 0)
				+ (r.bossKilled() ? f.boss() : 0);
		return (int) Math.floor(base * difficulty(r.difficulty()).fossilMult());
	}

	public int masteryXpForRun(RunFacts r) {
		EconomyConfig.Mastery m = config.mastery();
		return (int) Math.floor(r.elapsedTime() / m.secondsPerXp())
				+ (r.eliteKilled() ? m.elite() : 0)
				+ (r.bossKilled() ? m.boss() : 0);
	}

	/** Mastery level (1..max) for a total amount of mastery XP. */
	public int masteryLevel(int xp) {
		EconomyConfig.Mastery m = config.mastery();
		int level = 1;
		int need = m.xpPerLevel();
		int left = xp;
		while (level < m.maxLevel() && left >= need) {
			left -= need;
			level++;
			need = m.xpPerLevel() * level;
		}
		return level;
	}

	public EconomyConfig.Difficulty difficulty(DifficultyId id) {
		return config.difficulties().get(id.ordinal());
	}

	public int difficultyIndex(DifficultyId id) {
		return id.ordinal();
	}

	public int lastDifficultyIndex() {
		return config.difficulties().size() - 1;
	}

	/** `cleared` = index of the highest difficulty beaten (-1 = none). */
	public int highestUnlocked(int cleared) {
		return Math.min(lastDifficultyIndex(), cleared + 1);
	}

	public boolean isUnlocked(DifficultyId id, int cleared) {
		return difficultyIndex(id) <= highestUnlocked(cleared);
	}

	public Optional<DifficultyId> next(DifficultyId id) {
		DifficultyId[] all = DifficultyId.values();
		return id.ordinal() + 1 < all.length ? Optional.of(all[id.ordinal() + 1]) : Optional.empty();
	}

	public Optional<EconomyConfig.ShopItem> shopItem(DinoId dino, String itemId) {
		return config.shop().get(dino.id()).stream().filter(i -> i.id().equals(itemId)).findFirst();
	}

	private static void requireSameIds(String what, List<String> java, List<String> json) {
		if (!java.equals(json)) {
			throw new IllegalStateException("economy.json: " + what + " diverge do Java (Java: " + java + " · JSON: " + json + ")");
		}
	}
}
```

`common/AppConfig.java`:
```java
package com.dinomutation.common;

import com.dinomutation.economy.Economy;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AppConfig {

	@Bean
	Economy economy() {
		return Economy.loadDefault();
	}

	@Bean
	Clock clock() {
		return Clock.systemUTC();
	}
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
cd server && ./mvnw -q test -Dtest='Economy*'
```
Expected: `BUILD SUCCESS`, com 7 casos de run, 10 de nível e 6 testes do `EconomyTest`.

- [ ] **Step 6: Commit**

```bash
git add server
git commit -m "feat(server): regras da economia em Java com paridade contra o cliente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Erros padronizados, segurança e emissão de JWT

**Files:**
- Create: `common/ErrorCode.java`, `common/ApiException.java`, `common/GlobalExceptionHandler.java`, `common/AppProperties.java`, `common/SecurityConfig.java`, `common/CurrentPlayer.java`, `auth/JwtConfig.java`, `auth/AccessToken.java`, `auth/AccessTokenService.java`
- Modify: `ServerApplication.java` (`@ConfigurationPropertiesScan`)
- Test: `common/SecurityIntegrationTest.java`

**Interfaces:**
- Consumes: `IntegrationTest` (Task 3); bean `Clock` (Task 4).
- Produces:
  - `enum ErrorCode` (os 9 códigos, cada um com seu `HttpStatus status()`).
  - `class ApiException extends RuntimeException`, com o construtor `(ErrorCode code, String message)` e o método `ErrorCode code()`.
  - `record AppProperties(Jwt jwt, Google google, Cookie cookie)`, com os records aninhados `Jwt(String secret, Duration accessTtl, Duration refreshTtl)`, `Google(String clientId)` e `Cookie(boolean secure)`.
  - Beans `PasswordEncoder` (BCrypt), `JwtEncoder`, `JwtDecoder`.
  - `record AccessToken(String value, long expiresIn)` e `AccessTokenService.issue(UUID playerId, String email): AccessToken`.
  - `CurrentPlayer.id(Jwt): UUID`.
  - Regras de acesso: `/api/auth/**`, `/actuator/health`, `/swagger-ui/**`, `/swagger-ui.html` e `/v3/api-docs/**` são públicos; o resto exige `Bearer`.

- [ ] **Step 1: Escrever o teste**

`server/src/test/java/com/dinomutation/common/SecurityIntegrationTest.java`:
```java
package com.dinomutation.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import com.dinomutation.auth.AccessTokenService;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

class SecurityIntegrationTest extends IntegrationTest {

	@Autowired
	AccessTokenService tokens;

	@Autowired
	JwtDecoder decoder;

	@Test
	void protectedRouteWithoutTokenIs401() throws Exception {
		mvc.perform(get("/api/players/me/save")).andExpect(status().isUnauthorized());
	}

	@Test
	void garbageTokenIs401() throws Exception {
		mvc.perform(get("/api/players/me/save").header("Authorization", "Bearer nope")).andExpect(status().isUnauthorized());
	}

	@Test
	void validTokenPassesTheFilter() throws Exception {
		String token = tokens.issue(UUID.randomUUID(), "a@example.com").value();
		// Authenticated, but no controller there yet: 404 instead of 401.
		mvc.perform(get("/api/does-not-exist").header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
	}

	@Test
	void issuedTokenCarriesPlayerIssuerAndFifteenMinutes() {
		UUID id = UUID.randomUUID();
		Jwt jwt = decoder.decode(tokens.issue(id, "a@example.com").value());
		assertThat(jwt.getSubject()).isEqualTo(id.toString());
		assertThat(jwt.getClaimAsString("iss")).isEqualTo("dinomutation");
		assertThat(jwt.getClaimAsString("email")).isEqualTo("a@example.com");
		assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt())).isEqualTo(Duration.ofMinutes(15));
	}

	@Test
	void healthAndApiDocsArePublic() throws Exception {
		mvc.perform(get("/actuator/health")).andExpect(status().isOk());
		mvc.perform(get("/v3/api-docs")).andExpect(status().isOk());
	}

}
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd server && ./mvnw -q test -Dtest=SecurityIntegrationTest
```
Expected: erro de compilação (`AccessTokenService` não existe).

- [ ] **Step 3: Implementar erros e propriedades**

`common/ErrorCode.java`:
```java
package com.dinomutation.common;

import org.springframework.http.HttpStatus;

/** Stable error codes the game switches on (the `code` property of every ProblemDetail). */
public enum ErrorCode {
	VALIDATION_ERROR(HttpStatus.BAD_REQUEST),
	INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),
	EMAIL_TAKEN(HttpStatus.CONFLICT),
	INSUFFICIENT_FOSSILS(HttpStatus.CONFLICT),
	ITEM_MAXED(HttpStatus.CONFLICT),
	ITEM_NOT_FOUND(HttpStatus.NOT_FOUND),
	DIFFICULTY_LOCKED(HttpStatus.CONFLICT),
	ALREADY_IMPORTED(HttpStatus.CONFLICT),
	CONFLICT(HttpStatus.CONFLICT);

	private final HttpStatus status;

	ErrorCode(HttpStatus status) {
		this.status = status;
	}

	public HttpStatus status() {
		return status;
	}
}
```

`common/ApiException.java`:
```java
package com.dinomutation.common;

/** A business-rule failure that maps straight to an HTTP error with a stable code. */
public class ApiException extends RuntimeException {

	private final ErrorCode code;

	public ApiException(ErrorCode code, String message) {
		super(message);
		this.code = code;
	}

	public ErrorCode code() {
		return code;
	}
}
```

`common/GlobalExceptionHandler.java`:
```java
package com.dinomutation.common;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Every error leaves the API as an RFC 9457 ProblemDetail with a `code` the game understands. */
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(ApiException.class)
	ResponseEntity<ProblemDetail> api(ApiException e) {
		return problem(e.code(), e.getMessage(), null);
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<ProblemDetail> invalid(MethodArgumentNotValidException e) {
		List<Map<String, String>> errors = e.getBindingResult().getFieldErrors().stream()
				.map(f -> Map.of("field", f.getField(), "message", Objects.requireNonNullElse(f.getDefaultMessage(), "inválido")))
				.toList();
		return problem(ErrorCode.VALIDATION_ERROR, "Dados inválidos.", errors);
	}

	@ExceptionHandler({ HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
			HandlerMethodValidationException.class })
	ResponseEntity<ProblemDetail> unreadable(Exception e) {
		return problem(ErrorCode.VALIDATION_ERROR, "Corpo da requisição inválido.", null);
	}

	@ExceptionHandler({ ObjectOptimisticLockingFailureException.class, DataIntegrityViolationException.class })
	ResponseEntity<ProblemDetail> conflict(Exception e) {
		return problem(ErrorCode.CONFLICT, "Conflito ao salvar; tente de novo.", null);
	}

	private static ResponseEntity<ProblemDetail> problem(ErrorCode code, String detail, Object errors) {
		ProblemDetail body = ProblemDetail.forStatusAndDetail(code.status(), detail);
		body.setTitle(code.name());
		body.setProperty("code", code.name());
		if (errors != null) {
			body.setProperty("errors", errors);
		}
		return ResponseEntity.status(code.status()).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(body);
	}
}
```

`common/AppProperties.java`:
```java
package com.dinomutation.common;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AppProperties(Jwt jwt, Google google, Cookie cookie) {

	public record Jwt(String secret, Duration accessTtl, Duration refreshTtl) {}

	public record Google(String clientId) {}

	public record Cookie(boolean secure) {}
}
```

`common/CurrentPlayer.java`:
```java
package com.dinomutation.common;

import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;

/** The signed-in player is the access token's subject. */
public final class CurrentPlayer {

	private CurrentPlayer() {
	}

	public static UUID id(Jwt jwt) {
		return UUID.fromString(jwt.getSubject());
	}
}
```

Em `ServerApplication.java`, adicione `@ConfigurationPropertiesScan` (import `org.springframework.boot.context.properties.ConfigurationPropertiesScan`) junto de `@SpringBootApplication`.

- [ ] **Step 4: Implementar segurança e JWT**

`common/SecurityConfig.java`:
```java
package com.dinomutation.common;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

	@Bean
	SecurityFilterChain api(HttpSecurity http) throws Exception {
		http
				// Stateless bearer API. The only cookie (refresh token) is SameSite=Strict and
				// scoped to /api/auth, so cross-site requests never carry it.
				.csrf(AbstractHttpConfigurer::disable)
				.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers("/api/auth/**").permitAll()
						.requestMatchers("/actuator/health", "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()
						.anyRequest().authenticated())
				.oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
		return http.build();
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}
}
```

`auth/JwtConfig.java`:
```java
package com.dinomutation.auth;

import com.dinomutation.common.AppProperties;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/** Our own HS256 access tokens: signed and verified with app.jwt.secret (JWT_SECRET). */
@Configuration
public class JwtConfig {

	public static final String ISSUER = "dinomutation";

	@Bean
	SecretKey jwtSigningKey(AppProperties props) {
		String secret = props.jwt().secret();
		byte[] bytes = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
		if (bytes.length < 32) {
			throw new IllegalStateException("Defina JWT_SECRET com pelo menos 32 bytes");
		}
		return new SecretKeySpec(bytes, "HmacSHA256");
	}

	@Bean
	JwtEncoder jwtEncoder(SecretKey key) {
		return NimbusJwtEncoder.withSecretKey(key).algorithm(MacAlgorithm.HS256).build();
	}

	@Bean
	JwtDecoder jwtDecoder(SecretKey key) {
		NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
		decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(ISSUER));
		return decoder;
	}
}
```

`auth/AccessToken.java`:
```java
package com.dinomutation.auth;

/** A signed access token and its lifetime in seconds. */
public record AccessToken(String value, long expiresIn) {}
```

`auth/AccessTokenService.java`:
```java
package com.dinomutation.auth;

import com.dinomutation.common.AppProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class AccessTokenService {

	private final JwtEncoder encoder;
	private final Clock clock;
	private final Duration ttl;

	public AccessTokenService(JwtEncoder encoder, Clock clock, AppProperties props) {
		this.encoder = encoder;
		this.clock = clock;
		this.ttl = props.jwt().accessTtl();
	}

	public AccessToken issue(UUID playerId, String email) {
		Instant now = clock.instant();
		JwtClaimsSet claims = JwtClaimsSet.builder()
				.issuer(JwtConfig.ISSUER)
				.subject(playerId.toString())
				.issuedAt(now)
				.expiresAt(now.plus(ttl))
				.claim("email", email)
				.build();
		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
		String value = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
		return new AccessToken(value, ttl.toSeconds());
	}
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
cd server && ./mvnw -q test -Dtest=SecurityIntegrationTest
```
Expected: `BUILD SUCCESS` (5 testes).

- [ ] **Step 6: Commit**

```bash
git add server
git commit -m "feat(server): erros ProblemDetail, segurança stateless e emissão de JWT

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Modelo do jogador (`player`, `dino_progress`, `shop_level`)

**Files:**
- Create: `server/src/main/resources/db/migration/V1__player.sql`, `player/Player.java`, `player/DinoProgress.java`, `player/ShopKey.java`, `player/PlayerRepository.java`, `player/SaveDto.java`
- Test: `player/PlayerPersistenceTest.java`

**Interfaces:**
- Consumes: `DinoId` (Task 4); `ApiException`, `ErrorCode` (Task 5); `IntegrationTest` (Task 3).
- Produces:
  - `Player` (entidade agregada), com os métodos:
    - `static Player create(String email, String displayName, Instant now)`
    - getters `getId()`, `getEmail()`, `getPasswordHash()`, `getGoogleSub()`, `getDisplayName()`, `getFossils()`, `getRuns()`, `getWins()`, `getEndlessRuns()`, `getBestTime()`, `getBestEra()`, `getLastDino()`, `getSeenPatch()`, `getImportedAt()`, `getDinos(): Map<String, DinoProgress>`, `getShop(): Map<ShopKey, Integer>`
    - setters `setPasswordHash`, `setGoogleSub`, `setRuns`, `setWins`, `setEndlessRuns`, `setBestTime`, `setBestEra`, `setLastDino`, `setSeenPatch`, `setImportedAt`
    - `DinoProgress progress(DinoId)` (cria a entrada se ainda não existir) e `int clearedIndex(DinoId)` (-1 se não existir; não cria nada)
    - `int shopLevel(DinoId, String itemId)` e `void setShopLevel(DinoId, String itemId, int level)`
    - `void addFossils(int)` e `void spendFossils(int)`
  - `DinoProgress` (embeddable), com getters e setters de `masteryXp`, `clearedIndex`, `preferredDifficulty`, `bestTime` e `bestEra`.
  - `record ShopKey(String dino, String itemId)`.
  - `PlayerRepository`, com `findByEmail`, `findByGoogleSub`, `existsByEmail` e `default Player getRequired(UUID)` (lança `ApiException(INVALID_CREDENTIALS)`).
  - `record SaveDto(...)` e `static SaveDto of(Player)`, no mesmo formato do `SaveData` do cliente.

- [ ] **Step 1: Escrever o teste**

`server/src/test/java/com/dinomutation/player/PlayerPersistenceTest.java`:
```java
package com.dinomutation.player;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dinomutation.IntegrationTest;
import com.dinomutation.economy.DinoId;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionTemplate;

class PlayerPersistenceTest extends IntegrationTest {

	@Autowired
	PlayerRepository players;

	@Autowired
	TransactionTemplate tx;

	@Test
	void persistsProgressAndShopAndBuildsTheSave() {
		UUID id = tx.execute(s -> {
			Player p = Player.create("pedro@example.com", "Pedro", Instant.now());
			p.addFossils(820);
			p.setRuns(34);
			p.setWins(9);
			p.setBestTime(1210.5);
			p.setLastDino("trex");
			DinoProgress trex = p.progress(DinoId.TREX);
			trex.setMasteryXp(640);
			trex.setClearedIndex(1);
			trex.setPreferredDifficulty("predador");
			trex.setBestTime(1210.5);
			trex.setBestEra(3);
			p.progress(DinoId.RAPTOR).setMasteryXp(10);
			p.setShopLevel(DinoId.TREX, "meta_vida", 3);
			return players.save(p).getId();
		});

		SaveDto save = tx.execute(s -> SaveDto.of(players.findById(id).orElseThrow()));

		assertThat(save.email()).isEqualTo("pedro@example.com");
		assertThat(save.fossils()).isEqualTo(820);
		assertThat(save.runs()).isEqualTo(34);
		assertThat(save.lastDino()).isEqualTo("trex");
		assertThat(save.mastery()).containsEntry("trex", 640).containsEntry("raptor", 10);
		assertThat(save.cleared()).containsOnlyKeys("trex").containsEntry("trex", 1);
		assertThat(save.difficulty()).containsOnlyKeys("trex").containsEntry("trex", "predador");
		assertThat(save.bestEraByDino()).containsOnlyKeys("trex");
		assertThat(save.shop()).containsEntry("trex", Map.of("meta_vida", 3));
	}

	@Test
	void clearedIndexDoesNotCreateProgress() {
		Player p = Player.create("x@example.com", "X", Instant.now());
		assertThat(p.clearedIndex(DinoId.TREX)).isEqualTo(-1);
		assertThat(p.getDinos()).isEmpty();
	}

	@Test
	void databaseRejectsNegativeFossils() {
		UUID id = tx.execute(s -> players.save(Player.create("y@example.com", "Y", Instant.now())).getId());
		assertThatThrownBy(() -> jdbc.update("update player set fossils = -1 where id = ?", id))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

}
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd server && ./mvnw -q test -Dtest=PlayerPersistenceTest
```
Expected: erro de compilação (`Player` não existe).

- [ ] **Step 3: Migration**

`server/src/main/resources/db/migration/V1__player.sql`:
```sql
CREATE TABLE player (
    id            uuid PRIMARY KEY,
    email         varchar(254) NOT NULL UNIQUE,
    password_hash varchar(100),
    google_sub    varchar(255) UNIQUE,
    display_name  varchar(40)  NOT NULL,
    fossils       integer      NOT NULL DEFAULT 0 CHECK (fossils >= 0),
    runs          integer      NOT NULL DEFAULT 0,
    wins          integer      NOT NULL DEFAULT 0,
    endless_runs  integer      NOT NULL DEFAULT 0,
    best_time     double precision NOT NULL DEFAULT 0,
    best_era      integer      NOT NULL DEFAULT 0,
    last_dino     varchar(20),
    seen_patch    varchar(20),
    imported_at   timestamptz,
    version       bigint       NOT NULL DEFAULT 0,
    created_at    timestamptz  NOT NULL,
    updated_at    timestamptz  NOT NULL
);

CREATE TABLE dino_progress (
    player_id            uuid        NOT NULL REFERENCES player (id) ON DELETE CASCADE,
    dino                 varchar(20) NOT NULL CHECK (dino IN ('trex', 'raptor', 'triceratops')),
    mastery_xp           integer     NOT NULL DEFAULT 0,
    cleared_index        integer     NOT NULL DEFAULT -1,
    preferred_difficulty varchar(20) CHECK (preferred_difficulty IN ('filhote', 'normal', 'predador', 'extincao')),
    best_time            double precision NOT NULL DEFAULT 0,
    best_era             integer     NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, dino)
);

CREATE TABLE shop_level (
    player_id uuid        NOT NULL REFERENCES player (id) ON DELETE CASCADE,
    dino      varchar(20) NOT NULL CHECK (dino IN ('trex', 'raptor', 'triceratops')),
    item_id   varchar(40) NOT NULL,
    level     integer     NOT NULL CHECK (level >= 0),
    PRIMARY KEY (player_id, dino, item_id)
);
```

- [ ] **Step 4: Entidades e repositório**

`player/DinoProgress.java`:
```java
package com.dinomutation.player;

import jakarta.persistence.Embeddable;

/** One row of dino_progress: a player's progress with one dinosaur. */
@Embeddable
public class DinoProgress {

	private int masteryXp;
	private int clearedIndex = -1;
	private String preferredDifficulty;
	private double bestTime;
	private int bestEra;

	public int getMasteryXp() {
		return masteryXp;
	}

	public void setMasteryXp(int masteryXp) {
		this.masteryXp = masteryXp;
	}

	/** Index of the highest difficulty beaten (-1 = none). */
	public int getClearedIndex() {
		return clearedIndex;
	}

	public void setClearedIndex(int clearedIndex) {
		this.clearedIndex = clearedIndex;
	}

	public String getPreferredDifficulty() {
		return preferredDifficulty;
	}

	public void setPreferredDifficulty(String preferredDifficulty) {
		this.preferredDifficulty = preferredDifficulty;
	}

	public double getBestTime() {
		return bestTime;
	}

	public void setBestTime(double bestTime) {
		this.bestTime = bestTime;
	}

	public int getBestEra() {
		return bestEra;
	}

	public void setBestEra(int bestEra) {
		this.bestEra = bestEra;
	}
}
```

`player/ShopKey.java`:
```java
package com.dinomutation.player;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** Key of shop_level: an item of one dinosaur's shop. */
@Embeddable
public record ShopKey(@Column(name = "dino") String dino, @Column(name = "item_id") String itemId) {}
```

`player/Player.java`:
```java
package com.dinomutation.player;

import com.dinomutation.economy.DinoId;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * A player account and all of its progress (one aggregate). Progress per dinosaur and shop
 * levels are element collections, so the @Version on this row guards every change to them.
 */
@Entity
@Table(name = "player")
public class Player {

	@Id
	private UUID id;

	@Column(nullable = false)
	private String email;

	private String passwordHash;

	private String googleSub;

	@Column(nullable = false)
	private String displayName;

	private int fossils;
	private int runs;
	private int wins;
	private int endlessRuns;
	private double bestTime;
	private int bestEra;
	private String lastDino;
	private String seenPatch;
	private Instant importedAt;

	@Version
	private Long version;

	@Column(nullable = false)
	private Instant createdAt;

	@Column(nullable = false)
	private Instant updatedAt;

	@ElementCollection
	@CollectionTable(name = "dino_progress", joinColumns = @JoinColumn(name = "player_id"))
	@MapKeyColumn(name = "dino")
	private Map<String, DinoProgress> dinos = new HashMap<>();

	@ElementCollection
	@CollectionTable(name = "shop_level", joinColumns = @JoinColumn(name = "player_id"))
	@Column(name = "level")
	private Map<ShopKey, Integer> shop = new HashMap<>();

	protected Player() {
	}

	public static Player create(String email, String displayName, Instant now) {
		Player p = new Player();
		p.id = UUID.randomUUID();
		p.email = email;
		p.displayName = displayName;
		p.createdAt = now;
		p.updatedAt = now;
		return p;
	}

	@PrePersist
	@PreUpdate
	void touch() {
		updatedAt = Instant.now();
	}

	/** Progress with a dinosaur, created on first use. */
	public DinoProgress progress(DinoId dino) {
		return dinos.computeIfAbsent(dino.id(), k -> new DinoProgress());
	}

	/** Highest difficulty index beaten with `dino` (-1 = none), without creating progress. */
	public int clearedIndex(DinoId dino) {
		DinoProgress d = dinos.get(dino.id());
		return d == null ? -1 : d.getClearedIndex();
	}

	public int shopLevel(DinoId dino, String itemId) {
		return shop.getOrDefault(new ShopKey(dino.id(), itemId), 0);
	}

	public void setShopLevel(DinoId dino, String itemId, int level) {
		shop.put(new ShopKey(dino.id(), itemId), level);
	}

	public void addFossils(int amount) {
		fossils += amount;
	}

	public void spendFossils(int amount) {
		if (amount > fossils) {
			throw new IllegalStateException("Fósseis insuficientes");
		}
		fossils -= amount;
	}

	public UUID getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public void setPasswordHash(String passwordHash) {
		this.passwordHash = passwordHash;
	}

	public String getGoogleSub() {
		return googleSub;
	}

	public void setGoogleSub(String googleSub) {
		this.googleSub = googleSub;
	}

	public String getDisplayName() {
		return displayName;
	}

	public int getFossils() {
		return fossils;
	}

	public int getRuns() {
		return runs;
	}

	public void setRuns(int runs) {
		this.runs = runs;
	}

	public int getWins() {
		return wins;
	}

	public void setWins(int wins) {
		this.wins = wins;
	}

	public int getEndlessRuns() {
		return endlessRuns;
	}

	public void setEndlessRuns(int endlessRuns) {
		this.endlessRuns = endlessRuns;
	}

	public double getBestTime() {
		return bestTime;
	}

	public void setBestTime(double bestTime) {
		this.bestTime = bestTime;
	}

	public int getBestEra() {
		return bestEra;
	}

	public void setBestEra(int bestEra) {
		this.bestEra = bestEra;
	}

	public String getLastDino() {
		return lastDino;
	}

	public void setLastDino(String lastDino) {
		this.lastDino = lastDino;
	}

	public String getSeenPatch() {
		return seenPatch;
	}

	public void setSeenPatch(String seenPatch) {
		this.seenPatch = seenPatch;
	}

	public Instant getImportedAt() {
		return importedAt;
	}

	public void setImportedAt(Instant importedAt) {
		this.importedAt = importedAt;
	}

	public Map<String, DinoProgress> getDinos() {
		return dinos;
	}

	public Map<ShopKey, Integer> getShop() {
		return shop;
	}
}
```

`player/PlayerRepository.java`:
```java
package com.dinomutation.player;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerRepository extends JpaRepository<Player, UUID> {

	Optional<Player> findByEmail(String email);

	Optional<Player> findByGoogleSub(String googleSub);

	boolean existsByEmail(String email);

	/** The player behind an access token; a missing row means the token is no longer valid. */
	default Player getRequired(UUID id) {
		return findById(id).orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS, "Conta não encontrada."));
	}
}
```

`player/SaveDto.java`:
```java
package com.dinomutation.player;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;
import java.util.TreeMap;

/**
 * The account's save in the exact shape of the game's SaveData (client/src/game/core/Save.ts),
 * plus e-mail and display name. Maps only list dinosaurs that have that kind of progress,
 * like the game's Partial<Record<…>>.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SaveDto(
		String email,
		String displayName,
		int runs,
		int wins,
		double bestTime,
		Map<String, Double> bestByDino,
		String lastDino,
		int fossils,
		Map<String, Integer> mastery,
		Map<String, Map<String, Integer>> shop,
		int endlessRuns,
		int bestEra,
		Map<String, Integer> bestEraByDino,
		String seenPatch,
		Map<String, Integer> cleared,
		Map<String, String> difficulty) {

	public static SaveDto of(Player p) {
		Map<String, Double> bestByDino = new TreeMap<>();
		Map<String, Integer> mastery = new TreeMap<>();
		Map<String, Integer> bestEraByDino = new TreeMap<>();
		Map<String, Integer> cleared = new TreeMap<>();
		Map<String, String> difficulty = new TreeMap<>();
		p.getDinos().forEach((dino, d) -> {
			bestByDino.put(dino, d.getBestTime());
			mastery.put(dino, d.getMasteryXp());
			if (d.getBestEra() > 0) {
				bestEraByDino.put(dino, d.getBestEra());
			}
			if (d.getClearedIndex() >= 0) {
				cleared.put(dino, d.getClearedIndex());
			}
			if (d.getPreferredDifficulty() != null) {
				difficulty.put(dino, d.getPreferredDifficulty());
			}
		});
		Map<String, Map<String, Integer>> shop = new TreeMap<>();
		p.getShop().forEach((key, level) -> shop.computeIfAbsent(key.dino(), k -> new TreeMap<>()).put(key.itemId(), level));
		return new SaveDto(p.getEmail(), p.getDisplayName(), p.getRuns(), p.getWins(), p.getBestTime(), bestByDino,
				p.getLastDino(), p.getFossils(), mastery, shop, p.getEndlessRuns(), p.getBestEra(), bestEraByDino,
				p.getSeenPatch(), cleared, difficulty);
	}
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
cd server && ./mvnw -q test -Dtest=PlayerPersistenceTest
```
Expected: `BUILD SUCCESS` (3 testes).

Se o Hibernate acusar no `validate` um nome de coluna diferente para a chave do mapa `shop` (por exemplo `key_dino`), adicione ao campo `shop` de `Player` as anotações `@AttributeOverride(name = "key.dino", column = @Column(name = "dino"))` e `@AttributeOverride(name = "key.itemId", column = @Column(name = "item_id"))` e rode de novo.

- [ ] **Step 6: Commit**

```bash
git add server
git commit -m "feat(server): modelo do jogador com progresso por dino e loja (Flyway V1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Cadastro e login com e-mail e senha

**Files:**
- Create: `db/migration/V2__refresh_token.sql`, `auth/RefreshToken.java`, `auth/RefreshTokenRepository.java`, `auth/RefreshTokenService.java`, `auth/RefreshCookies.java`, `auth/Session.java`, `auth/TokenResponse.java`, `auth/RegisterRequest.java`, `auth/LoginRequest.java`, `auth/AuthService.java`, `auth/AuthController.java`
- Modify (test): `IntegrationTest.java` (helpers)
- Test: `auth/AuthRegisterLoginTest.java`

**Interfaces:**
- Consumes:
  - `PlayerRepository` e `Player.create` (Task 6);
  - `AccessTokenService.issue(UUID, String)`, `PasswordEncoder`, `AppProperties`, `ApiException`/`ErrorCode` (Task 5);
  - bean `Clock` (Task 4).
- Produces:
  - `RefreshTokenService.create(UUID playerId): String` (o valor puro, que vai para o cookie) e `static String hash(String)`.
  - `RefreshCookies.issue(String value): ResponseCookie`, `clear(): ResponseCookie` e a constante `NAME = "refresh_token"`.
  - `record Session(AccessToken accessToken, String refreshToken)` e `record TokenResponse(String accessToken, long expiresIn)`.
  - `AuthService.register(RegisterRequest): Session`, `login(LoginRequest): Session` e `static String normalizeEmail(String)`.
  - `POST /api/auth/register` (201) e `POST /api/auth/login` (200), os dois com `{accessToken, expiresIn}` e o cookie.
  - Helpers em `IntegrationTest`:
    - `register(email, password, displayName): MvcResult`, `newPlayerToken(email): String`
    - `accessToken(MvcResult)`, `refreshCookie(MvcResult): Cookie`, `setCookieHeader(MvcResult): String`
    - `bearer(String)`, `json(String... keyValues)`

- [ ] **Step 1: Helpers de teste**

Troque `server/src/test/java/com/dinomutation/IntegrationTest.java` por:
```java
package com.dinomutation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Base for integration tests: the whole app against a real Postgres (Testcontainers).
 * Every subclass shares one Spring context (and one container), so keep the annotations here.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
public abstract class IntegrationTest {

	protected static final String PASSWORD = "senha-forte-123";

	@Autowired
	protected MockMvc mvc;

	@Autowired
	protected JdbcTemplate jdbc;

	@BeforeEach
	void cleanDatabase() {
		List<String> tables = jdbc.queryForList(
				"select tablename from pg_tables where schemaname = 'public' and tablename <> 'flyway_schema_history'",
				String.class);
		if (!tables.isEmpty()) {
			jdbc.execute("TRUNCATE " + String.join(", ", tables) + " CASCADE");
		}
	}

	protected MvcResult register(String email, String password, String displayName) throws Exception {
		return mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", email, "password", password, "displayName", displayName))).andReturn();
	}

	/** Creates an account and returns its access token. */
	protected String newPlayerToken(String email) throws Exception {
		MvcResult result = register(email, PASSWORD, "Jogador");
		assertThat(result.getResponse().getStatus()).isEqualTo(201);
		return accessToken(result);
	}

	protected static String accessToken(MvcResult result) throws Exception {
		return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
	}

	protected static String setCookieHeader(MvcResult result) {
		return result.getResponse().getHeaders(HttpHeaders.SET_COOKIE).stream()
				.filter(h -> h.startsWith("refresh_token=")).findFirst().orElseThrow();
	}

	protected static Cookie refreshCookie(MvcResult result) {
		String header = setCookieHeader(result);
		return new Cookie("refresh_token", header.substring("refresh_token=".length(), header.indexOf(';')));
	}

	protected static String bearer(String token) {
		return "Bearer " + token;
	}

	/** Flat JSON object of string values: json("a", "1", "b", "2") → {"a":"1","b":"2"}. */
	protected static String json(String... keyValues) {
		StringBuilder sb = new StringBuilder("{");
		for (int i = 0; i < keyValues.length; i += 2) {
			if (i > 0) {
				sb.append(',');
			}
			sb.append('"').append(keyValues[i]).append("\":\"").append(keyValues[i + 1].replace("\"", "\\\"")).append('"');
		}
		return sb.append('}').toString();
	}

}
```

- [ ] **Step 2: Escrever o teste**

`server/src/test/java/com/dinomutation/auth/AuthRegisterLoginTest.java`:
```java
package com.dinomutation.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

class AuthRegisterLoginTest extends IntegrationTest {

	@Test
	void registerReturnsTokenAndHttpOnlyRefreshCookie() throws Exception {
		MvcResult result = register("Pedro@Example.com", PASSWORD, "Pedro");

		assertThat(result.getResponse().getStatus()).isEqualTo(201);
		assertThat(accessToken(result)).isNotBlank();
		assertThat(setCookieHeader(result)).contains("HttpOnly", "SameSite=Strict", "Path=/api/auth");
		assertThat(jdbc.queryForObject("select email from player", String.class)).isEqualTo("pedro@example.com");
		assertThat(jdbc.queryForObject("select password_hash from player", String.class)).startsWith("$2");
		assertThat(jdbc.queryForObject("select count(*) from refresh_token", Integer.class)).isEqualTo(1);
	}

	@Test
	void duplicateEmailIs409EmailTaken() throws Exception {
		register("pedro@example.com", PASSWORD, "Pedro");
		mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "PEDRO@example.com", "password", PASSWORD, "displayName", "Outro")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
	}

	@Test
	void invalidFieldsAre400WithOneErrorPerField() throws Exception {
		mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "not-an-email", "password", "short", "displayName", "P")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
				.andExpect(jsonPath("$.errors.length()").value(3));
	}

	@Test
	void passwordOver72BytesIs400() throws Exception {
		// 40 characters (passes @Size) but 80 bytes in UTF-8: BCrypt only uses 72.
		mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "a@example.com", "password", "ç".repeat(40), "displayName", "Ana")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void loginWithTheRightPasswordReturnsATokenAndCookie() throws Exception {
		register("pedro@example.com", PASSWORD, "Pedro");
		MvcResult result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "Pedro@example.com", "password", PASSWORD)))
				.andExpect(status().isOk()).andReturn();
		assertThat(accessToken(result)).isNotBlank();
		assertThat(refreshCookie(result).getValue()).isNotBlank();
	}

	@Test
	void wrongPasswordAndUnknownEmailGiveTheSame401() throws Exception {
		register("pedro@example.com", PASSWORD, "Pedro");
		String wrongPassword = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "pedro@example.com", "password", "outra-senha-123")))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
				.andReturn().getResponse().getContentAsString();
		String unknownEmail = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "ninguem@example.com", "password", PASSWORD)))
				.andExpect(status().isUnauthorized())
				.andReturn().getResponse().getContentAsString();
		assertThat(unknownEmail).isEqualTo(wrongPassword);
	}

}
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
cd server && ./mvnw -q test -Dtest=AuthRegisterLoginTest
```
Expected: os testes falham com `404` (as rotas ainda não existem) ou com erro de compilação.

- [ ] **Step 4: Migration e entidade do refresh token**

`server/src/main/resources/db/migration/V2__refresh_token.sql`:
```sql
CREATE TABLE refresh_token (
    id         uuid PRIMARY KEY,
    player_id  uuid        NOT NULL REFERENCES player (id) ON DELETE CASCADE,
    token_hash varchar(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL
);

CREATE INDEX refresh_token_player_idx ON refresh_token (player_id);
```

`auth/RefreshToken.java`:
```java
package com.dinomutation.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** A refresh token as stored: only its SHA-256, never the value sent in the cookie. */
@Entity
@Table(name = "refresh_token")
public class RefreshToken {

	@Id
	private UUID id;

	@Column(nullable = false)
	private UUID playerId;

	@Column(nullable = false)
	private String tokenHash;

	@Column(nullable = false)
	private Instant expiresAt;

	private Instant revokedAt;

	@Column(nullable = false)
	private Instant createdAt;

	protected RefreshToken() {
	}

	public RefreshToken(UUID playerId, String tokenHash, Instant now, Duration ttl) {
		this.id = UUID.randomUUID();
		this.playerId = playerId;
		this.tokenHash = tokenHash;
		this.createdAt = now;
		this.expiresAt = now.plus(ttl);
	}

	public UUID getPlayerId() {
		return playerId;
	}

	public boolean isRevoked() {
		return revokedAt != null;
	}

	public boolean isExpired(Instant now) {
		return !now.isBefore(expiresAt);
	}

	public void revoke(Instant now) {
		revokedAt = now;
	}
}
```

`auth/RefreshTokenRepository.java`:
```java
package com.dinomutation.auth;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

	Optional<RefreshToken> findByTokenHash(String tokenHash);

	@Modifying
	@Query("update RefreshToken t set t.revokedAt = :now where t.playerId = :playerId and t.revokedAt is null")
	int revokeAllForPlayer(UUID playerId, Instant now);
}
```

`auth/RefreshTokenService.java` (nesta task só com a criação; a Task 8 completa):
```java
package com.dinomutation.auth;

import com.dinomutation.common.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RefreshTokenService {

	private static final SecureRandom RANDOM = new SecureRandom();

	private final RefreshTokenRepository tokens;
	private final Clock clock;
	private final Duration ttl;

	public RefreshTokenService(RefreshTokenRepository tokens, Clock clock, AppProperties props) {
		this.tokens = tokens;
		this.clock = clock;
		this.ttl = props.jwt().refreshTtl();
	}

	/** Issues a new refresh token for the player and returns the raw value (only its hash is stored). */
	@Transactional
	public String create(UUID playerId) {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);
		String value = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		tokens.save(new RefreshToken(playerId, hash(value), clock.instant(), ttl));
		return value;
	}

	static String hash(String value) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}
}
```

- [ ] **Step 5: Cookie, DTOs, serviço e controller**

`auth/RefreshCookies.java`:
```java
package com.dinomutation.auth;

import com.dinomutation.common.AppProperties;
import java.time.Duration;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/** The refresh-token cookie: unreadable by JavaScript and only sent to /api/auth. */
@Component
public class RefreshCookies {

	public static final String NAME = "refresh_token";
	private static final String PATH = "/api/auth";

	private final AppProperties props;

	public RefreshCookies(AppProperties props) {
		this.props = props;
	}

	public ResponseCookie issue(String value) {
		return base(value).maxAge(props.jwt().refreshTtl()).build();
	}

	public ResponseCookie clear() {
		return base("").maxAge(Duration.ZERO).build();
	}

	private ResponseCookie.ResponseCookieBuilder base(String value) {
		return ResponseCookie.from(NAME, value)
				.httpOnly(true)
				.secure(props.cookie().secure())
				.sameSite("Strict")
				.path(PATH);
	}
}
```

`auth/Session.java`:
```java
package com.dinomutation.auth;

/** What a successful sign-in produces: an access token for the body, a refresh token for the cookie. */
public record Session(AccessToken accessToken, String refreshToken) {}
```

`auth/TokenResponse.java`:
```java
package com.dinomutation.auth;

public record TokenResponse(String accessToken, long expiresIn) {}
```

`auth/RegisterRequest.java`:
```java
package com.dinomutation.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
		@NotBlank @Email @Size(max = 254) String email,
		@NotBlank @Size(min = 8, max = 72) String password,
		@NotBlank @Size(min = 2, max = 40) String displayName) {}
```

`auth/LoginRequest.java`:
```java
package com.dinomutation.auth;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(@NotBlank String email, @NotBlank String password) {}
```

`auth/AuthService.java`:
```java
package com.dinomutation.auth;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import com.dinomutation.player.Player;
import com.dinomutation.player.PlayerRepository;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

	private final PlayerRepository players;
	private final PasswordEncoder passwords;
	private final AccessTokenService accessTokens;
	private final RefreshTokenService refreshTokens;
	private final Clock clock;

	public AuthService(PlayerRepository players, PasswordEncoder passwords, AccessTokenService accessTokens,
			RefreshTokenService refreshTokens, Clock clock) {
		this.players = players;
		this.passwords = passwords;
		this.accessTokens = accessTokens;
		this.refreshTokens = refreshTokens;
		this.clock = clock;
	}

	@Transactional
	public Session register(RegisterRequest req) {
		String email = normalizeEmail(req.email());
		if (req.password().getBytes(StandardCharsets.UTF_8).length > 72) {
			throw new ApiException(ErrorCode.VALIDATION_ERROR, "A senha pode ter no máximo 72 bytes.");
		}
		if (players.existsByEmail(email)) {
			throw new ApiException(ErrorCode.EMAIL_TAKEN, "Já existe uma conta com este e-mail.");
		}
		Player player = Player.create(email, req.displayName().trim(), clock.instant());
		player.setPasswordHash(passwords.encode(req.password()));
		return startSession(players.save(player));
	}

	@Transactional
	public Session login(LoginRequest req) {
		Player player = players.findByEmail(normalizeEmail(req.email()))
				.filter(p -> p.getPasswordHash() != null && passwords.matches(req.password(), p.getPasswordHash()))
				.orElseThrow(AuthService::invalidCredentials);
		return startSession(player);
	}

	Session startSession(Player player) {
		return new Session(accessTokens.issue(player.getId(), player.getEmail()), refreshTokens.create(player.getId()));
	}

	public static String normalizeEmail(String email) {
		return email.trim().toLowerCase(Locale.ROOT);
	}

	static ApiException invalidCredentials() {
		return new ApiException(ErrorCode.INVALID_CREDENTIALS, "E-mail ou senha inválidos.");
	}
}
```

`auth/AuthController.java`:
```java
package com.dinomutation.auth;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService auth;
	private final RefreshCookies cookies;

	public AuthController(AuthService auth, RefreshCookies cookies) {
		this.auth = auth;
		this.cookies = cookies;
	}

	@PostMapping("/register")
	public ResponseEntity<TokenResponse> register(@Valid @RequestBody RegisterRequest req) {
		return respond(HttpStatus.CREATED, auth.register(req));
	}

	@PostMapping("/login")
	public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest req) {
		return respond(HttpStatus.OK, auth.login(req));
	}

	private ResponseEntity<TokenResponse> respond(HttpStatus status, Session session) {
		return ResponseEntity.status(status)
				.header(HttpHeaders.SET_COOKIE, cookies.issue(session.refreshToken()).toString())
				.body(new TokenResponse(session.accessToken().value(), session.accessToken().expiresIn()));
	}
}
```

- [ ] **Step 6: Rodar e ver passar**

```bash
cd server && ./mvnw -q test -Dtest=AuthRegisterLoginTest
```
Expected: `BUILD SUCCESS` (6 testes).

- [ ] **Step 7: Commit**

```bash
git add server
git commit -m "feat(server): cadastro e login com BCrypt, JWT e refresh token em cookie

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Renovação com rotação de refresh token e logout

**Files:**
- Modify: `auth/RefreshTokenService.java` (adiciona `consume`, `revoke`, `revokeAll`), `auth/AuthService.java` (adiciona `refresh`, `logout`), `auth/AuthController.java` (adiciona `/refresh`, `/logout`)
- Test: `auth/AuthRefreshTest.java`

**Interfaces:**
- Consumes: tudo da Task 7.
- Produces:
  - `RefreshTokenService.consume(String value): UUID`. Lança `INVALID_CREDENTIALS`; quando o token já foi rotacionado, revoga todas as sessões do player.
  - `RefreshTokenService.revoke(String value)` e `revokeAll(UUID playerId)`.
  - `AuthService.refresh(String): Session` e `logout(String)`.
  - `POST /api/auth/refresh` (cookie → 200 com token e cookie novos) e `POST /api/auth/logout` (204, apaga o cookie).

- [ ] **Step 1: Escrever o teste**

`server/src/test/java/com/dinomutation/auth/AuthRefreshTest.java`:
```java
package com.dinomutation.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

class AuthRefreshTest extends IntegrationTest {

	private MvcResult refresh(Cookie cookie) throws Exception {
		return mvc.perform(post("/api/auth/refresh").cookie(cookie)).andReturn();
	}

	@Test
	void refreshRotatesTheCookie() throws Exception {
		Cookie first = refreshCookie(register("pedro@example.com", PASSWORD, "Pedro"));

		MvcResult result = refresh(first);
		assertThat(result.getResponse().getStatus()).isEqualTo(200);
		assertThat(accessToken(result)).isNotBlank();
		Cookie second = refreshCookie(result);
		assertThat(second.getValue()).isNotEqualTo(first.getValue());

		assertThat(refresh(second).getResponse().getStatus()).isEqualTo(200);
	}

	@Test
	void reusingARotatedCookieEndsEverySession() throws Exception {
		Cookie first = refreshCookie(register("pedro@example.com", PASSWORD, "Pedro"));
		Cookie second = refreshCookie(refresh(first));

		// Someone replays the old cookie: it is refused and the current one dies too.
		assertThat(refresh(first).getResponse().getStatus()).isEqualTo(401);
		assertThat(refresh(second).getResponse().getStatus()).isEqualTo(401);
	}

	@Test
	void missingOrUnknownCookieIs401() throws Exception {
		mvc.perform(post("/api/auth/refresh")).andExpect(status().isUnauthorized());
		assertThat(refresh(new Cookie("refresh_token", "inventado")).getResponse().getStatus()).isEqualTo(401);
	}

	@Test
	void expiredCookieIs401() throws Exception {
		Cookie cookie = refreshCookie(register("pedro@example.com", PASSWORD, "Pedro"));
		jdbc.update("update refresh_token set expires_at = now() - interval '1 minute'");
		assertThat(refresh(cookie).getResponse().getStatus()).isEqualTo(401);
	}

	@Test
	void logoutRevokesAndClearsTheCookie() throws Exception {
		Cookie cookie = refreshCookie(register("pedro@example.com", PASSWORD, "Pedro"));

		MvcResult result = mvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent()).andReturn();
		assertThat(setCookieHeader(result)).contains("Max-Age=0");

		assertThat(refresh(cookie).getResponse().getStatus()).isEqualTo(401);
	}

}
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd server && ./mvnw -q test -Dtest=AuthRefreshTest
```
Expected: falhas (as rotas `/refresh` e `/logout` respondem 404).

- [ ] **Step 3: Completar o `RefreshTokenService`**

Adicione os imports `com.dinomutation.common.ApiException`, `com.dinomutation.common.ErrorCode`, `java.time.Instant`, e os métodos abaixo em `RefreshTokenService` (depois de `create`):
```java
	/**
	 * Validates and spends a refresh token, returning its player. A token that was already
	 * rotated means someone copied it: every session of that player is revoked. The revocation
	 * must survive the 401, hence noRollbackFor (callers in a transaction need it too).
	 */
	@Transactional(noRollbackFor = ApiException.class)
	public UUID consume(String value) {
		if (value == null || value.isBlank()) {
			throw invalid();
		}
		RefreshToken token = tokens.findByTokenHash(hash(value)).orElseThrow(RefreshTokenService::invalid);
		Instant now = clock.instant();
		if (token.isRevoked()) {
			tokens.revokeAllForPlayer(token.getPlayerId(), now);
			throw invalid();
		}
		if (token.isExpired(now)) {
			throw invalid();
		}
		token.revoke(now);
		return token.getPlayerId();
	}

	@Transactional
	public void revoke(String value) {
		if (value == null || value.isBlank()) {
			return;
		}
		tokens.findByTokenHash(hash(value)).filter(t -> !t.isRevoked()).ifPresent(t -> t.revoke(clock.instant()));
	}

	@Transactional
	public void revokeAll(UUID playerId) {
		tokens.revokeAllForPlayer(playerId, clock.instant());
	}

	private static ApiException invalid() {
		return new ApiException(ErrorCode.INVALID_CREDENTIALS, "Sessão expirada; entre de novo.");
	}
```

- [ ] **Step 4: Completar o `AuthService` e o `AuthController`**

Em `AuthService`, adicione o import `java.util.UUID` e os métodos:
```java
	/** Same noRollbackFor as consume(): this transaction wraps it and must keep the reuse revocation. */
	@Transactional(noRollbackFor = ApiException.class)
	public Session refresh(String refreshToken) {
		UUID playerId = refreshTokens.consume(refreshToken);
		return startSession(players.getRequired(playerId));
	}

	public void logout(String refreshToken) {
		refreshTokens.revoke(refreshToken);
	}
```

Em `AuthController`, adicione os imports `org.springframework.web.bind.annotation.CookieValue` e os métodos:
```java
	@PostMapping("/refresh")
	public ResponseEntity<TokenResponse> refresh(
			@CookieValue(name = RefreshCookies.NAME, required = false) String refreshToken) {
		return respond(HttpStatus.OK, auth.refresh(refreshToken));
	}

	@PostMapping("/logout")
	public ResponseEntity<Void> logout(@CookieValue(name = RefreshCookies.NAME, required = false) String refreshToken) {
		auth.logout(refreshToken);
		return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.clear().toString()).build();
	}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
cd server && ./mvnw -q test -Dtest='Auth*'
```
Expected: `BUILD SUCCESS` (11 testes). Se `reusingARotatedCookieEndsEverySession` falhar no segundo `assert`, confira se o `noRollbackFor` está **nos dois** métodos (`consume` e `refresh`).

- [ ] **Step 6: Commit**

```bash
git add server
git commit -m "feat(server): rotação de refresh token com detecção de reuso e logout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Login com Google e a regra do mesmo e-mail

**Files:**
- Create: `auth/GoogleIdentity.java`, `auth/GoogleTokenVerifier.java`, `auth/NimbusGoogleTokenVerifier.java`, `auth/GoogleLoginRequest.java`
- Modify: `auth/AuthService.java` (construtor + `google`), `auth/AuthController.java` (`/google`), `IntegrationTest.java` (`@Import`)
- Test: `auth/FakeGoogleTokenVerifier.java`, `auth/AuthGoogleTest.java`

**Interfaces:**
- Consumes: `RefreshTokenService.revokeAll` (Task 8); `AuthService.startSession`, `normalizeEmail` (Task 7); `PlayerRepository.findByGoogleSub`/`findByEmail` (Task 6).
- Produces:
  - `record GoogleIdentity(String subject, String email, String name)`.
  - `interface GoogleTokenVerifier { GoogleIdentity verify(String idToken); }` (lança `ApiException(INVALID_CREDENTIALS)`).
  - `POST /api/auth/google` com `{idToken}`.
  - O stub de teste `FakeGoogleTokenVerifier`, que aceita tokens no formato `valid:<sub>:<email>:<nome>`.

- [ ] **Step 1: Stub de teste e `@Import` na base**

`server/src/test/java/com/dinomutation/auth/FakeGoogleTokenVerifier.java`:
```java
package com.dinomutation.auth;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Google stand-in for tests: accepts tokens shaped "valid:<sub>:<email>:<name>". */
public class FakeGoogleTokenVerifier implements GoogleTokenVerifier {

	@Override
	public GoogleIdentity verify(String idToken) {
		String[] parts = idToken.split(":", 4);
		if (parts.length != 4 || !parts[0].equals("valid")) {
			throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Token do Google inválido.");
		}
		return new GoogleIdentity(parts[1], parts[2], parts[3]);
	}

	@TestConfiguration(proxyBeanMethods = false)
	public static class Config {

		@Bean
		@Primary
		GoogleTokenVerifier fakeGoogleTokenVerifier() {
			return new FakeGoogleTokenVerifier();
		}
	}
}
```

Em `IntegrationTest.java`, troque `@Import(TestcontainersConfiguration.class)` por:
```java
@Import({ TestcontainersConfiguration.class, FakeGoogleTokenVerifier.Config.class })
```
e adicione o import `com.dinomutation.auth.FakeGoogleTokenVerifier`.

- [ ] **Step 2: Escrever o teste**

`server/src/test/java/com/dinomutation/auth/AuthGoogleTest.java`:
```java
package com.dinomutation.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class AuthGoogleTest extends IntegrationTest {

	private ResultActions google(String idToken) throws Exception {
		return mvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content(json("idToken", idToken)));
	}

	@Test
	void newGoogleUserGetsAnAccountWithoutPassword() throws Exception {
		google("valid:g-1:ana@example.com:Ana Souza").andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").isNotEmpty());

		assertThat(jdbc.queryForObject("select google_sub from player", String.class)).isEqualTo("g-1");
		assertThat(jdbc.queryForObject("select display_name from player", String.class)).isEqualTo("Ana Souza");
		assertThat(jdbc.queryForObject("select password_hash from player", String.class)).isNull();
	}

	@Test
	void sameGoogleAccountSignsIntoTheSamePlayer() throws Exception {
		google("valid:g-1:ana@example.com:Ana").andExpect(status().isOk());
		google("valid:g-1:ana@example.com:Ana").andExpect(status().isOk());
		assertThat(jdbc.queryForObject("select count(*) from player", Integer.class)).isEqualTo(1);
	}

	@Test
	void googleWithTheEmailOfAPasswordAccountLinksAndDropsThePassword() throws Exception {
		Cookie oldSession = refreshCookie(register("ana@example.com", PASSWORD, "Ana"));

		google("valid:g-2:ANA@example.com:Ana").andExpect(status().isOk());

		assertThat(jdbc.queryForObject("select count(*) from player", Integer.class)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select google_sub from player", String.class)).isEqualTo("g-2");
		assertThat(jdbc.queryForObject("select password_hash from player", String.class)).isNull();
		mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(json("email", "ana@example.com", "password", PASSWORD)))
				.andExpect(status().isUnauthorized());
		mvc.perform(post("/api/auth/refresh").cookie(oldSession)).andExpect(status().isUnauthorized());
	}

	@Test
	void emailAlreadyLinkedToAnotherGoogleAccountIs409() throws Exception {
		google("valid:g-1:ana@example.com:Ana").andExpect(status().isOk());
		google("valid:g-9:ana@example.com:Ana").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
	}

	@Test
	void blankGoogleNameFallsBackToTheEmail() throws Exception {
		google("valid:g-5:zeca@example.com: ").andExpect(status().isOk());
		assertThat(jdbc.queryForObject("select display_name from player", String.class)).isEqualTo("zeca");
	}

	@Test
	void invalidGoogleTokenIs401() throws Exception {
		google("forjado").andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
	}

}
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
cd server && ./mvnw -q test -Dtest=AuthGoogleTest
```
Expected: erro de compilação (`GoogleTokenVerifier` não existe).

- [ ] **Step 4: Contrato e implementação real**

`auth/GoogleIdentity.java`:
```java
package com.dinomutation.auth;

/** A Google account proven by a verified ID token. */
public record GoogleIdentity(String subject, String email, String name) {}
```

`auth/GoogleTokenVerifier.java`:
```java
package com.dinomutation.auth;

/** Checks a Google ID token; throws ApiException(INVALID_CREDENTIALS) when it can't be trusted. */
public interface GoogleTokenVerifier {

	GoogleIdentity verify(String idToken);
}
```

`auth/NimbusGoogleTokenVerifier.java`:
```java
package com.dinomutation.auth;

import com.dinomutation.common.AppProperties;
import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import java.util.Collection;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Verifies Google ID tokens against Google's public keys: signature, expiry, issuer,
 * audience (our client id) and a verified e-mail. Not a JwtDecoder bean on purpose:
 * the resource server must keep using our own decoder (JwtConfig).
 */
@Component
public class NimbusGoogleTokenVerifier implements GoogleTokenVerifier {

	private static final Logger log = LoggerFactory.getLogger(NimbusGoogleTokenVerifier.class);
	private static final String JWKS = "https://www.googleapis.com/oauth2/v3/certs";
	private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

	private final String clientId;
	private final NimbusJwtDecoder decoder;

	public NimbusGoogleTokenVerifier(AppProperties props) {
		this.clientId = props.google().clientId();
		this.decoder = NimbusJwtDecoder.withJwkSetUri(JWKS).build();
		this.decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
				new JwtTimestampValidator(),
				new JwtClaimValidator<Object>(JwtClaimNames.ISS, iss -> iss != null && ISSUERS.contains(iss.toString())),
				new JwtClaimValidator<Object>(JwtClaimNames.AUD,
						aud -> aud instanceof Collection<?> list ? list.contains(clientId) : clientId != null && clientId.equals(aud))));
	}

	@Override
	public GoogleIdentity verify(String idToken) {
		if (clientId == null || clientId.isBlank()) {
			log.warn("GOOGLE_CLIENT_ID não configurado: login com Google recusado");
			throw invalid();
		}
		Jwt jwt;
		try {
			jwt = decoder.decode(idToken);
		} catch (JwtException e) {
			throw invalid();
		}
		Object verified = jwt.getClaims().get("email_verified");
		String email = jwt.getClaimAsString("email");
		if (email == null || !(Boolean.TRUE.equals(verified) || "true".equals(verified))) {
			throw invalid();
		}
		return new GoogleIdentity(jwt.getSubject(), email, jwt.getClaimAsString("name"));
	}

	private static ApiException invalid() {
		return new ApiException(ErrorCode.INVALID_CREDENTIALS, "Não foi possível confirmar o login com o Google.");
	}
}
```

`auth/GoogleLoginRequest.java`:
```java
package com.dinomutation.auth;

import jakarta.validation.constraints.NotBlank;

public record GoogleLoginRequest(@NotBlank String idToken) {}
```

- [ ] **Step 5: Regra no `AuthService` e rota no controller**

Em `AuthService`:
1. Adicione o campo `private final GoogleTokenVerifier google;`, inclua `GoogleTokenVerifier google` como último parâmetro do construtor e atribua `this.google = google;`.
2. Adicione os métodos:
```java
	@Transactional
	public Session google(GoogleLoginRequest req) {
		GoogleIdentity identity = google.verify(req.idToken());
		String email = normalizeEmail(identity.email());
		Player player = players.findByGoogleSub(identity.subject()).orElseGet(() -> linkOrCreate(identity, email));
		return startSession(player);
	}

	/**
	 * Same e-mail as an existing account. Google proves the e-mail belongs to this person;
	 * our sign-up doesn't (no e-mail confirmation), so a password on that account may have
	 * been set by someone else (account pre-hijacking). Link the account, drop its password
	 * and end its sessions.
	 */
	private Player linkOrCreate(GoogleIdentity identity, String email) {
		return players.findByEmail(email).map(existing -> {
			if (existing.getGoogleSub() != null) {
				throw new ApiException(ErrorCode.CONFLICT, "Este e-mail já está ligado a outra conta Google.");
			}
			existing.setGoogleSub(identity.subject());
			if (existing.getPasswordHash() != null) {
				existing.setPasswordHash(null);
				refreshTokens.revokeAll(existing.getId());
			}
			return existing;
		}).orElseGet(() -> {
			Player created = Player.create(email, displayNameFor(identity, email), clock.instant());
			created.setGoogleSub(identity.subject());
			return players.save(created);
		});
	}

	private static String displayNameFor(GoogleIdentity identity, String email) {
		String name = identity.name() == null ? "" : identity.name().trim();
		if (name.length() < 2) {
			name = email.substring(0, email.indexOf('@'));
		}
		if (name.length() < 2) {
			name = "Jogador";
		}
		return name.length() > 40 ? name.substring(0, 40) : name;
	}
```

Em `AuthController`, adicione:
```java
	@PostMapping("/google")
	public ResponseEntity<TokenResponse> google(@Valid @RequestBody GoogleLoginRequest req) {
		return respond(HttpStatus.OK, auth.google(req));
	}
```

- [ ] **Step 6: Rodar e ver passar**

```bash
cd server && ./mvnw -q test -Dtest='Auth*'
```
Expected: `BUILD SUCCESS` (17 testes).

- [ ] **Step 7: Commit**

```bash
git add server
git commit -m "feat(server): login com Google e proteção contra account pre-hijacking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Save, preferências e importação

**Files:**
- Create: `common/OptimisticRetry.java`, `player/ProgressRules.java`, `player/PreferencesRequest.java`, `player/ImportedSave.java`, `player/ImportRequest.java`, `player/SaveImporter.java`, `player/PlayerService.java`, `player/PlayerController.java`
- Test: `player/PlayerApiTest.java`

**Interfaces:**
- Consumes: `Player`, `PlayerRepository.getRequired`, `SaveDto.of` (Task 6); `Economy` (Task 4); `CurrentPlayer`, `ApiException` (Task 5); helpers de `IntegrationTest` (Task 7).
- Produces:
  - `OptimisticRetry.once(Supplier<T>): T`.
  - `ProgressRules.requireUnlocked(Player, DinoId, DifficultyId)` (lança `DIFFICULTY_LOCKED`; não cria progresso). A Task 11 acrescenta `applyClear`.
  - `GET /api/players/me/save`, `PATCH /api/players/me/preferences` e `POST /api/players/me/import`.

- [ ] **Step 1: Escrever o teste**

`server/src/test/java/com/dinomutation/player/PlayerApiTest.java`:
```java
package com.dinomutation.player;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class PlayerApiTest extends IntegrationTest {

	private static final String BROWSER_SAVE = """
			{"save":{"runs":34,"wins":9,"bestTime":1210.5,"bestByDino":{"trex":1210.5,"raptor":300},
			"lastDino":"trex","fossils":820,"mastery":{"trex":640,"raptor":120},
			"shop":{"trex":{"meta_vida":3,"meta_trex_crit":1}},"endlessRuns":2,"bestEra":3,
			"bestEraByDino":{"trex":3},"seenPatch":"0.2.0","cleared":{"trex":1},"difficulty":{"trex":"predador"}}}
			""";

	private String token;

	@BeforeEach
	void signUp() throws Exception {
		token = newPlayerToken("pedro@example.com");
	}

	private ResultActions getSave() throws Exception {
		return mvc.perform(get("/api/players/me/save").header("Authorization", bearer(token)));
	}

	private ResultActions importSave(String body) throws Exception {
		return mvc.perform(post("/api/players/me/import").header("Authorization", bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(body));
	}

	private ResultActions preferences(String body) throws Exception {
		return mvc.perform(patch("/api/players/me/preferences").header("Authorization", bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(body));
	}

	@Test
	void newAccountHasAnEmptySave() throws Exception {
		getSave().andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value("pedro@example.com"))
				.andExpect(jsonPath("$.displayName").value("Jogador"))
				.andExpect(jsonPath("$.fossils").value(0))
				.andExpect(jsonPath("$.runs").value(0))
				.andExpect(jsonPath("$.mastery").isEmpty())
				.andExpect(jsonPath("$.lastDino").doesNotExist());
	}

	@Test
	void preferencesKeepSeenPatchAndAnUnlockedDifficulty() throws Exception {
		preferences("""
				{"seenPatch":"0.2.0","difficulty":{"dino":"trex","id":"filhote"}}
				""").andExpect(status().isNoContent());
		getSave().andExpect(jsonPath("$.seenPatch").value("0.2.0"))
				.andExpect(jsonPath("$.difficulty.trex").value("filhote"));
	}

	@Test
	void lockedDifficultyIs409() throws Exception {
		preferences("""
				{"difficulty":{"dino":"trex","id":"normal"}}
				""").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DIFFICULTY_LOCKED"));
	}

	@Test
	void unknownDinoIs400() throws Exception {
		preferences("""
				{"difficulty":{"dino":"stego","id":"filhote"}}
				""").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void importCopiesTheBrowserSave() throws Exception {
		importSave(BROWSER_SAVE).andExpect(status().isOk()).andExpect(jsonPath("$.fossils").value(820));
		getSave().andExpect(jsonPath("$.runs").value(34))
				.andExpect(jsonPath("$.wins").value(9))
				.andExpect(jsonPath("$.mastery.trex").value(640))
				.andExpect(jsonPath("$.shop.trex.meta_vida").value(3))
				.andExpect(jsonPath("$.cleared.trex").value(1))
				.andExpect(jsonPath("$.difficulty.trex").value("predador"))
				.andExpect(jsonPath("$.bestEraByDino.trex").value(3));
	}

	@Test
	void secondImportIs409() throws Exception {
		importSave(BROWSER_SAVE).andExpect(status().isOk());
		importSave(BROWSER_SAVE).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ALREADY_IMPORTED"));
	}

	@Test
	void importWithImpossibleValuesIs400AndChangesNothing() throws Exception {
		importSave("""
				{"save":{"runs":1,"wins":0,"fossils":50,"shop":{"trex":{"meta_vida":9}}}}
				""").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		importSave("""
				{"save":{"runs":1,"wins":0,"fossils":50,"mastery":{"stego":10}}}
				""").andExpect(status().isBadRequest());
		importSave("""
				{"save":{"runs":1,"wins":0,"fossils":-5}}
				""").andExpect(status().isBadRequest());
		getSave().andExpect(jsonPath("$.fossils").value(0)).andExpect(jsonPath("$.runs").value(0));
	}

}
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd server && ./mvnw -q test -Dtest=PlayerApiTest
```
Expected: falhas com `404` nas rotas `/api/players/me/*`.

- [ ] **Step 3: Infraestrutura comum e regras de progresso**

`common/OptimisticRetry.java`:
```java
package com.dinomutation.common;

import java.util.function.Supplier;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Component;

/**
 * Runs a @Transactional service call and retries it once when another request changed the
 * same player first (@Version). A second conflict reaches the handler as 409 CONFLICT.
 */
@Component
public class OptimisticRetry {

	public <T> T once(Supplier<T> action) {
		try {
			return action.get();
		} catch (ObjectOptimisticLockingFailureException conflict) {
			return action.get();
		}
	}
}
```

`player/ProgressRules.java`:
```java
package com.dinomutation.player;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import com.dinomutation.economy.Economy;
import org.springframework.stereotype.Component;

/** Difficulty-ladder rules shared by preferences, clears and runs. */
@Component
public class ProgressRules {

	private final Economy economy;

	public ProgressRules(Economy economy) {
		this.economy = economy;
	}

	public void requireUnlocked(Player player, DinoId dino, DifficultyId difficulty) {
		if (!economy.isUnlocked(difficulty, player.clearedIndex(dino))) {
			throw new ApiException(ErrorCode.DIFFICULTY_LOCKED, "Esta dificuldade ainda não foi liberada para este dinossauro.");
		}
	}
}
```

- [ ] **Step 4: DTOs e importação**

`player/PreferencesRequest.java`:
```java
package com.dinomutation.player;

import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Partial update: null fields are left untouched. */
public record PreferencesRequest(@Size(max = 20) String seenPatch, @Valid DifficultyPreference difficulty) {

	public record DifficultyPreference(@NotNull DinoId dino, @NotNull DifficultyId id) {}
}
```

`player/ImportedSave.java`:
```java
package com.dinomutation.player;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.Map;

/** The game's SaveData as read from localStorage (maps keyed by dino id, checked by SaveImporter). */
public record ImportedSave(
		@PositiveOrZero int runs,
		@PositiveOrZero int wins,
		@PositiveOrZero double bestTime,
		Map<String, Double> bestByDino,
		String lastDino,
		@PositiveOrZero int fossils,
		Map<String, Integer> mastery,
		Map<String, Map<String, Integer>> shop,
		@PositiveOrZero int endlessRuns,
		@PositiveOrZero int bestEra,
		Map<String, Integer> bestEraByDino,
		@Size(max = 20) String seenPatch,
		Map<String, Integer> cleared,
		Map<String, String> difficulty) {}
```

`player/ImportRequest.java`:
```java
package com.dinomutation.player;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record ImportRequest(@NotNull @Valid ImportedSave save) {}
```

`player/SaveImporter.java`:
```java
package com.dinomutation.player;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import com.dinomutation.economy.Economy;
import com.dinomutation.economy.EconomyConfig;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Copies a browser save into an empty account. This is the one place the server trusts the
 * client (once per account), so every value is checked against what the game can produce.
 */
@Component
public class SaveImporter {

	/** The game keeps adding XP past the last level; this only rejects absurd values. */
	private static final int MAX_MASTERY_XP = 10_000_000;

	private final Economy economy;

	public SaveImporter(Economy economy) {
		this.economy = economy;
	}

	public void apply(Player p, ImportedSave s) {
		if (s.wins() > s.runs()) {
			throw invalid("mais vitórias do que runs");
		}
		p.setRuns(s.runs());
		p.setWins(s.wins());
		p.setBestTime(s.bestTime());
		p.addFossils(s.fossils());
		p.setEndlessRuns(s.endlessRuns());
		p.setBestEra(s.bestEra());
		p.setSeenPatch(s.seenPatch());
		p.setLastDino(s.lastDino() == null ? null : dino(s.lastDino()).id());

		orEmpty(s.bestByDino()).forEach((d, v) -> p.progress(dino(d)).setBestTime(nonNegative(v, "bestByDino")));
		orEmpty(s.bestEraByDino()).forEach((d, v) -> p.progress(dino(d)).setBestEra(nonNegative(v, "bestEraByDino")));
		orEmpty(s.mastery()).forEach((d, v) -> {
			int xp = nonNegative(v, "mastery");
			if (xp > MAX_MASTERY_XP) {
				throw invalid("maestria fora do limite");
			}
			p.progress(dino(d)).setMasteryXp(xp);
		});
		orEmpty(s.cleared()).forEach((d, v) -> {
			if (v == null || v < -1 || v > economy.lastDifficultyIndex()) {
				throw invalid("dificuldade vencida fora do intervalo");
			}
			p.progress(dino(d)).setClearedIndex(v);
		});
		// After `cleared`: the preferred difficulty must already be unlocked.
		orEmpty(s.difficulty()).forEach((d, v) -> {
			DinoId dino = dino(d);
			DifficultyId difficulty = difficulty(v);
			if (!economy.isUnlocked(difficulty, p.clearedIndex(dino))) {
				throw invalid("dificuldade preferida ainda bloqueada");
			}
			p.progress(dino).setPreferredDifficulty(difficulty.id());
		});
		orEmpty(s.shop()).forEach((d, items) -> {
			DinoId dino = dino(d);
			orEmpty(items).forEach((itemId, level) -> {
				EconomyConfig.ShopItem item = economy.shopItem(dino, itemId)
						.orElseThrow(() -> invalid("item desconhecido: " + itemId));
				if (level == null || level < 0 || level > item.costs().size()) {
					throw invalid("nível inválido para " + itemId);
				}
				if (level > 0) {
					p.setShopLevel(dino, itemId, level);
				}
			});
		});
	}

	private static DinoId dino(String id) {
		try {
			return DinoId.fromId(id);
		} catch (IllegalArgumentException e) {
			throw invalid("dinossauro desconhecido: " + id);
		}
	}

	private static DifficultyId difficulty(String id) {
		try {
			return DifficultyId.fromId(id);
		} catch (IllegalArgumentException e) {
			throw invalid("dificuldade desconhecida: " + id);
		}
	}

	private static int nonNegative(Integer v, String field) {
		if (v == null || v < 0) {
			throw invalid(field + " negativo");
		}
		return v;
	}

	private static double nonNegative(Double v, String field) {
		if (v == null || v < 0) {
			throw invalid(field + " negativo");
		}
		return v;
	}

	private static <K, V> Map<K, V> orEmpty(Map<K, V> map) {
		return map == null ? Map.of() : map;
	}

	private static ApiException invalid(String reason) {
		return new ApiException(ErrorCode.VALIDATION_ERROR, "Save inválido: " + reason + ".");
	}
}
```

- [ ] **Step 5: Serviço e controller**

`player/PlayerService.java`:
```java
package com.dinomutation.player;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlayerService {

	private final PlayerRepository players;
	private final ProgressRules rules;
	private final SaveImporter importer;
	private final Clock clock;

	public PlayerService(PlayerRepository players, ProgressRules rules, SaveImporter importer, Clock clock) {
		this.players = players;
		this.rules = rules;
		this.importer = importer;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public SaveDto loadSave(UUID playerId) {
		return SaveDto.of(players.getRequired(playerId));
	}

	@Transactional
	public void updatePreferences(UUID playerId, PreferencesRequest req) {
		Player player = players.getRequired(playerId);
		if (req.seenPatch() != null) {
			player.setSeenPatch(req.seenPatch());
		}
		if (req.difficulty() != null) {
			rules.requireUnlocked(player, req.difficulty().dino(), req.difficulty().id());
			player.progress(req.difficulty().dino()).setPreferredDifficulty(req.difficulty().id().id());
		}
	}

	/** One-time copy of the browser save into an account without progress (spec: the cloud wins otherwise). */
	@Transactional
	public SaveDto importSave(UUID playerId, ImportedSave save) {
		Player player = players.getRequired(playerId);
		if (player.getImportedAt() != null || player.getRuns() > 0) {
			throw new ApiException(ErrorCode.ALREADY_IMPORTED, "Esta conta já tem progresso; o save do navegador não foi importado.");
		}
		importer.apply(player, save);
		player.setImportedAt(clock.instant());
		return SaveDto.of(player);
	}
}
```

`player/PlayerController.java`:
```java
package com.dinomutation.player;

import com.dinomutation.common.CurrentPlayer;
import com.dinomutation.common.OptimisticRetry;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/players/me")
public class PlayerController {

	private final PlayerService service;
	private final OptimisticRetry retry;

	public PlayerController(PlayerService service, OptimisticRetry retry) {
		this.service = service;
		this.retry = retry;
	}

	@GetMapping("/save")
	public SaveDto save(@AuthenticationPrincipal Jwt jwt) {
		return service.loadSave(CurrentPlayer.id(jwt));
	}

	@PatchMapping("/preferences")
	public ResponseEntity<Void> preferences(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PreferencesRequest req) {
		retry.once(() -> {
			service.updatePreferences(CurrentPlayer.id(jwt), req);
			return null;
		});
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/import")
	public SaveDto importSave(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ImportRequest req) {
		return retry.once(() -> service.importSave(CurrentPlayer.id(jwt), req.save()));
	}
}
```

- [ ] **Step 6: Rodar e ver passar**

```bash
cd server && ./mvnw -q test -Dtest=PlayerApiTest
```
Expected: `BUILD SUCCESS` (7 testes).

- [ ] **Step 7: Commit**

```bash
git add server
git commit -m "feat(server): save da conta, preferências e importação única do save do navegador

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Runs e vitórias no chefe (economia no servidor)

**Files:**
- Create: `db/migration/V3__run.sql`, `player/FirstClear.java`, `run/UpgradeEntry.java`, `run/GameRun.java`, `run/GameRunRepository.java`, `run/RunRequest.java`, `run/RunRewardsDto.java`, `run/RunResponse.java`, `run/RunOutcome.java`, `run/ClearRequest.java`, `run/ClearResponse.java`, `run/RunService.java`, `run/RunController.java`
- Modify: `player/ProgressRules.java` (adiciona `applyClear`)
- Test: `run/RunApiTest.java`

**Interfaces:**
- Consumes: `Economy.fossilsForRun`/`masteryXpForRun`/`masteryLevel`/`difficulty`/`next`/`difficultyIndex` (Task 4); `ProgressRules.requireUnlocked`, `OptimisticRetry` (Task 10); `Player`, `SaveDto` (Task 6).
- Produces:
  - `record FirstClear(int firstWinBonus, String unlockedDifficulty)` com `FirstClear.NONE` (pacote `player`).
  - `ProgressRules.applyClear(Player, DinoId, DifficultyId): FirstClear`.
  - `record ClearResponse(int firstWinBonus, String unlockedDifficulty)` com `static ClearResponse of(FirstClear)`.
  - `POST /api/clears` com `{dino, difficulty}`, que responde `200 ClearResponse`.
  - `POST /api/runs` com `RunRequest`, que responde `201` (ou `200` no reenvio) com `{rewards: {fossils, firstWinBonus, unlockedDifficulty?, masteryXp, levelBefore, levelAfter}, save}`.

- [ ] **Step 1: Escrever o teste**

`server/src/test/java/com/dinomutation/run/RunApiTest.java`:
```java
package com.dinomutation.run;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import java.util.Locale;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class RunApiTest extends IntegrationTest {

	private String token;

	@BeforeEach
	void signUp() throws Exception {
		token = newPlayerToken("pedro@example.com");
	}

	/** A run body; numbers match shared/economy-cases.json so the expected rewards are known. */
	private static String run(UUID id, String difficulty, boolean victory, double elapsed, int kills, boolean elite,
			boolean boss, boolean endless, int era, double endlessTime) {
		return String.format(Locale.ROOT, """
				{"id":"%s","dino":"trex","difficulty":"%s","victory":%b,"elapsedTime":%s,"kills":%d,"level":12,
				"eliteKilled":%b,"bossKilled":%b,"endless":%b,"era":%d,"endlessTime":%s,"damageDealt":12345.6,
				"damageTaken":987.5,"upgrades":[{"id":"bite_power","name":"Mordida Forte","rarity":"common","level":2}]}
				""", id, difficulty, victory, elapsed, kills, elite, boss, endless, era, endlessTime);
	}

	private static String defeat(UUID id) {
		return run(id, "filhote", false, 412.7, 361, true, false, false, 0, 0);
	}

	private static String filhoteWin(UUID id) {
		return run(id, "filhote", true, 900, 1240, true, true, false, 0, 0);
	}

	private ResultActions postRun(String body) throws Exception {
		return mvc.perform(post("/api/runs").header("Authorization", bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(body));
	}

	private ResultActions postClear(String dino, String difficulty) throws Exception {
		return mvc.perform(post("/api/clears").header("Authorization", bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(json("dino", dino, "difficulty", difficulty)));
	}

	@Test
	void defeatIsPaidByTheServerRules() throws Exception {
		postRun(defeat(UUID.randomUUID())).andExpect(status().isCreated())
				.andExpect(jsonPath("$.rewards.fossils").value(111))
				.andExpect(jsonPath("$.rewards.masteryXp").value(143))
				.andExpect(jsonPath("$.rewards.levelBefore").value(1))
				.andExpect(jsonPath("$.rewards.levelAfter").value(2))
				.andExpect(jsonPath("$.rewards.firstWinBonus").value(0))
				.andExpect(jsonPath("$.save.fossils").value(111))
				.andExpect(jsonPath("$.save.runs").value(1))
				.andExpect(jsonPath("$.save.wins").value(0))
				.andExpect(jsonPath("$.save.lastDino").value("trex"));
		assertThat(jdbc.queryForObject("select upgrades->0->>'id' from run", String.class)).isEqualTo("bite_power");
	}

	@Test
	void victoryAppliesTheFirstClearOnce() throws Exception {
		// 900 s, 1240 kills, elite + boss on Filhote: floor(405 × 0.75) = 303, plus the 60 first-win bonus.
		postRun(filhoteWin(UUID.randomUUID())).andExpect(status().isCreated())
				.andExpect(jsonPath("$.rewards.fossils").value(363))
				.andExpect(jsonPath("$.rewards.firstWinBonus").value(60))
				.andExpect(jsonPath("$.rewards.unlockedDifficulty").value("normal"))
				.andExpect(jsonPath("$.save.cleared.trex").value(0))
				.andExpect(jsonPath("$.save.wins").value(1));

		postRun(filhoteWin(UUID.randomUUID())).andExpect(status().isCreated())
				.andExpect(jsonPath("$.rewards.fossils").value(303))
				.andExpect(jsonPath("$.rewards.firstWinBonus").value(0))
				.andExpect(jsonPath("$.rewards.unlockedDifficulty").doesNotExist())
				.andExpect(jsonPath("$.save.fossils").value(666));
	}

	@Test
	void resendingTheSameRunIsIdempotent() throws Exception {
		UUID id = UUID.randomUUID();
		postRun(defeat(id)).andExpect(status().isCreated());
		postRun(defeat(id)).andExpect(status().isOk())
				.andExpect(jsonPath("$.rewards.fossils").value(111))
				.andExpect(jsonPath("$.save.fossils").value(111))
				.andExpect(jsonPath("$.save.runs").value(1));
		assertThat(jdbc.queryForObject("select count(*) from run", Integer.class)).isEqualTo(1);
	}

	@Test
	void clearWhenTheBossFallsPaysOnceAndTheRunDoesNotPayAgain() throws Exception {
		postClear("trex", "filhote").andExpect(status().isOk())
				.andExpect(jsonPath("$.firstWinBonus").value(60))
				.andExpect(jsonPath("$.unlockedDifficulty").value("normal"));
		postClear("trex", "filhote").andExpect(status().isOk()).andExpect(jsonPath("$.firstWinBonus").value(0));

		postRun(filhoteWin(UUID.randomUUID())).andExpect(status().isCreated())
				.andExpect(jsonPath("$.rewards.firstWinBonus").value(0))
				.andExpect(jsonPath("$.rewards.fossils").value(303))
				.andExpect(jsonPath("$.save.fossils").value(363));
	}

	@Test
	void endlessRunUpdatesBestEra() throws Exception {
		postRun(run(UUID.randomUUID(), "filhote", true, 1733.3, 3020, true, true, true, 4, 833.3))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.save.endlessRuns").value(1))
				.andExpect(jsonPath("$.save.bestEra").value(4))
				.andExpect(jsonPath("$.save.bestEraByDino.trex").value(4));
	}

	@Test
	void inconsistentRunsAre400() throws Exception {
		postRun(run(UUID.randomUUID(), "filhote", true, 900, 10, false, false, false, 0, 0))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		postRun(run(UUID.randomUUID(), "filhote", false, 900, 10, false, false, false, 3, 0))
				.andExpect(status().isBadRequest());
		postRun(run(UUID.randomUUID(), "filhote", false, 99999, 10, false, false, false, 0, 0))
				.andExpect(status().isBadRequest());
	}

	@Test
	void lockedDifficultyIs409() throws Exception {
		postRun(run(UUID.randomUUID(), "predador", false, 300, 100, false, false, false, 0, 0))
				.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DIFFICULTY_LOCKED"));
		postClear("trex", "extincao").andExpect(status().isConflict());
	}

	@Test
	void aRunIdUsedByAnotherPlayerIs409() throws Exception {
		UUID id = UUID.randomUUID();
		postRun(defeat(id)).andExpect(status().isCreated());
		token = newPlayerToken("outra@example.com");
		postRun(defeat(id)).andExpect(status().isConflict());
	}

}
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd server && ./mvnw -q test -Dtest=RunApiTest
```
Expected: falhas com `404`.

- [ ] **Step 3: Migration**

`server/src/main/resources/db/migration/V3__run.sql`:
```sql
CREATE TABLE run (
    id                   uuid PRIMARY KEY,
    player_id            uuid        NOT NULL REFERENCES player (id) ON DELETE CASCADE,
    dino                 varchar(20) NOT NULL CHECK (dino IN ('trex', 'raptor', 'triceratops')),
    difficulty           varchar(20) NOT NULL CHECK (difficulty IN ('filhote', 'normal', 'predador', 'extincao')),
    victory              boolean     NOT NULL,
    elite_killed         boolean     NOT NULL,
    boss_killed          boolean     NOT NULL,
    endless              boolean     NOT NULL,
    elapsed_time         double precision NOT NULL,
    endless_time         double precision NOT NULL,
    kills                integer     NOT NULL,
    level                integer     NOT NULL,
    era                  integer     NOT NULL,
    damage_dealt         double precision NOT NULL,
    damage_taken         double precision NOT NULL,
    upgrades             jsonb       NOT NULL,
    fossils_earned       integer     NOT NULL,
    first_win_bonus      integer     NOT NULL DEFAULT 0,
    unlocked_difficulty  varchar(20),
    mastery_xp_earned    integer     NOT NULL,
    mastery_level_before integer     NOT NULL,
    mastery_level_after  integer     NOT NULL,
    created_at           timestamptz NOT NULL
);

CREATE INDEX run_player_created_idx ON run (player_id, created_at DESC);
```

- [ ] **Step 4: DTOs**

`run/UpgradeEntry.java`:
```java
package com.dinomutation.run;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** One mutation picked during the run (history only; never used to pay anything). */
public record UpgradeEntry(
		@NotBlank @Size(max = 60) String id,
		@Size(max = 80) String name,
		@Size(max = 20) String rarity,
		@Min(1) int level) {}
```

`run/RunRequest.java`:
```java
package com.dinomutation.run;

import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/** What the game reports at the end of a run. `id` is generated by the game: resending is safe. */
public record RunRequest(
		@NotNull UUID id,
		@NotNull DinoId dino,
		@NotNull DifficultyId difficulty,
		boolean victory,
		@DecimalMin("0") @DecimalMax("14400") double elapsedTime,
		@PositiveOrZero int kills,
		@Min(1) int level,
		boolean eliteKilled,
		boolean bossKilled,
		boolean endless,
		@PositiveOrZero int era,
		@PositiveOrZero double endlessTime,
		@PositiveOrZero double damageDealt,
		@PositiveOrZero double damageTaken,
		@NotNull @Size(max = 100) List<@Valid UpgradeEntry> upgrades) {}
```

`run/RunRewardsDto.java`:
```java
package com.dinomutation.run;

import com.fasterxml.jackson.annotation.JsonInclude;

/** What a run paid. `unlockedDifficulty` is a difficulty id ("normal"); the game shows the name. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RunRewardsDto(int fossils, int firstWinBonus, String unlockedDifficulty, int masteryXp, int levelBefore,
		int levelAfter) {}
```

`run/RunResponse.java`:
```java
package com.dinomutation.run;

import com.dinomutation.player.SaveDto;

public record RunResponse(RunRewardsDto rewards, SaveDto save) {}
```

`run/RunOutcome.java`:
```java
package com.dinomutation.run;

/** `created` = false when the same run id had already been recorded (the stored rewards are returned). */
public record RunOutcome(RunResponse response, boolean created) {}
```

`run/ClearRequest.java`:
```java
package com.dinomutation.run;

import com.dinomutation.economy.DifficultyId;
import com.dinomutation.economy.DinoId;
import jakarta.validation.constraints.NotNull;

public record ClearRequest(@NotNull DinoId dino, @NotNull DifficultyId difficulty) {}
```

`run/ClearResponse.java`:
```java
package com.dinomutation.run;

import com.dinomutation.player.FirstClear;
import com.fasterxml.jackson.annotation.JsonInclude;

/** First-win result: bonus paid (0 if that difficulty was already beaten) and the id it unlocked. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ClearResponse(int firstWinBonus, String unlockedDifficulty) {

	public static ClearResponse of(FirstClear clear) {
		return new ClearResponse(clear.firstWinBonus(), clear.unlockedDifficulty());
	}
}
```

- [ ] **Step 5: `FirstClear` e `applyClear` em `ProgressRules`**

`player/FirstClear.java` (fica em `player` para o pacote não depender de `run`):
```java
package com.dinomutation.player;

/** Result of a first win on a difficulty: bonus paid and the difficulty id it unlocked (or none). */
public record FirstClear(int firstWinBonus, String unlockedDifficulty) {

	public static final FirstClear NONE = new FirstClear(0, null);
}
```

Em `player/ProgressRules.java`, adicione o método:
```java
	/** First win on a difficulty: unlocks the next one and pays the bonus once (applyClear in Save.ts). */
	public FirstClear applyClear(Player player, DinoId dino, DifficultyId difficulty) {
		DinoProgress progress = player.progress(dino);
		int index = economy.difficultyIndex(difficulty);
		if (index <= progress.getClearedIndex()) {
			return FirstClear.NONE;
		}
		progress.setClearedIndex(index);
		int bonus = economy.difficulty(difficulty).firstWinBonus();
		player.addFossils(bonus);
		return new FirstClear(bonus, economy.next(difficulty).map(DifficultyId::id).orElse(null));
	}
```

- [ ] **Step 6: Entidade, repositório, serviço e controller**

`run/GameRun.java`:
```java
package com.dinomutation.run;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A recorded run with what the server paid for it (kept so a resend returns the same rewards). */
@Entity
@Table(name = "run")
public class GameRun {

	@Id
	private UUID id;

	@Column(nullable = false)
	private UUID playerId;

	private String dino;
	private String difficulty;
	private boolean victory;
	private boolean eliteKilled;
	private boolean bossKilled;
	private boolean endless;
	private double elapsedTime;
	private double endlessTime;
	private int kills;
	private int level;
	private int era;
	private double damageDealt;
	private double damageTaken;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false)
	private List<UpgradeEntry> upgrades;

	private int fossilsEarned;
	private int firstWinBonus;
	private String unlockedDifficulty;
	private int masteryXpEarned;
	private int masteryLevelBefore;
	private int masteryLevelAfter;

	@Column(nullable = false)
	private Instant createdAt;

	protected GameRun() {
	}

	public static GameRun of(UUID playerId, RunRequest req, RunRewardsDto rewards, Instant now) {
		GameRun r = new GameRun();
		r.id = req.id();
		r.playerId = playerId;
		r.dino = req.dino().id();
		r.difficulty = req.difficulty().id();
		r.victory = req.victory();
		r.eliteKilled = req.eliteKilled();
		r.bossKilled = req.bossKilled();
		r.endless = req.endless();
		r.elapsedTime = req.elapsedTime();
		r.endlessTime = req.endlessTime();
		r.kills = req.kills();
		r.level = req.level();
		r.era = req.era();
		r.damageDealt = req.damageDealt();
		r.damageTaken = req.damageTaken();
		r.upgrades = List.copyOf(req.upgrades());
		r.fossilsEarned = rewards.fossils();
		r.firstWinBonus = rewards.firstWinBonus();
		r.unlockedDifficulty = rewards.unlockedDifficulty();
		r.masteryXpEarned = rewards.masteryXp();
		r.masteryLevelBefore = rewards.levelBefore();
		r.masteryLevelAfter = rewards.levelAfter();
		r.createdAt = now;
		return r;
	}

	public UUID getPlayerId() {
		return playerId;
	}

	public RunRewardsDto rewards() {
		return new RunRewardsDto(fossilsEarned, firstWinBonus, unlockedDifficulty, masteryXpEarned, masteryLevelBefore,
				masteryLevelAfter);
	}
}
```

`run/GameRunRepository.java`:
```java
package com.dinomutation.run;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameRunRepository extends JpaRepository<GameRun, UUID> {}
```

`run/RunService.java`:
```java
package com.dinomutation.run;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import com.dinomutation.economy.Economy;
import com.dinomutation.economy.RunFacts;
import com.dinomutation.player.DinoProgress;
import com.dinomutation.player.FirstClear;
import com.dinomutation.player.Player;
import com.dinomutation.player.PlayerRepository;
import com.dinomutation.player.ProgressRules;
import com.dinomutation.player.SaveDto;
import java.time.Clock;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The server side of recordRun / recordClear (Save.ts): the client reports, the server pays. */
@Service
public class RunService {

	private final PlayerRepository players;
	private final GameRunRepository runs;
	private final Economy economy;
	private final ProgressRules rules;
	private final Clock clock;

	public RunService(PlayerRepository players, GameRunRepository runs, Economy economy, ProgressRules rules, Clock clock) {
		this.players = players;
		this.runs = runs;
		this.economy = economy;
		this.rules = rules;
		this.clock = clock;
	}

	/** Saved the moment the boss falls: the player may go endless and close the tab. */
	@Transactional
	public ClearResponse recordClear(UUID playerId, ClearRequest req) {
		Player player = players.getRequired(playerId);
		rules.requireUnlocked(player, req.dino(), req.difficulty());
		return ClearResponse.of(rules.applyClear(player, req.dino(), req.difficulty()));
	}

	@Transactional
	public RunOutcome recordRun(UUID playerId, RunRequest req) {
		Optional<GameRun> existing = runs.findById(req.id());
		if (existing.isPresent()) {
			if (!existing.get().getPlayerId().equals(playerId)) {
				throw new ApiException(ErrorCode.CONFLICT, "Este id de run já foi usado.");
			}
			return new RunOutcome(new RunResponse(existing.get().rewards(), SaveDto.of(players.getRequired(playerId))), false);
		}
		requireConsistent(req);
		Player player = players.getRequired(playerId);
		rules.requireUnlocked(player, req.dino(), req.difficulty());
		DinoProgress progress = player.progress(req.dino());

		player.setRuns(player.getRuns() + 1);
		if (req.victory()) {
			player.setWins(player.getWins() + 1);
		}
		player.setBestTime(Math.max(player.getBestTime(), req.elapsedTime()));
		progress.setBestTime(Math.max(progress.getBestTime(), req.elapsedTime()));
		player.setLastDino(req.dino().id());
		int era = req.endless() ? req.era() : 0;
		if (era > 0) {
			player.setEndlessRuns(player.getEndlessRuns() + 1);
			player.setBestEra(Math.max(player.getBestEra(), era));
			progress.setBestEra(Math.max(progress.getBestEra(), era));
		}

		RunFacts facts = new RunFacts(req.difficulty(), req.elapsedTime(), req.kills(), req.eliteKilled(), req.bossKilled());
		int runFossils = economy.fossilsForRun(facts);
		// Normally already applied by POST /api/clears when the boss fell; then this pays nothing.
		FirstClear clear = req.victory() ? rules.applyClear(player, req.dino(), req.difficulty()) : FirstClear.NONE;
		int masteryXp = economy.masteryXpForRun(facts);
		int levelBefore = economy.masteryLevel(progress.getMasteryXp());
		player.addFossils(runFossils);
		progress.setMasteryXp(progress.getMasteryXp() + masteryXp);
		int levelAfter = economy.masteryLevel(progress.getMasteryXp());

		RunRewardsDto rewards = new RunRewardsDto(runFossils + clear.firstWinBonus(), clear.firstWinBonus(),
				clear.unlockedDifficulty(), masteryXp, levelBefore, levelAfter);
		runs.save(GameRun.of(playerId, req, rewards, clock.instant()));
		return new RunOutcome(new RunResponse(rewards, SaveDto.of(player)), true);
	}

	/** Cheap consistency checks; statistical plausibility (kills per minute…) is phase 3. */
	private static void requireConsistent(RunRequest r) {
		if (r.victory() && !r.bossKilled()) {
			throw invalid("vitória sem o chefe derrotado");
		}
		if (r.endless() && !r.bossKilled()) {
			throw invalid("Era Sem Fim sem o chefe derrotado");
		}
		if (r.era() > 0 && !r.endless()) {
			throw invalid("Era fora do modo Sem Fim");
		}
		if (r.endlessTime() > r.elapsedTime()) {
			throw invalid("tempo na Era Sem Fim maior que o tempo total");
		}
	}

	private static ApiException invalid(String reason) {
		return new ApiException(ErrorCode.VALIDATION_ERROR, "Run inconsistente: " + reason + ".");
	}
}
```

`run/RunController.java`:
```java
package com.dinomutation.run;

import com.dinomutation.common.CurrentPlayer;
import com.dinomutation.common.OptimisticRetry;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class RunController {

	private final RunService service;
	private final OptimisticRetry retry;

	public RunController(RunService service, OptimisticRetry retry) {
		this.service = service;
		this.retry = retry;
	}

	@PostMapping("/runs")
	public ResponseEntity<RunResponse> recordRun(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody RunRequest req) {
		RunOutcome outcome = retry.once(() -> service.recordRun(CurrentPlayer.id(jwt), req));
		return ResponseEntity.status(outcome.created() ? HttpStatus.CREATED : HttpStatus.OK).body(outcome.response());
	}

	@PostMapping("/clears")
	public ClearResponse recordClear(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ClearRequest req) {
		return retry.once(() -> service.recordClear(CurrentPlayer.id(jwt), req));
	}
}
```

- [ ] **Step 7: Rodar e ver passar**

```bash
cd server && ./mvnw -q test -Dtest=RunApiTest
```
Expected: `BUILD SUCCESS` (8 testes). Se a gravação de `upgrades` falhar com erro de *FormatMapper*/JSON, pare e reporte o erro exato: o Hibernate 7.4 traz suporte a Jackson 3, e isso precisa funcionar sem configuração extra.

- [ ] **Step 8: Commit**

```bash
git add server
git commit -m "feat(server): runs e vitórias pagas pelo servidor, com idempotência por id

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Loja, concorrência e documentação OpenAPI

**Files:**
- Create: `shop/PurchaseRequest.java`, `shop/PurchaseResponse.java`, `shop/ShopService.java`, `shop/ShopController.java`, `common/OpenApiConfig.java`
- Test: `shop/ShopApiTest.java`, `common/OpenApiTest.java`

**Interfaces:**
- Consumes: `Economy.shopItem` (Task 4); `Player.shopLevel`/`setShopLevel`/`spendFossils` (Task 6); `OptimisticRetry` (Task 10).
- Produces:
  - `POST /api/shop/purchases` com `{dino, itemId}`, que responde `200 {save}`.
  - Swagger UI em `/swagger-ui`, com o esquema `bearer`.

- [ ] **Step 1: Escrever os testes**

`server/src/test/java/com/dinomutation/shop/ShopApiTest.java`:
```java
package com.dinomutation.shop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class ShopApiTest extends IntegrationTest {

	private String token;

	@BeforeEach
	void signUp() throws Exception {
		token = newPlayerToken("pedro@example.com");
	}

	private void setFossils(int fossils) {
		jdbc.update("update player set fossils = ?", fossils);
	}

	private ResultActions buy(String dino, String itemId) throws Exception {
		return mvc.perform(post("/api/shop/purchases").header("Authorization", bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(json("dino", dino, "itemId", itemId)));
	}

	@Test
	void purchaseDebitsAndRaisesTheLevel() throws Exception {
		setFossils(100);
		buy("trex", "meta_vida").andExpect(status().isOk())
				.andExpect(jsonPath("$.save.fossils").value(70))
				.andExpect(jsonPath("$.save.shop.trex.meta_vida").value(1));
		buy("trex", "meta_vida").andExpect(status().isOk())
				.andExpect(jsonPath("$.save.fossils").value(0))
				.andExpect(jsonPath("$.save.shop.trex.meta_vida").value(2));
	}

	@Test
	void notEnoughFossilsIs409() throws Exception {
		setFossils(10);
		buy("trex", "meta_vida").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INSUFFICIENT_FOSSILS"));
	}

	@Test
	void maxedItemIs409() throws Exception {
		setFossils(5000);
		for (int i = 0; i < 5; i++) {
			buy("trex", "meta_vida").andExpect(status().isOk());
		}
		buy("trex", "meta_vida").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ITEM_MAXED"));
	}

	@Test
	void itemFromAnotherDinosShopIs404() throws Exception {
		setFossils(100);
		buy("trex", "meta_raptor_claw").andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ITEM_NOT_FOUND"));
	}

	@Test
	void twoSimultaneousPurchasesWithFundsForOneOnlyChargeOnce() throws Exception {
		setFossils(30);
		CountDownLatch start = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(2);
		try {
			List<Future<Integer>> results = new ArrayList<>();
			for (String item : List.of("meta_vida", "meta_dano")) {
				Callable<Integer> call = () -> {
					start.await();
					return buy("trex", item).andReturn().getResponse().getStatus();
				};
				results.add(pool.submit(call));
			}
			start.countDown();
			List<Integer> statuses = new ArrayList<>();
			for (Future<Integer> f : results) {
				statuses.add(f.get());
			}
			assertThat(statuses).containsExactlyInAnyOrder(200, 409);
		} finally {
			pool.shutdown();
		}
		assertThat(jdbc.queryForObject("select fossils from player", Integer.class)).isZero();
		assertThat(jdbc.queryForObject("select count(*) from shop_level", Integer.class)).isEqualTo(1);
	}

}
```

`server/src/test/java/com/dinomutation/common/OpenApiTest.java`:
```java
package com.dinomutation.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dinomutation.IntegrationTest;
import org.junit.jupiter.api.Test;

class OpenApiTest extends IntegrationTest {

	@Test
	void documentsTheGameEndpointsAndBearerAuth() throws Exception {
		mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
				.andExpect(jsonPath("$.info.title").value("DinoMutation API"))
				.andExpect(jsonPath("$.paths['/api/runs']").exists())
				.andExpect(jsonPath("$.paths['/api/shop/purchases']").exists())
				.andExpect(jsonPath("$.components.securitySchemes.bearer.scheme").value("bearer"));
	}

}
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd server && ./mvnw -q test -Dtest='ShopApiTest,OpenApiTest'
```
Expected: falhas (`404` na loja; o título da API não é `DinoMutation API`).

- [ ] **Step 3: Implementar a loja**

`shop/PurchaseRequest.java`:
```java
package com.dinomutation.shop;

import com.dinomutation.economy.DinoId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PurchaseRequest(@NotNull DinoId dino, @NotBlank @Size(max = 40) String itemId) {}
```

`shop/PurchaseResponse.java`:
```java
package com.dinomutation.shop;

import com.dinomutation.player.SaveDto;

public record PurchaseResponse(SaveDto save) {}
```

`shop/ShopService.java`:
```java
package com.dinomutation.shop;

import com.dinomutation.common.ApiException;
import com.dinomutation.common.ErrorCode;
import com.dinomutation.economy.Economy;
import com.dinomutation.economy.EconomyConfig;
import com.dinomutation.player.Player;
import com.dinomutation.player.PlayerRepository;
import com.dinomutation.player.SaveDto;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The Covil shop: prices come from economy.json and the balance is checked and debited atomically. */
@Service
public class ShopService {

	private final PlayerRepository players;
	private final Economy economy;

	public ShopService(PlayerRepository players, Economy economy) {
		this.players = players;
		this.economy = economy;
	}

	@Transactional
	public SaveDto purchase(UUID playerId, PurchaseRequest req) {
		Player player = players.getRequired(playerId);
		EconomyConfig.ShopItem item = economy.shopItem(req.dino(), req.itemId())
				.orElseThrow(() -> new ApiException(ErrorCode.ITEM_NOT_FOUND, "Este item não existe na loja deste dinossauro."));
		int level = player.shopLevel(req.dino(), item.id());
		if (level >= item.costs().size()) {
			throw new ApiException(ErrorCode.ITEM_MAXED, "Este item já está no nível máximo.");
		}
		int cost = item.costs().get(level);
		if (player.getFossils() < cost) {
			throw new ApiException(ErrorCode.INSUFFICIENT_FOSSILS, "Fósseis insuficientes.");
		}
		player.spendFossils(cost);
		player.setShopLevel(req.dino(), item.id(), level + 1);
		return SaveDto.of(player);
	}
}
```

`shop/ShopController.java`:
```java
package com.dinomutation.shop;

import com.dinomutation.common.CurrentPlayer;
import com.dinomutation.common.OptimisticRetry;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/shop")
public class ShopController {

	private final ShopService service;
	private final OptimisticRetry retry;

	public ShopController(ShopService service, OptimisticRetry retry) {
		this.service = service;
		this.retry = retry;
	}

	@PostMapping("/purchases")
	public PurchaseResponse purchase(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PurchaseRequest req) {
		return new PurchaseResponse(retry.once(() -> service.purchase(CurrentPlayer.id(jwt), req)));
	}
}
```

`common/OpenApiConfig.java`:
```java
package com.dinomutation.common;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
		info = @Info(title = "DinoMutation API", version = "0.1",
				description = "Contas, save na nuvem e economia do DinoMutation. Use /api/auth/login e clique em Authorize com o accessToken."),
		security = @SecurityRequirement(name = "bearer"))
@SecurityScheme(name = "bearer", type = SecuritySchemeType.HTTP, scheme = "bearer", bearerFormat = "JWT")
public class OpenApiConfig {
}
```

- [ ] **Step 4: Rodar a suíte inteira do servidor**

```bash
cd server && ./mvnw -q verify
```
Expected: `BUILD SUCCESS` com todos os testes (Economy, Security, PlayerPersistence, Auth*, PlayerApi, RunApi, ShopApi, OpenApi). Se `twoSimultaneousPurchasesWithFundsForOneOnlyChargeOnce` ficar intermitente, rode a classe 5 vezes (`-Dtest=ShopApiTest -Dsurefire.rerunFailingTestsCount=0`) e reporte a saída antes de mudar qualquer coisa.

- [ ] **Step 5: Conferir a API rodando de verdade**

```bash
docker compose up -d
cd server && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```
Em outro terminal:
```bash
curl -s -X POST localhost:8080/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"teste@example.com","password":"senha-forte-123","displayName":"Teste"}'
```
Expected: JSON com `accessToken`. Abra `http://localhost:8080/swagger-ui` no navegador e confira a lista de endpoints. Pare o servidor com Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add server
git commit -m "feat(server): loja com débito atômico, teste de concorrência e Swagger

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Parte C: jogo

> Caminhos relativos a `client/`. Os testes do cliente seguem o estilo dos scripts de `tools/balance` (Node puro, `check(ok, msg)`, `Tudo certo`), rodando com o loader `tools/balance/loader/register.mjs`.

### Task 13: `SaveStore` com `LocalSaveStore`, sem mudar o comportamento

**Files:**
- Create: `src/game/core/save/SaveStore.ts`, `src/game/core/save/LocalSaveStore.ts`, `src/utils/uuid.ts`
- Modify (reescrita): `src/game/core/Save.ts`
- Modify: `src/game/core/RunState.ts`, `src/game/core/Run.ts`, `src/game/scenes/MenuScene.ts`, `src/game/scenes/CharacterSelectScene.ts`, `src/game/scenes/LairScene.ts`, `src/game/scenes/RunScene.ts`, `src/game/scenes/ResultScene.ts`, `tools/balance/save-test.ts`

**Interfaces:**
- Consumes: as funções atuais de `Save.ts`.
- Produces:
  - Em `Save.ts`:
    - os tipos `SaveData`, `RunRewards` e `RunRecordResult { save; rewards; pending? }`
    - `emptySave()`, `applyRun(s, state, victory): RunRewards`, `applyClear(s, dino, difficulty): FirstClear | undefined`, `applyPurchase(s, dino, item): boolean`
    - `unlocksBetween(dino, before, after): string[]`, `clearedIndex`, `isDifficultyUnlocked`, `preferredDifficulty`, `shopLevel`, `purchaseStatus`
    - `metaLoadout(dino, s)` (agora com `s` obrigatório)
  - `SaveStore` (interface), `saveStore()` e `setSaveStore(store)`.
  - `LocalSaveStore`, `loadLocalSave()`, `writeLocalSave()` e `debugGrant()`.
  - `RunState.id: string` e `uuid(): string`.

- [ ] **Step 1: Atualizar o teste do save para a nova API (falha primeiro)**

Troque o começo de `tools/balance/save-test.ts` (do comentário até a linha `const check = ...};`, inclusive) por:
```ts
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
```

No resto do arquivo, coloque `await` antes de toda chamada a `recordClear(` e `recordRun(`. Por exemplo, `state.firstClear = recordClear(state.dinosaur, state.difficulty);` vira `state.firstClear = await recordClear(state.dinosaur, state.difficulty);`, e `const { save, rewards } = recordRun(state, true);` vira `const { save, rewards } = await recordRun(state, true);`.

Antes da linha final `console.log(failures ? ...`, adicione:
```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd client && npm run test:save
```
Expected: erro ao importar `src/game/core/save/LocalSaveStore.ts` (o arquivo ainda não existe).

- [ ] **Step 3: UUID e id da run**

`src/utils/uuid.ts`:
```ts
/**
 * RFC 4122 version-4 id. crypto.randomUUID only exists in secure contexts (it is missing on
 * http://<LAN IP> while testing on a phone); getRandomValues works everywhere.
 */
export function uuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
```

Em `src/game/core/RunState.ts`:
- adicione `import { uuid } from '../../utils/uuid';` no topo;
- em `interface RunState`, como primeiro campo:
```ts
  /** Generated when the run starts; the API uses it to ignore a resent run (POST /api/runs). */
  id: string;
```
- em `createRunState`, como primeira propriedade do objeto retornado: `id: uuid(),`.

- [ ] **Step 4: Reescrever `src/game/core/Save.ts` (tipos + regras puras)**

Substitua o arquivo inteiro por:
```ts
import { DIFFICULTIES, DIFFICULTY_BY_ID, difficultyIndex, highestUnlocked, type DifficultyId } from '../../data/difficulty';
import type { DinoId } from '../../data/dinosaurs';
import {
  fossilsForRun, loadoutFor, masteryLevel, masteryXpForRun, unlocksAtMastery, type MetaBonus, type ShopItemDef,
} from '../../data/meta';
import type { FirstClear, RunState } from './RunState';

/**
 * Save format and the pure rules that change it. Where the save lives (browser or API) is
 * the SaveStore's job (core/save/); these functions only read or mutate a SaveData.
 */
export interface SaveData {
  runs: number;
  wins: number;
  bestTime: number;
  bestByDino: Partial<Record<DinoId, number>>;
  lastDino?: DinoId;
  /** Global currency. */
  fossils: number;
  /** Total mastery XP per dinosaur. */
  mastery: Partial<Record<DinoId, number>>;
  /** Purchased level of each shop item, per dinosaur. */
  shop: Partial<Record<DinoId, Record<string, number>>>;
  /** Endless mode: runs that continued past the story boss. */
  endlessRuns: number;
  /** Highest Era reached (overall and per dinosaur). */
  bestEra: number;
  bestEraByDino: Partial<Record<DinoId, number>>;
  /** Last patch-notes version the player has seen (see data/patchNotes.ts). */
  seenPatch?: string;
  /** Index in DIFFICULTIES of the highest difficulty beaten, per dinosaur (missing = none). */
  cleared: Partial<Record<DinoId, number>>;
  /** Last difficulty picked, per dinosaur. */
  difficulty: Partial<Record<DinoId, DifficultyId>>;
}

export function emptySave(): SaveData {
  return {
    runs: 0, wins: 0, bestTime: 0, bestByDino: {}, fossils: 0, mastery: {}, shop: {},
    endlessRuns: 0, bestEra: 0, bestEraByDino: {}, cleared: {}, difficulty: {},
  };
}

export interface RunRewards {
  /** Total Fósseis, including `firstWinBonus`. */
  fossils: number;
  /** First win on this difficulty with this dinosaur (0 = not a first win). */
  firstWinBonus: number;
  /** Difficulty unlocked by this win, if any. */
  unlockedDifficulty?: string;
  masteryXp: number;
  levelBefore: number;
  levelAfter: number;
  /** Human-readable unlocks from mastery levels gained this run. */
  unlocks: string[];
}

export interface RunRecordResult {
  save: SaveData;
  rewards: RunRewards;
  /** Cloud only: the API couldn't be reached, the run was queued and `rewards` is a local preview. */
  pending?: boolean;
}

/** Applies a finished run to `s` and returns its rewards (a story win also counts as a clear). */
export function applyRun(s: SaveData, state: RunState, victory: boolean): RunRewards {
  const dino = state.dinosaur;
  s.runs += 1;
  if (victory) s.wins += 1;
  s.bestTime = Math.max(s.bestTime, state.elapsedTime);
  s.bestByDino[dino] = Math.max(s.bestByDino[dino] ?? 0, state.elapsedTime);
  s.lastDino = dino;
  const era = state.endless ? state.era : 0;
  if (era > 0) {
    s.endlessRuns += 1;
    s.bestEra = Math.max(s.bestEra, era);
    s.bestEraByDino[dino] = Math.max(s.bestEraByDino[dino] ?? 0, era);
  }

  const runFossils = fossilsForRun({ ...state, fossilMult: DIFFICULTY_BY_ID[state.difficulty].fossilMult });
  // The clear is normally saved when the boss fell (recordClear); this covers callers that didn't.
  const clear = state.firstClear ?? (victory ? applyClear(s, dino, state.difficulty) : undefined);
  const firstWinBonus = clear?.firstWinBonus ?? 0;
  const masteryXp = masteryXpForRun(state);
  const xpBefore = s.mastery[dino] ?? 0;
  const levelBefore = masteryLevel(xpBefore);
  s.fossils += runFossils;
  s.mastery[dino] = xpBefore + masteryXp;
  const levelAfter = masteryLevel(s.mastery[dino]!);
  return {
    fossils: runFossils + firstWinBonus, firstWinBonus, unlockedDifficulty: clear?.unlockedDifficulty,
    masteryXp, levelBefore, levelAfter, unlocks: unlocksBetween(dino, levelBefore, levelAfter),
  };
}

/** Human-readable unlocks of the mastery levels gained between two levels. */
export function unlocksBetween(dino: DinoId, levelBefore: number, levelAfter: number): string[] {
  const unlocks: string[] = [];
  for (let l = levelBefore + 1; l <= levelAfter; l++) unlocks.push(...unlocksAtMastery(dino, l));
  return unlocks;
}

// ─────────────────────────── difficulty ───────────────────────────

/**
 * First win on a difficulty with a dinosaur: unlocks the next one and pays the first-win
 * bonus. Returns undefined if that difficulty was already beaten.
 */
export function applyClear(s: SaveData, dino: DinoId, difficulty: DifficultyId): FirstClear | undefined {
  const idx = difficultyIndex(difficulty);
  if (idx <= clearedIndex(s, dino)) return undefined;
  s.cleared[dino] = idx;
  const firstWinBonus = DIFFICULTY_BY_ID[difficulty].firstWinBonus;
  s.fossils += firstWinBonus;
  return { firstWinBonus, unlockedDifficulty: DIFFICULTIES[idx + 1]?.name };
}

/** Index of the highest difficulty beaten with `dino` (-1 = none). */
export function clearedIndex(s: SaveData, dino: DinoId): number {
  return s.cleared[dino] ?? -1;
}

export function isDifficultyUnlocked(s: SaveData, dino: DinoId, id: DifficultyId): boolean {
  return difficultyIndex(id) <= highestUnlocked(clearedIndex(s, dino));
}

/** Last difficulty picked for `dino`, or the highest unlocked one. */
export function preferredDifficulty(s: SaveData, dino: DinoId): DifficultyId {
  const last = s.difficulty[dino];
  if (last && isDifficultyUnlocked(s, dino, last)) return last;
  return DIFFICULTIES[highestUnlocked(clearedIndex(s, dino))].id;
}

// ─────────────────────────── shop ───────────────────────────

export function shopLevel(s: SaveData, dino: DinoId, itemId: string): number {
  return s.shop[dino]?.[itemId] ?? 0;
}

export type PurchaseStatus = 'ok' | 'maxed' | 'poor';

export function purchaseStatus(s: SaveData, dino: DinoId, item: ShopItemDef): PurchaseStatus {
  const lvl = shopLevel(s, dino, item.id);
  if (lvl >= item.costs.length) return 'maxed';
  if (s.fossils < item.costs[lvl]) return 'poor';
  return 'ok';
}

/** Buys the next level of an item in `s`. Returns false if not allowed. */
export function applyPurchase(s: SaveData, dino: DinoId, item: ShopItemDef): boolean {
  if (purchaseStatus(s, dino, item) !== 'ok') return false;
  const lvl = shopLevel(s, dino, item.id);
  s.fossils -= item.costs[lvl];
  s.shop[dino] = { ...s.shop[dino], [item.id]: lvl + 1 };
  return true;
}

/** Hidden upgrades applied at run start: shop levels, passive ranks and ability ranks. */
export function metaLoadout(dino: DinoId, s: SaveData): MetaBonus[] {
  return loadoutFor(dino, s.shop[dino] ?? {}, s.mastery[dino] ?? 0);
}
```

- [ ] **Step 5: `SaveStore` e `LocalSaveStore`**

`src/game/core/save/SaveStore.ts`:
```ts
import type { DifficultyId } from '../../../data/difficulty';
import type { DinoId } from '../../../data/dinosaurs';
import type { ShopItemDef } from '../../../data/meta';
import type { FirstClear, RunState } from '../RunState';
import type { RunRecordResult, SaveData } from '../Save';
import { LocalSaveStore } from './LocalSaveStore';

/**
 * Where progress lives: the browser (guest) or the API (signed in). Reads are synchronous
 * (scenes draw from current()); writes are commands that resolve with the updated save.
 */
export interface SaveStore {
  readonly kind: 'local' | 'cloud';
  current(): SaveData;
  recordRun(state: RunState, victory: boolean): Promise<RunRecordResult>;
  /** Saved the moment the story boss falls (the player may quit mid-endless). */
  recordClear(dino: DinoId, difficulty: DifficultyId): Promise<FirstClear | undefined>;
  /** Resolves with the updated save, or null when the purchase isn't allowed. */
  purchase(dino: DinoId, item: ShopItemDef): Promise<SaveData | null>;
  rememberDifficulty(dino: DinoId, id: DifficultyId): void;
  markPatchSeen(version: string): void;
}

let active: SaveStore | null = null;

export function saveStore(): SaveStore {
  return (active ??= new LocalSaveStore());
}

export function setSaveStore(store: SaveStore): void {
  active = store;
}
```

`src/game/core/save/LocalSaveStore.ts`:
```ts
import type { DifficultyId } from '../../../data/difficulty';
import { DINO_ORDER, type DinoId } from '../../../data/dinosaurs';
import type { ShopItemDef } from '../../../data/meta';
import type { FirstClear, RunState } from '../RunState';
import { applyClear, applyPurchase, applyRun, emptySave, type RunRecordResult, type SaveData } from '../Save';
import type { SaveStore } from './SaveStore';

const KEY = 'dino-roguelite-save-v1';

/** Guest progress in the browser's localStorage, exactly as before accounts existed. */
export class LocalSaveStore implements SaveStore {
  readonly kind = 'local';

  current(): SaveData {
    return loadLocalSave();
  }

  async recordRun(state: RunState, victory: boolean): Promise<RunRecordResult> {
    const s = loadLocalSave();
    const rewards = applyRun(s, state, victory);
    writeLocalSave(s);
    return { save: s, rewards };
  }

  async recordClear(dino: DinoId, difficulty: DifficultyId): Promise<FirstClear | undefined> {
    const s = loadLocalSave();
    const clear = applyClear(s, dino, difficulty);
    if (clear) writeLocalSave(s);
    return clear;
  }

  async purchase(dino: DinoId, item: ShopItemDef): Promise<SaveData | null> {
    const s = loadLocalSave();
    if (!applyPurchase(s, dino, item)) return null;
    writeLocalSave(s);
    return s;
  }

  rememberDifficulty(dino: DinoId, id: DifficultyId): void {
    const s = loadLocalSave();
    s.difficulty[dino] = id;
    writeLocalSave(s);
  }

  markPatchSeen(version: string): void {
    const s = loadLocalSave();
    s.seenPatch = version;
    writeLocalSave(s);
  }
}

export function loadLocalSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySave();
    // Older saves (before meta-progression / endless mode) simply lack the new fields.
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const save = { ...emptySave(), ...parsed } as SaveData;
    // Before difficulties: players who already won skip Filhote (Normal unlocked for every dino).
    if (!parsed.cleared && save.wins > 0) for (const d of DINO_ORDER) save.cleared[d] = 0;
    return save;
  } catch {
    return emptySave();
  }
}

export function writeLocalSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage unavailable (private mode etc.) — progress simply isn't kept
  }
}

/** Debug helper (?debug, guest only): grants fossils and mastery to every dinosaur. */
export function debugGrant(fossils: number, masteryXp: number): SaveData {
  const s = loadLocalSave();
  s.fossils += fossils;
  for (const d of DINO_ORDER) s.mastery[d] = (s.mastery[d] ?? 0) + masteryXp;
  writeLocalSave(s);
  return s;
}
```

- [ ] **Step 6: Rodar o teste do save**

```bash
cd client && npm run test:save
```
Expected: `Tudo certo` (os casos antigos mais "Compra no Covil" e "Run ganha um id").

- [ ] **Step 7: Atualizar as cenas e o `Run.ts`**

`src/game/core/Run.ts`:
- troque `import { metaLoadout } from './Save';` por:
```ts
import { metaLoadout } from './Save';
import { saveStore } from './save/SaveStore';
```
- troque `this.upgrades.applyMeta(metaLoadout(dinoId));` por `this.upgrades.applyMeta(metaLoadout(dinoId, saveStore().current()));`.

`src/game/scenes/MenuScene.ts`:
- troque `import { loadSave, markPatchSeen } from '../core/Save';` por `import { saveStore } from '../core/save/SaveStore';`;
- troque `const save = loadSave();` por `const save = saveStore().current();`;
- troque as duas chamadas `markPatchSeen(CURRENT_PATCH.version)` por `saveStore().markPatchSeen(CURRENT_PATCH.version)`.

`src/game/scenes/CharacterSelectScene.ts`:
- troque `import { clearedIndex, loadSave, preferredDifficulty, rememberDifficulty, type SaveData } from '../core/Save';` por:
```ts
import { clearedIndex, preferredDifficulty, type SaveData } from '../core/Save';
import { saveStore } from '../core/save/SaveStore';
```
- troque `this.save = loadSave();` por `this.save = saveStore().current();`;
- troque `rememberDifficulty(this.selected, this.difficulty);` por `saveStore().rememberDifficulty(this.selected, this.difficulty);`.

`src/game/scenes/RunScene.ts`:
- troque `import { recordClear } from '../core/Save';` por `import { saveStore } from '../core/save/SaveStore';`;
- troque `state.firstClear = recordClear(state.dinosaur, state.difficulty);` por:
```ts
      void saveStore().recordClear(state.dinosaur, state.difficulty)
        .then((clear) => { state.firstClear = clear; })
        .catch(() => undefined);
```

`src/game/scenes/LairScene.ts`:
- troque `import { debugGrant, loadSave, purchase, purchaseStatus, shopLevel, type SaveData } from '../core/Save';` por:
```ts
import { purchaseStatus, shopLevel, type SaveData } from '../core/Save';
import { debugGrant } from '../core/save/LocalSaveStore';
import { saveStore } from '../core/save/SaveStore';
```
- adicione o campo `private buying = false;` junto dos outros campos da classe;
- no começo de `create()`, troque `this.save = loadSave();` por:
```ts
    this.buying = false;
    this.save = saveStore().current();
```
- troque `if (DEBUG) {` por `if (DEBUG && saveStore().kind === 'local') {`;
- em `drawItem`, troque o callback do botão `() => this.buy(item, bx, by)` por `() => void this.buy(item, bx, by)`;
- substitua o método `buy` inteiro por:
```ts
  /** One purchase at a time: with an account the shop waits for the API. */
  private async buy(item: ShopItemDef, x: number, y: number): Promise<void> {
    if (this.buying) return;
    this.buying = true;
    let updated: SaveData | null;
    try {
      updated = await saveStore().purchase(this.dino, item);
    } catch {
      this.buying = false;
      if (this.sys.isActive()) this.floatText(x, y - 34, 'Não foi possível comprar agora', COLORS.danger, 14);
      return;
    }
    this.buying = false;
    if (!this.sys.isActive()) return;
    if (!updated) {
      this.floatText(x, y - 34, 'Fósseis insuficientes', COLORS.danger, 14);
      return;
    }
    this.save = updated;
    this.render();
    this.floatText(x, y - 30, `${item.name} ${shopLevel(updated, this.dino, item.id)}!`, COLORS.acidText, 16);
    this.cameras.main.flash(120, 255, 120, 80);
  }

  private floatText(x: number, y: number, message: string, color: string, size: number): void {
    const t = text(this, x, y, message, size, color, true).setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 28, alpha: 0, duration: 950, onComplete: () => t.destroy() });
  }
```

`src/game/scenes/ResultScene.ts`:
- troque `import { recordRun, type RunRewards } from '../core/Save';` por:
```ts
import type { RunRewards } from '../core/Save';
import { saveStore } from '../core/save/SaveStore';
```
- em `create`, apague a linha `const { save, rewards } = recordRun(s, s.victory);` e o comentário acima dela;
- no array `rows`, apague o **último** item (o ternário `s.endless ? ['MELHOR ERA', …] : ['MELHOR TEMPO', …]`), deixando 8 linhas;
- troque o trecho que vai de `rows.forEach(([k, v], i) => {` até `this.drawRewards(s.dinosaur, save.mastery[s.dinosaur] ?? 0, rewards);` (inclusive) por:
```ts
    rows.forEach(([k, v], i) => {
      text(this, 175, 186 + i * 36, k, 16, COLORS.muted, true);
      text(this, 545, 186 + i * 36, v, 18, COLORS.text, true).setOrigin(1, 0);
    });
    // The last row is a record (best time / best era): it comes from the save, filled in once it answers.
    const bestY = 186 + rows.length * 36;
    text(this, 175, bestY, s.endless ? 'MELHOR ERA' : 'MELHOR TEMPO', 16, COLORS.muted, true);
    const bestValue = text(this, 545, bestY, '…', 18, COLORS.text, true).setOrigin(1, 0);

    this.buildRightPanel(s);

    if (s.endless && s.mutations.length) {
      // Below the stat rows, clear of the rewards strip.
      text(this, 175, 494, `MUTAÇÕES DE ERA: ${s.mutations.join(' · ')}`, 13, '#e0a0ff', true).setWordWrapWidth(390);
    }

    const saving = text(this, GAME_WIDTH / 2, 566, 'Salvando…', 16, COLORS.muted, true).setOrigin(0.5);
    // s.victory: the story boss died (a death later in the endless mode still counts as a win).
    saveStore().recordRun(s, s.victory).then(({ save, rewards, pending }) => {
      if (!this.sys.isActive()) return;
      saving.destroy();
      bestValue.setText(s.endless ? `${save.bestEraByDino[s.dinosaur] ?? s.era}` : formatTime(save.bestTime));
      this.drawRewards(s.dinosaur, save.mastery[s.dinosaur] ?? 0, rewards);
      if (pending) {
        text(this, GAME_WIDTH / 2, 150, 'Sem conexão: a run foi guardada e será enviada quando o jogo abrir de novo.', 13, COLORS.danger, true)
          .setOrigin(0.5);
      }
    }).catch(() => {
      if (this.sys.isActive()) saving.setText('Não foi possível salvar esta run.').setColor(COLORS.danger);
    });
```
(O bloco antigo de `this.buildRightPanel(s);` e de `MUTAÇÕES DE ERA` fica dentro desse trecho substituído; confira que nenhum dos dois aparece duas vezes no arquivo.)

- [ ] **Step 8: Verificar**

```bash
cd client && npm run typecheck && npm test && npm run build
```
Expected: sem erros de tipo; os quatro testes com `Tudo certo`; build gerado.

Verificação manual (modo visitante, que precisa estar idêntico ao de antes):
```bash
cd client && npm run dev
```
Abra `http://localhost:5173` e confira:
1. o menu mostra os números de sempre;
2. no Covil, comprar um item debita os Fósseis;
3. ao terminar uma run, a tela de resultado mostra "Salvando…" por um instante e depois as recompensas;
4. depois de recarregar a página, o progresso continua lá.

- [ ] **Step 9: Commit**

```bash
git add client
git commit -m "refactor: save do jogo atrás da interface SaveStore (visitante inalterado)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Cliente HTTP (`src/net/api.ts`)

**Files:**
- Create: `src/net/api.ts`, `tools/net/api-test.ts`
- Modify: `package.json` (scripts `test:net` e `test`)

**Interfaces:**
- Consumes: nada do jogo.
- Produces:
  - `class ApiError extends Error { status; code; get offline(): boolean }`.
  - `api<T>(path, { method?, body?, keepalive?, auth? }): Promise<T>`. O `path` é relativo a `/api`, por exemplo `'/runs'`.
  - `refreshSession(): Promise<'ok' | 'expired' | 'offline'>`, `setAccessToken(token | null)`, `onSessionLost(fn)` e `setFetch(impl)` (este último para testes).

- [ ] **Step 1: Escrever o teste**

`tools/net/api-test.ts`:
```ts
/**
 * Teste do cliente HTTP com um fetch falso: Bearer, renovação automática em 401 (uma única
 * renovação para pedidos simultâneos), erros ProblemDetail e servidor fora do ar.
 *
 * Uso: npm run test:net
 */
import { ApiError, api, onSessionLost, refreshSession, setAccessToken, setFetch } from '../../src/net/api.ts';

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

console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo');
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Scripts**

Em `package.json`, adicione o script:
```json
    "test:net": "node --experimental-transform-types --no-warnings --import ./tools/balance/loader/register.mjs tools/net/api-test.ts",
```
e troque `"test"` por:
```json
    "test": "npm run test:boss && npm run test:endless && npm run test:save && npm run test:economy && npm run test:net"
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
cd client && npm run test:net
```
Expected: erro ao importar `src/net/api.ts` (arquivo não existe).

- [ ] **Step 4: Implementar**

`src/net/api.ts`:
```ts
/**
 * HTTP client for the DinoMutation API. Calls are same-origin (`/api/...`): Vite's proxy in
 * development and a Vercel rewrite in production forward them, so the refresh-token cookie
 * stays first-party and no CORS is involved. The access token lives only in memory.
 */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }

  /** The server couldn't be reached at all (network down, API asleep…). */
  get offline(): boolean {
    return this.status === 0;
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  /** Lets the request finish even if the page is closed (used when the boss falls). */
  keepalive?: boolean;
  /** false: no Authorization header and no refresh on 401 (the auth endpoints). */
  auth?: boolean;
}

export type RefreshResult = 'ok' | 'expired' | 'offline';

let fetchImpl: typeof fetch = (input, init) => fetch(input, init);
let accessToken: string | null = null;
let refreshing: Promise<RefreshResult> | null = null;
let sessionLost: () => void = () => {};

/** Test hook: replaces the global fetch. */
export function setFetch(impl: typeof fetch): void {
  fetchImpl = impl;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Called when the session can't be renewed any more (refresh token expired or revoked). */
export function onSessionLost(fn: () => void): void {
  sessionLost = fn;
}

export async function api<T = unknown>(path: string, o: ApiOptions = {}): Promise<T> {
  const useAuth = o.auth !== false;
  let res = await send(path, o, useAuth);
  if (res.status === 401 && useAuth) {
    const refreshed = await refreshSession();
    if (refreshed === 'ok') res = await send(path, o, useAuth);
    else if (refreshed === 'offline') throw new ApiError(0, 'NETWORK', 'Servidor indisponível.');
    else sessionLost();
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Trades the refresh-token cookie for a new access token; concurrent callers share one request. */
export function refreshSession(): Promise<RefreshResult> {
  refreshing ??= (async (): Promise<RefreshResult> => {
    try {
      const res = await fetchImpl('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
      if (res.status >= 500) return 'offline';
      if (!res.ok) {
        accessToken = null;
        return 'expired';
      }
      accessToken = ((await res.json()) as { accessToken: string }).accessToken;
      return 'ok';
    } catch {
      return 'offline';
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function send(path: string, o: ApiOptions, useAuth: boolean): Promise<Response> {
  const headers: Record<string, string> = {};
  if (o.body !== undefined) headers['Content-Type'] = 'application/json';
  if (useAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetchImpl(`/api${path}`, {
      method: o.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      keepalive: o.keepalive,
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Servidor indisponível.');
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: { code?: string; detail?: string; title?: string } = {};
  try {
    body = await res.json();
  } catch {
    // not JSON (e.g. the bare 401 of the resource server)
  }
  return new ApiError(res.status, body.code ?? `HTTP_${res.status}`, body.detail ?? body.title ?? `Erro ${res.status}`);
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
cd client && npm run test:net && npm run typecheck
```
Expected: `Tudo certo`; typecheck sem erros.

- [ ] **Step 6: Commit**

```bash
git add client
git commit -m "feat: cliente HTTP com renovação automática do token

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: `CloudSaveStore` e fila de runs pendentes

**Files:**
- Create: `src/game/core/save/apiTypes.ts`, `src/game/core/save/pendingRuns.ts`, `src/game/core/save/CloudSaveStore.ts`, `tools/net/cloud-test.ts`
- Modify: `package.json` (`test:net` roda também o novo teste)

**Interfaces:**
- Consumes: `api`, `ApiError` (Task 14); `SaveStore`, `emptySave`, `applyRun`, `applyClear`, `unlocksBetween` (Task 13); `DIFFICULTY_BY_ID`.
- Produces:
  - Os DTOs em `apiTypes.ts`: `SaveDto`, `RunRequest`, `RunRewardsDto`, `RunResponse`, `ClearResponse`, `PurchaseResponse`, `TokenResponse` e `Account`.
  - `CloudSaveStore`, com `static open(): Promise<CloudSaveStore>`, `static from(dto: SaveDto)` e `readonly account: Account`.
  - `toSaveData(dto)`.
  - Em `pendingRuns.ts`: `pendingRuns()`, `enqueuePendingRun(email, run)` e `flushPendingRuns(email): Promise<boolean>`.

- [ ] **Step 1: Escrever o teste**

`tools/net/cloud-test.ts`:
```ts
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
    server.save = { ...server.save, runs: server.save.runs + 1, fossils: server.save.fossils + 111, mastery: { trex: 143 } };
    return json(201, { rewards: { fossils: 111, firstWinBonus: 0, masteryXp: 143, levelBefore: 1, levelAfter: 2 }, save: server.save });
  }
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
  const { rewards, pending } = await cloud.recordRun(finishedRun(), false);
  check(pending === true, 'marcada como pendente');
  check(rewards.fossils === 111, 'prévia calculada localmente');
  check(pendingRuns().length === 1 && pendingRuns()[0].email === 'pedro@example.com', 'guardada na fila com a conta');
  check(cloud.current().fossils === 111, 'o save da conta não muda com a prévia');
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
```

Em `package.json`, troque o script `test:net` por:
```json
    "test:net": "node --experimental-transform-types --no-warnings --import ./tools/balance/loader/register.mjs tools/net/api-test.ts && node --experimental-transform-types --no-warnings --import ./tools/balance/loader/register.mjs tools/net/cloud-test.ts",
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd client && npm run test:net
```
Expected: `api-test` passa; `cloud-test` falha ao importar `CloudSaveStore.ts`.

- [ ] **Step 3: DTOs**

`src/game/core/save/apiTypes.ts`:
```ts
import type { DifficultyId } from '../../../data/difficulty';
import type { DinoId } from '../../../data/dinosaurs';
import type { RunUpgradeRecord } from '../RunState';
import type { SaveData } from '../Save';

/** Shapes of the API (server/src/main/java/com/dinomutation/...). */
export interface Account {
  email: string;
  displayName: string;
}

/** GET /api/players/me/save: SaveData (maps may be missing) plus the account. */
export type SaveDto = Partial<SaveData> & Account;

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface RunRequest {
  id: string;
  dino: DinoId;
  difficulty: DifficultyId;
  victory: boolean;
  elapsedTime: number;
  kills: number;
  level: number;
  eliteKilled: boolean;
  bossKilled: boolean;
  endless: boolean;
  era: number;
  endlessTime: number;
  damageDealt: number;
  damageTaken: number;
  upgrades: RunUpgradeRecord[];
}

export interface RunRewardsDto {
  fossils: number;
  firstWinBonus: number;
  /** Difficulty id ("normal"), not its display name. */
  unlockedDifficulty?: DifficultyId;
  masteryXp: number;
  levelBefore: number;
  levelAfter: number;
}

export interface RunResponse {
  rewards: RunRewardsDto;
  save: SaveDto;
}

export interface ClearResponse {
  firstWinBonus: number;
  unlockedDifficulty?: DifficultyId;
}

export interface PurchaseResponse {
  save: SaveDto;
}
```

- [ ] **Step 4: Fila de runs pendentes**

`src/game/core/save/pendingRuns.ts`:
```ts
import { ApiError, api } from '../../../net/api';
import type { RunRequest } from './apiTypes';

const KEY = 'dino-pending-runs';

/** A run the API didn't receive, tagged with the account that played it. */
export interface PendingRun {
  email: string;
  run: RunRequest;
}

export function pendingRuns(): PendingRun[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as PendingRun[];
  } catch {
    return [];
  }
}

function write(list: PendingRun[]): void {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable — nothing to keep
  }
}

export function enqueuePendingRun(email: string, run: RunRequest): void {
  write([...pendingRuns().filter((p) => p.run.id !== run.id), { email, run }]);
}

/**
 * Sends the account's queued runs in order (the run id makes a resend harmless). Stops at the
 * first network/5xx failure; drops runs the API rejects (4xx). Returns true if any was accepted.
 */
export async function flushPendingRuns(email: string): Promise<boolean> {
  let sent = false;
  for (const p of pendingRuns().filter((x) => x.email === email)) {
    try {
      await api('/runs', { method: 'POST', body: p.run });
      sent = true;
    } catch (e) {
      if (!(e instanceof ApiError) || e.offline || e.status >= 500 || e.status === 401) return sent;
      console.warn('Run pendente recusada pela API; descartada.', e);
    }
    write(pendingRuns().filter((x) => x.run.id !== p.run.id));
  }
  return sent;
}
```

- [ ] **Step 5: `CloudSaveStore`**

`src/game/core/save/CloudSaveStore.ts`:
```ts
import { DIFFICULTY_BY_ID, type DifficultyId } from '../../../data/difficulty';
import type { DinoId } from '../../../data/dinosaurs';
import type { ShopItemDef } from '../../../data/meta';
import { ApiError, api } from '../../../net/api';
import type { FirstClear, RunState } from '../RunState';
import {
  applyClear, applyRun, emptySave, unlocksBetween, type RunRecordResult, type RunRewards, type SaveData,
} from '../Save';
import type {
  Account, ClearResponse, PurchaseResponse, RunRequest, RunResponse, RunRewardsDto, SaveDto,
} from './apiTypes';
import { enqueuePendingRun, flushPendingRuns } from './pendingRuns';
import type { SaveStore } from './SaveStore';

/** API caps (RunRequest on the server). */
const MAX_ELAPSED = 14400;
const MAX_UPGRADES = 100;

/**
 * Signed-in progress: the API is the source of truth. The save is held in memory for the
 * scenes and replaced by the server's copy after every command.
 */
export class CloudSaveStore implements SaveStore {
  readonly kind = 'cloud';

  private constructor(private save: SaveData, readonly account: Account) {}

  /** Loads the account, first sending runs a failed save left in the queue. */
  static async open(): Promise<CloudSaveStore> {
    let dto = await api<SaveDto>('/players/me/save');
    if (await flushPendingRuns(dto.email)) dto = await api<SaveDto>('/players/me/save');
    return CloudSaveStore.from(dto);
  }

  static from(dto: SaveDto): CloudSaveStore {
    return new CloudSaveStore(toSaveData(dto), { email: dto.email, displayName: dto.displayName });
  }

  current(): SaveData {
    return this.save;
  }

  async recordRun(state: RunState, victory: boolean): Promise<RunRecordResult> {
    const req = toRunRequest(state, victory);
    try {
      const res = await api<RunResponse>('/runs', { method: 'POST', body: req });
      this.save = toSaveData(res.save);
      return { save: this.save, rewards: toRewards(state.dinosaur, res.rewards) };
    } catch (e) {
      if (!isRetryable(e)) throw e;
      enqueuePendingRun(this.account.email, req);
      // Preview only: the server stays the source of truth and pays when the queue is sent.
      const preview = structuredClone(this.save);
      return { save: preview, rewards: applyRun(preview, state, victory), pending: true };
    }
  }

  async recordClear(dino: DinoId, difficulty: DifficultyId): Promise<FirstClear | undefined> {
    try {
      const res = await api<ClearResponse>('/clears', { method: 'POST', body: { dino, difficulty }, keepalive: true });
      if (!res.firstWinBonus) return undefined;
      applyClear(this.save, dino, difficulty);
      return {
        firstWinBonus: res.firstWinBonus,
        unlockedDifficulty: res.unlockedDifficulty && DIFFICULTY_BY_ID[res.unlockedDifficulty].name,
      };
    } catch {
      // POST /api/runs applies the clear too, so a lost request costs nothing.
      return undefined;
    }
  }

  async purchase(dino: DinoId, item: ShopItemDef): Promise<SaveData | null> {
    try {
      const res = await api<PurchaseResponse>('/shop/purchases', { method: 'POST', body: { dino, itemId: item.id } });
      this.save = toSaveData(res.save);
      return this.save;
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'INSUFFICIENT_FOSSILS' || e.code === 'ITEM_MAXED')) return null;
      throw e;
    }
  }

  rememberDifficulty(dino: DinoId, id: DifficultyId): void {
    this.save.difficulty[dino] = id;
    this.patch({ difficulty: { dino, id } });
  }

  markPatchSeen(version: string): void {
    this.save.seenPatch = version;
    this.patch({ seenPatch: version });
  }

  private patch(body: object): void {
    api('/players/me/preferences', { method: 'PATCH', body }).catch((e) => console.warn('Preferência não salva.', e));
  }
}

/** The API's save without the account fields, with every missing map filled in. */
export function toSaveData(dto: SaveDto): SaveData {
  const { email: _email, displayName: _name, ...save } = dto;
  return { ...emptySave(), ...save };
}

function toRunRequest(state: RunState, victory: boolean): RunRequest {
  return {
    id: state.id,
    dino: state.dinosaur,
    difficulty: state.difficulty,
    victory,
    elapsedTime: Math.min(state.elapsedTime, MAX_ELAPSED),
    kills: state.kills,
    level: state.level,
    eliteKilled: state.eliteKilled,
    bossKilled: state.bossKilled,
    endless: state.endless,
    era: state.era,
    endlessTime: Math.min(state.endlessTime, MAX_ELAPSED),
    damageDealt: state.damageDealt,
    damageTaken: state.damageTaken,
    upgrades: state.upgrades.slice(0, MAX_UPGRADES),
  };
}

function toRewards(dino: DinoId, r: RunRewardsDto): RunRewards {
  return {
    fossils: r.fossils,
    firstWinBonus: r.firstWinBonus,
    unlockedDifficulty: r.unlockedDifficulty && DIFFICULTY_BY_ID[r.unlockedDifficulty].name,
    masteryXp: r.masteryXp,
    levelBefore: r.levelBefore,
    levelAfter: r.levelAfter,
    unlocks: unlocksBetween(dino, r.levelBefore, r.levelAfter),
  };
}

/** Network down or a server error: worth queueing. A 4xx means the API refused this run. */
function isRetryable(e: unknown): boolean {
  return e instanceof ApiError && (e.offline || e.status >= 500);
}
```

- [ ] **Step 6: Rodar e ver passar**

```bash
cd client && npm run test:net && npm run typecheck && npm test
```
Expected: os dois testes de rede com `Tudo certo`; typecheck limpo; `npm test` inteiro verde.

- [ ] **Step 7: Commit**

```bash
git add client
git commit -m "feat: CloudSaveStore com fila de runs pendentes e prévia offline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Sessão, abertura do jogo e proxy de desenvolvimento

**Files:**
- Create: `src/net/env.ts`, `src/game/core/save/session.ts`, `.env.example`, `tools/net/session-test.ts`
- Modify: `src/vite-env.d.ts`, `vite.config.ts` (proxy), `src/game/scenes/BootScene.ts`, `package.json` (`test:net`), `../.gitignore`

**Interfaces:**
- Consumes: `api`, `refreshSession`, `setAccessToken`, `onSessionLost`, `ApiError` (Task 14); `CloudSaveStore`, `toSaveData`, DTOs (Task 15); `LocalSaveStore`, `saveStore`, `setSaveStore` (Task 13).
- Produces:
  - `API_ENABLED: boolean` e `GOOGLE_CLIENT_ID: string`.
  - `resumeSession(enabled?): Promise<'cloud' | 'guest' | 'offline'>`.
  - `signIn.password(email, password)`, `signIn.register(email, password, name)` e `signIn.google(idToken)`, todos resolvendo com `SignInResult { account, canImport }`.
  - `importGuestSave()`, `signOut()`, `currentAccount(): Account | null` e `hasLoginFlag()`.

- [ ] **Step 1: Escrever o teste**

`tools/net/session-test.ts`:
```ts
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
```

Em `package.json`, acrescente ao fim do script `test:net`:
```
 && node --experimental-transform-types --no-warnings --import ./tools/balance/loader/register.mjs tools/net/session-test.ts
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd client && npm run test:net
```
Expected: `api-test` e `cloud-test` passam; `session-test` falha ao importar `session.ts`.

- [ ] **Step 3: Flags de build**

Troque `src/vite-env.d.ts` por:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" turns on accounts and the cloud save (needs the API, see the README). */
  readonly VITE_API_ENABLED?: string;
  /** OAuth client id (type "Web") from the Google Cloud Console. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
```

`src/net/env.ts`:
```ts
/** Build-time switches (client/.env*). Node test scripts have no import.meta.env, hence the fallback. */
const env: Partial<ImportMetaEnv> = import.meta.env ?? {};

export const API_ENABLED = env.VITE_API_ENABLED === 'true';
export const GOOGLE_CLIENT_ID = env.VITE_GOOGLE_CLIENT_ID ?? '';
```

`.env.example` (em `client/`):
```
# Copie para .env.local e ajuste. Liga o login e o save na nuvem (precisa da API rodando: veja o README).
VITE_API_ENABLED=false
# OAuth Client ID (tipo "Aplicativo da Web") do Google Cloud Console. Vazio = sem botão do Google.
VITE_GOOGLE_CLIENT_ID=
```

No `.gitignore` da raiz, adicione a linha `*.local` (o Vite usa `.env.local` para valores que não vão para o git).

- [ ] **Step 4: `session.ts`**

`src/game/core/save/session.ts`:
```ts
import { ApiError, api, onSessionLost, refreshSession, setAccessToken } from '../../../net/api';
import { API_ENABLED } from '../../../net/env';
import type { Account, SaveDto, TokenResponse } from './apiTypes';
import { CloudSaveStore } from './CloudSaveStore';
import { LocalSaveStore } from './LocalSaveStore';
import { saveStore, setSaveStore } from './SaveStore';

/** The refresh cookie is httpOnly, so this flag is how the game knows a session may exist. */
const FLAG = 'dino-logged-in';

export type ResumeResult = 'cloud' | 'guest' | 'offline';

export interface SignInResult {
  account: Account;
  /** The browser has guest progress and the account has none: offer to import it. */
  canImport: boolean;
}

/** On boot: picks up the session of the last visit, if there was one. */
export async function resumeSession(enabled = API_ENABLED): Promise<ResumeResult> {
  if (!enabled || !hasLoginFlag()) return 'guest';
  const refreshed = await refreshSession();
  if (refreshed === 'expired') {
    endLocalSession();
    return 'guest';
  }
  if (refreshed === 'offline') return 'offline';
  try {
    setSaveStore(await CloudSaveStore.open());
    return 'cloud';
  } catch (e) {
    if (e instanceof ApiError && (e.offline || e.status >= 500)) return 'offline';
    endLocalSession();
    return 'guest';
  }
}

export const signIn = {
  password: (email: string, password: string) =>
    start(api<TokenResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false })),
  register: (email: string, password: string, displayName: string) =>
    start(api<TokenResponse>('/auth/register', { method: 'POST', body: { email, password, displayName }, auth: false })),
  google: (idToken: string) =>
    start(api<TokenResponse>('/auth/google', { method: 'POST', body: { idToken }, auth: false })),
};

async function start(tokens: Promise<TokenResponse>): Promise<SignInResult> {
  setAccessToken((await tokens).accessToken);
  try {
    setLoginFlag();
    const guest = new LocalSaveStore().current();
    const cloud = await CloudSaveStore.open();
    setSaveStore(cloud);
    return { account: cloud.account, canImport: guest.runs > 0 && cloud.current().runs === 0 };
  } catch (e) {
    endLocalSession();
    throw e;
  }
}

/** Copies the guest save into the (empty) account. ALREADY_IMPORTED means the cloud wins. */
export async function importGuestSave(): Promise<void> {
  try {
    const dto = await api<SaveDto>('/players/me/import', { method: 'POST', body: { save: new LocalSaveStore().current() } });
    setSaveStore(CloudSaveStore.from(dto));
  } catch (e) {
    if (!(e instanceof ApiError && e.code === 'ALREADY_IMPORTED')) throw e;
  }
}

export async function signOut(): Promise<void> {
  await api('/auth/logout', { method: 'POST', auth: false }).catch(() => undefined);
  endLocalSession();
}

export function currentAccount(): Account | null {
  const s = saveStore();
  return s instanceof CloudSaveStore ? s.account : null;
}

export function hasLoginFlag(): boolean {
  try {
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

function setLoginFlag(): void {
  try {
    localStorage.setItem(FLAG, '1');
  } catch {
    // storage unavailable: the session just won't be resumed next time
  }
}

/** Forgets the session here; the browser's guest save is never touched. */
function endLocalSession(): void {
  setAccessToken(null);
  try {
    localStorage.removeItem(FLAG);
  } catch {
    // ignore
  }
  setSaveStore(new LocalSaveStore());
}

// The API gave up on the session mid-game (refresh token revoked or expired): back to guest.
onSessionLost(() => {
  console.warn('Sessão expirada; voltando ao modo visitante.');
  endLocalSession();
});
```

- [ ] **Step 5: Proxy do Vite e tela de conexão no `BootScene`**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
  },
  server: {
    // shared/economy.json lives outside client/.
    fs: { allow: ['..'] },
    // Same-origin API in development (production: Vercel rewrite, see the README).
    proxy: { '/api': 'http://localhost:8080' },
  },
});
```

Troque `src/game/scenes/BootScene.ts` por:
```ts
import Phaser from 'phaser';
import { API_ENABLED } from '../../net/env';
import { generateTextures, loadSprites } from '../art/Textures';
import { LocalSaveStore } from '../core/save/LocalSaveStore';
import { setSaveStore } from '../core/save/SaveStore';
import { hasLoginFlag, resumeSession } from '../core/save/session';
import { COLORS, button, text } from '../ui/theme';

/** Free hosting puts the API to sleep; waking it can take a while. */
const GUEST_OFFER_MS = 8000;
const RETRY_MS = 3000;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    loadSprites(this);
  }

  create(): void {
    generateTextures(this);
    if (API_ENABLED && hasLoginFlag()) this.connect();
    else this.scene.start('Menu');
  }

  /** Signed-in players wait for the API; after a few seconds they may go on as guests. */
  private connect(): void {
    const { width, height } = this.scale;
    const status = text(this, width / 2, height / 2, 'Conectando…', 22, COLORS.muted, true).setOrigin(0.5);
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      this.scene.start('Menu');
    };
    this.time.delayedCall(GUEST_OFFER_MS, () => {
      if (done) return;
      status.setText('O servidor está demorando para responder…');
      // The session is kept: next visit tries again.
      button(this, width / 2, height / 2 + 70, 'JOGAR COMO VISITANTE', go, { width: 340, height: 54, fontSize: 18, ghost: true });
    });
    const attempt = async (): Promise<void> => {
      const result = await resumeSession();
      if (done) {
        // The player already chose to go on as a guest: don't swap the save mid-game.
        if (result === 'cloud') setSaveStore(new LocalSaveStore());
        return;
      }
      if (result === 'offline') {
        this.time.delayedCall(RETRY_MS, () => void attempt());
        return;
      }
      go();
    };
    void attempt();
  }
}
```

- [ ] **Step 6: Rodar e ver passar**

```bash
cd client && npm run test:net && npm run typecheck && npm run build
```
Expected: os três testes de rede com `Tudo certo`; typecheck limpo; build ok.

- [ ] **Step 7: Commit**

```bash
git add client .gitignore
git commit -m "feat: sessão retomada ao abrir o jogo, proxy /api e flags de build

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Modal de login (e-mail/senha e Google) e conta no menu

**Files:**
- Create: `src/ui-dom/google.ts`, `src/ui-dom/AuthModal.ts`
- Modify: `src/game/scenes/MenuScene.ts`

**Interfaces:**
- Consumes: `signIn`, `importGuestSave`, `signOut`, `currentAccount` (Task 16); `API_ENABLED`, `GOOGLE_CLIENT_ID` (Task 16); `ApiError` (Task 14); `COLORS`, `FONT`, `hex`, `button` (`ui/theme.ts`).
- Produces: `new AuthModal(onDone, onClose)` e o botão de conta no menu.

- [ ] **Step 1: Google Identity Services sob demanda**

`src/ui-dom/google.ts`:
```ts
/** Google Identity Services, loaded on demand (only when the sign-in dialog opens). */
export interface GoogleId {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let loading: Promise<GoogleId> | null = null;

export function loadGoogleIdentity(): Promise<GoogleId> {
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google.accounts.id) : reject(new Error('GIS indisponível')));
    script.onerror = () => {
      loading = null;
      reject(new Error('Não foi possível carregar o login do Google'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
```

- [ ] **Step 2: O modal**

`src/ui-dom/AuthModal.ts`:
```ts
import { importGuestSave, signIn, type SignInResult } from '../game/core/save/session';
import { COLORS, FONT, hex } from '../game/ui/theme';
import { ApiError } from '../net/api';
import { GOOGLE_CLIENT_ID } from '../net/env';
import { loadGoogleIdentity } from './google';

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
  EMAIL_TAKEN: 'Já existe uma conta com este e-mail.',
  VALIDATION_ERROR: 'Confira os campos: e-mail válido, senha de 8 a 72 caracteres e nome de 2 a 40.',
  CONFLICT: 'Este e-mail já está ligado a outra conta Google.',
  NETWORK: 'Servidor indisponível. Tente de novo em instantes.',
};

/**
 * Sign-in / sign-up dialog in HTML over the canvas (Phaser has no text inputs). `onDone`
 * runs after a successful sign-in (and the optional import); `onClose` when dismissed.
 */
export class AuthModal {
  private readonly root: HTMLDivElement;
  private mode: 'login' | 'register' = 'login';
  private busy = false;

  constructor(private readonly onDone: () => void, private readonly onClose: () => void) {
    injectStyles();
    this.root = document.createElement('div');
    this.root.className = 'dm-auth';
    // Keys typed here must not reach Phaser's window listeners (SPACE/ENTER start the game).
    for (const type of ['keydown', 'keyup'] as const) {
      this.root.addEventListener(type, (e) => {
        if (type === 'keydown' && e.key === 'Escape') this.close();
        e.stopPropagation();
      });
    }
    document.body.appendChild(this.root);
    this.renderForm();
  }

  close(): void {
    if (this.busy) return;
    this.root.remove();
    this.onClose();
  }

  private renderForm(): void {
    const register = this.mode === 'register';
    this.root.innerHTML = `
      <form class="dm-auth__panel" novalidate>
        <button type="button" class="dm-auth__close" aria-label="Fechar">×</button>
        <div class="dm-auth__tabs">
          <button type="button" data-mode="login" class="${register ? '' : 'is-active'}">ENTRAR</button>
          <button type="button" data-mode="register" class="${register ? 'is-active' : ''}">CRIAR CONTA</button>
        </div>
        ${register ? '<label>Nome<input name="displayName" autocomplete="nickname" maxlength="40" required></label>' : ''}
        <label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
        <label>Senha<input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="8" maxlength="72" required></label>
        <p class="dm-auth__error" role="alert"></p>
        <button type="submit" class="dm-auth__submit">${register ? 'CRIAR CONTA' : 'ENTRAR'}</button>
        <div class="dm-auth__google"></div>
        <p class="dm-auth__note">Sem conta, o progresso fica só neste navegador.</p>
      </form>`;
    const form = this.root.querySelector('form')!;
    form.querySelector('.dm-auth__close')!.addEventListener('click', () => this.close());
    form.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        this.mode = b.dataset.mode as 'login' | 'register';
        this.renderForm();
      }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const email = String(data.get('email') ?? '').trim();
      const password = String(data.get('password') ?? '');
      const name = String(data.get('displayName') ?? '').trim();
      void this.run(() => (this.mode === 'register' ? signIn.register(email, password, name) : signIn.password(email, password)));
    });
    this.mountGoogle(form.querySelector<HTMLElement>('.dm-auth__google')!);
    form.querySelector<HTMLInputElement>('input')?.focus();
  }

  private mountGoogle(el: HTMLElement): void {
    if (!GOOGLE_CLIENT_ID) return;
    loadGoogleIdentity()
      .then((gis) => {
        if (!el.isConnected) return;
        gis.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => void this.run(() => signIn.google(r.credential)) });
        gis.renderButton(el, { theme: 'filled_black', size: 'large', text: 'signin_with', locale: 'pt-BR', width: 300 });
      })
      .catch(() => {
        el.textContent = 'Login com Google indisponível agora.';
      });
  }

  /** Runs a sign-in call with the dialog locked; on success offers the import or finishes. */
  private async run(action: () => Promise<SignInResult>): Promise<void> {
    if (this.busy) return;
    this.setBusy(true);
    this.setError('');
    try {
      const result = await action();
      this.setBusy(false);
      if (result.canImport) this.renderImport();
      else this.finish();
    } catch (e) {
      this.setBusy(false);
      this.setError(e instanceof ApiError ? MESSAGES[e.code] ?? e.message : 'Algo deu errado. Tente de novo.');
    }
  }

  private renderImport(): void {
    this.root.innerHTML = `
      <div class="dm-auth__panel">
        <h2>Importar progresso?</h2>
        <p>Este navegador tem progresso de visitante e a sua conta está vazia. Quer levar esse progresso para a conta?</p>
        <p class="dm-auth__error" role="alert"></p>
        <button type="button" class="dm-auth__submit" data-import="yes">IMPORTAR</button>
        <button type="button" class="dm-auth__ghost" data-import="no">COMEÇAR DO ZERO</button>
      </div>`;
    this.root.querySelector('[data-import="no"]')!.addEventListener('click', () => this.finish());
    this.root.querySelector('[data-import="yes"]')!.addEventListener('click', async () => {
      if (this.busy) return;
      this.setBusy(true);
      try {
        await importGuestSave();
        this.setBusy(false);
        this.finish();
      } catch {
        this.setBusy(false);
        this.setError('Não foi possível importar agora. A conta continua conectada.');
      }
    });
  }

  private setBusy(on: boolean): void {
    this.busy = on;
    this.root.classList.toggle('is-busy', on);
  }

  private setError(message: string): void {
    const p = this.root.querySelector('.dm-auth__error');
    if (p) p.textContent = message;
  }

  private finish(): void {
    this.root.remove();
    this.onDone();
  }
}

let styled = false;

/** Styles derived from the game's theme (ui/theme.ts), injected once. */
function injectStyles(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = `
    .dm-auth { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
      background: rgba(15, 10, 9, 0.78); font-family: ${FONT}; user-select: text; -webkit-user-select: text; touch-action: auto; }
    .dm-auth.is-busy { cursor: progress; }
    .dm-auth.is-busy .dm-auth__panel { opacity: 0.7; pointer-events: none; }
    .dm-auth__panel { position: relative; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box;
      width: min(360px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; padding: 28px 24px 20px;
      background: ${hex(COLORS.panel)}; border: 1px solid ${hex(COLORS.border)}; color: ${COLORS.text}; }
    .dm-auth__panel h2 { margin: 0; font-size: 22px; }
    .dm-auth__panel p { margin: 0; color: ${COLORS.muted}; font-size: 14px; line-height: 1.4; }
    .dm-auth__tabs { display: flex; gap: 8px; }
    .dm-auth__tabs button { flex: 1; padding: 8px; background: none; border: 1px solid ${hex(COLORS.border)};
      color: ${COLORS.muted}; font: 700 14px ${FONT}; letter-spacing: 1px; cursor: pointer; }
    .dm-auth__tabs button.is-active { border-color: ${hex(COLORS.accent)}; color: ${COLORS.accentText}; }
    .dm-auth label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: ${COLORS.muted}; }
    .dm-auth input { padding: 10px; background: ${hex(COLORS.bg)}; border: 1px solid ${hex(COLORS.border)};
      color: ${COLORS.text}; font: 500 16px ${FONT}; }
    .dm-auth input:focus { outline: 2px solid ${hex(COLORS.accent)}; outline-offset: -1px; }
    .dm-auth__submit, .dm-auth__ghost { padding: 12px; font: 700 16px ${FONT}; letter-spacing: 1px; cursor: pointer; }
    .dm-auth__submit { background: ${hex(COLORS.accent)}; color: ${hex(COLORS.panel)}; border: none; }
    .dm-auth__ghost { background: none; border: 1px solid ${hex(COLORS.border)}; color: ${COLORS.text}; }
    .dm-auth .dm-auth__error { color: ${COLORS.danger}; min-height: 1em; }
    .dm-auth__google { display: flex; justify-content: center; }
    .dm-auth__close { position: absolute; top: 6px; right: 10px; background: none; border: none;
      color: ${COLORS.muted}; font-size: 26px; cursor: pointer; }
  `;
  document.head.appendChild(style);
}
```

- [ ] **Step 3: Botão de conta no menu**

Em `src/game/scenes/MenuScene.ts`:
1. Adicione os imports:
```ts
import { API_ENABLED } from '../../net/env';
import { AuthModal } from '../../ui-dom/AuthModal';
import { currentAccount, signOut } from '../core/save/session';
```
2. Adicione o campo `private modal: AuthModal | null = null;` junto dos outros campos.
3. No começo de `create()`, junto de `this.leaving = false;`, adicione `this.modal = null;`.
4. Logo depois da linha que desenha `${save.fossils} FÓSSEIS`, adicione:
```ts
    if (API_ENABLED) this.accountButton();
```
5. Em `go()`, troque a condição inicial por:
```ts
    if (this.leaving || this.modal || this.notes?.isOpen || this.time.now - this.notesClosedAt < 250) return;
```
6. Adicione os métodos à classe:
```ts
  /** "Entrar / criar conta" for guests; the account name and "sair" when signed in. */
  private accountButton(): void {
    const account = currentAccount();
    const name = account ? account.displayName.toUpperCase().slice(0, 18) : '';
    const label = account ? `${name} · SAIR` : 'ENTRAR / CRIAR CONTA';
    button(this, GAME_WIDTH / 2, 604, label, () => (account ? void this.leaveAccount() : this.openAuth()), {
      width: 300, height: 40, fontSize: 14, ghost: true,
    }).setDepth(1);
  }

  private openAuth(): void {
    if (this.modal || this.leaving) return;
    this.setInputEnabled(false);
    this.modal = new AuthModal(
      () => {
        this.modal = null;
        this.setInputEnabled(true);
        this.scene.restart();
      },
      () => {
        this.modal = null;
        this.setInputEnabled(true);
      },
    );
  }

  private async leaveAccount(): Promise<void> {
    await signOut();
    this.scene.restart();
  }

  /** The HTML dialog takes over input while open (the scene's input plugin outlives restarts). */
  private setInputEnabled(on: boolean): void {
    this.input.enabled = on;
    if (this.input.keyboard) this.input.keyboard.enabled = on;
  }
```

- [ ] **Step 4: Verificar tipos e build**

```bash
cd client && npm run typecheck && npm test && npm run build
```
Expected: tudo verde.

- [ ] **Step 5: Roteiro manual de ponta a ponta**

Pré-requisitos: Postgres e API rodando (`docker compose up -d` e, em `server/`, `GOOGLE_CLIENT_ID=<seu id> ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`), e `client/.env.local` com:
```
VITE_API_ENABLED=true
VITE_GOOGLE_CLIENT_ID=<seu id>
```
Depois `cd client && npm run dev` e abra `http://localhost:5173`.

Confira, nesta ordem:
1. Como visitante, jogue uma run e compre algo no Covil (gera progresso local).
2. Clique em **ENTRAR / CRIAR CONTA**, crie uma conta e aceite **IMPORTAR**. O menu mostra o seu nome e os mesmos Fósseis.
3. Compre um item. Recarregue a página: a tela "Conectando…" aparece rapidamente e o progresso continua.
4. Abra uma janela anônima, entre com o mesmo e-mail e senha: o progresso é o mesmo.
5. Termine uma run e confira as recompensas na tela de resultado.
6. Pare a API (Ctrl+C), termine outra run: aparece "Sem conexão: a run foi guardada…". Suba a API de novo e recarregue: a run entra (os Fósseis sobem).
7. **SAIR**: o menu volta aos números do visitante.
8. Se tiver o Client ID: entre com o Google usando o **mesmo e-mail** da conta criada no passo 2. Ela vira a mesma conta, e o login com senha desse e-mail passa a ser recusado.
9. Com `VITE_API_ENABLED=false` (ou sem `.env.local`), o botão de conta some e o jogo é exatamente o de antes.

Anote qualquer divergência e corrija antes do commit.

- [ ] **Step 6: Commit**

```bash
git add client
git commit -m "feat: login por e-mail/senha e Google no menu, com importação do save

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Parte D: entrega

### Task 18: CI, README e verificação final

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- Consumes: os comandos `./mvnw verify`, `npm run typecheck`, `npm test` e `npm run build`.
- Produces: CI verde no GitHub e um README que explica o projeto.

- [ ] **Step 1: Workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on: [push, pull_request]

jobs:
  server:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: server
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'
          cache: maven
      # Testcontainers uses the Docker daemon that ubuntu-latest already runs.
      - run: ./mvnw -B verify

  client:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: client
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: npm
          cache-dependency-path: client/package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: README**

Pergunte ao dono do projeto qual é a URL do jogo na Vercel e use-a na linha "Jogar". Crie `README.md` na raiz:

````markdown
# DinoMutation

[![CI](https://github.com/PedroAlmeidaSDev/dinomutation/actions/workflows/ci.yml/badge.svg)](https://github.com/PedroAlmeidaSDev/dinomutation/actions/workflows/ci.yml)

Roguelite de mutações jurássicas para navegador, com uma API em **Java/Spring Boot** para contas, save na nuvem e economia validada no servidor.

**Jogar:** <URL da Vercel informada pelo dono do projeto>

## O que tem aqui

- **Jogo** (`client/`): TypeScript + Phaser 3. Três dinossauros, árvore de mutações, chefe, modo infinito (Era Sem Fim), meta-progressão com loja e maestria. Funciona sem conta (o progresso fica no navegador).
- **API** (`server/`): Spring Boot 4.1, Java 21, PostgreSQL. Login com e-mail/senha ou Google, save na nuvem e **o servidor calcula as recompensas**: o jogo só informa o que aconteceu na run.
- **Economia compartilhada** (`shared/economy.json`): os números de Fósseis, maestria, dificuldades e preços, lidos pelo jogo e pela API. Um teste de paridade roda os mesmos casos nos dois lados.
- **Simulador de balanceamento** (`client/tools/balance/sim.ts`): Monte Carlo com os dados reais do jogo (veja `docs/balanceamento.md`).

## Arquitetura

```
navegador ──► Vercel (jogo estático) ──► /api/* (rewrite) ──► API Spring Boot ──► PostgreSQL
                 │                                               │
                 └──────────── shared/economy.json ──────────────┘
```

A API é um monólito organizado por funcionalidade (`auth`, `player`, `run`, `shop`, `economy`). O jogo fala com a persistência por uma interface (`SaveStore`) com duas implementações: `LocalSaveStore` (visitante) e `CloudSaveStore` (conta).

| Endpoint | O que faz |
|---|---|
| `POST /api/auth/register` · `login` · `google` · `refresh` · `logout` | Contas e sessão |
| `GET /api/players/me/save` | Save da conta no formato do jogo |
| `POST /api/players/me/import` | Importa o save do navegador uma única vez, e só para uma conta vazia |
| `POST /api/runs` | Registra uma run; o servidor calcula Fósseis e maestria (idempotente pelo id da run) |
| `POST /api/clears` | Vitória no chefe: libera a próxima dificuldade e paga o bônus uma vez |
| `POST /api/shop/purchases` | Compra no Covil (saldo conferido e debitado na mesma transação) |

A documentação interativa fica em `/swagger-ui` quando a API está rodando.

## Decisões de segurança

- **Tokens:** o access token é um JWT de 15 minutos, guardado só em memória. O refresh token, de 30 dias, fica num cookie `HttpOnly; SameSite=Strict` restrito a `/api/auth`, e o banco guarda apenas o SHA-256.
- **Rotação com detecção de reuso:** cada renovação invalida o refresh token usado. Se um token já usado aparecer de novo, todas as sessões da conta são encerradas.
- **Mesma origem:** jogo e API ficam no mesmo domínio (rewrite da Vercel e proxy do Vite), então não há CORS para abrir e o cookie é *first-party*.
- **Account pre-hijacking:** o cadastro com senha não confirma o e-mail. Quando alguém entra com o Google usando o e-mail de uma conta com senha, a conta é ligada ao Google, a senha é removida e as sessões antigas são encerradas: quem prova a posse do e-mail fica com a conta.
- **Confiança no cliente:** a importação do save do navegador é o único momento em que a API aceita números do cliente. Acontece uma vez por conta e todos os valores são validados contra o que o jogo consegue produzir. Num jogo que roda no navegador, nenhuma verificação impede 100% das trapaças. Por isso a API recalcula todas as recompensas e recusa runs inconsistentes; a detecção estatística de runs impossíveis está prevista para a fase 3.
- **Concorrência:** `@Version` no jogador. Duas compras simultâneas sem saldo para ambas resultam em exatamente uma aprovada (existe um teste para isso).

## Rodando localmente

Requisitos: JDK 21, Node 24 e Docker.

```bash
docker compose up -d                                         # Postgres
cd server && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev   # API em :8080
cd client && npm ci && cp .env.example .env.local            # edite VITE_API_ENABLED=true
npm run dev                                                  # jogo em :5173 (proxy /api → :8080)
```

Para o botão do Google, crie um OAuth Client ID (tipo Web) com a origem `http://localhost:5173` e passe o mesmo valor em `GOOGLE_CLIENT_ID` (API) e `VITE_GOOGLE_CLIENT_ID` (jogo).

## Testes

```bash
cd server && ./mvnw verify     # JUnit + MockMvc + Testcontainers (Postgres real)
cd client && npm test          # chefe, modo infinito, save, paridade da economia, cliente HTTP e sessão
```

## Próximas fases

- **Fase 3:** detecção de runs impossíveis (abates por minuto, dano máximo) e ranking por dinossauro e dificuldade.
- **Fase 4:** deploy da API, rewrite `/api/*` na Vercel, rate limiting e observabilidade.
````

- [ ] **Step 3: Verificação final completa**

```bash
cd server && ./mvnw -q verify && cd ../client && npm ci && npm run typecheck && npm test && npm run build
```
Expected: `BUILD SUCCESS` no servidor e tudo verde no cliente. Cole o resumo da saída no relatório da task.

- [ ] **Step 4: Commit**

```bash
git add .github README.md
git commit -m "docs: README do projeto e CI no GitHub Actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Lembrete de entrega (não é ação do agente)**

Antes do merge na `main`: o dono do projeto troca o *Root Directory* da Vercel para `client` (pré-requisito 4). Enquanto a API não estiver publicada (fase 4), a Vercel continua sem `VITE_API_ENABLED`, e o jogo em produção segue só com o modo visitante.
