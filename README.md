# DinoMutation

[![CI](https://github.com/PedroAlmeidaSDev/dinomutation/actions/workflows/ci.yml/badge.svg)](https://github.com/PedroAlmeidaSDev/dinomutation/actions/workflows/ci.yml)

Roguelite de mutações jurássicas para navegador, com uma API em **Java/Spring Boot** para contas, save na nuvem e economia validada no servidor.

**Jogar:** https://dinomutation.vercel.app/

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

A API é um monólito organizado por funcionalidade (`auth`, `player`, `run`, `shop`, `economy`, `leaderboard`). O jogo fala com a persistência por uma interface (`SaveStore`) com duas implementações: `LocalSaveStore` (visitante) e `CloudSaveStore` (conta).

| Endpoint | O que faz |
|---|---|
| `POST /api/auth/register` · `login` · `google` · `refresh` · `logout` | Contas e sessão |
| `GET /api/players/me/save` | Save da conta no formato do jogo |
| `POST /api/players/me/import` | Importa o save do navegador uma única vez, e só para uma conta vazia |
| `POST /api/runs` | Registra uma run; o servidor calcula Fósseis e maestria (idempotente pelo id da run) |
| `POST /api/clears` | Vitória no chefe: libera a próxima dificuldade e paga o bônus uma vez |
| `POST /api/shop/purchases` | Compra no Covil (saldo conferido e debitado na mesma transação) |
| `GET /api/leaderboard` | Ranking público dos maiores tempos sobrevividos: uma linha por jogador, filtros por dino e dificuldade, consulta com `DISTINCT ON` + `RANK()`. Com token, inclui a sua posição. Runs importadas do save do navegador não entram no ranking (só contam as runs enviadas ao servidor), então o "Melhor tempo" do menu pode ser maior que o tempo no ranking |

A documentação interativa fica em `/swagger-ui` quando a API está rodando.

## Decisões de segurança

- **Tokens:** o access token é um JWT de 15 minutos, guardado só em memória. O refresh token, de 30 dias, fica num cookie `HttpOnly; SameSite=Strict` restrito a `/api/auth`, e o banco guarda apenas o SHA-256.
- **Rotação com detecção de reuso:** cada renovação invalida o refresh token usado. Se um token já usado aparecer de novo, todas as sessões da conta são encerradas.
- **Mesma origem:** jogo e API ficam no mesmo domínio (rewrite da Vercel e proxy do Vite), então não há CORS para abrir e o cookie é *first-party*.
- **Account pre-hijacking:** o cadastro com senha não confirma o e-mail. Quando alguém entra com o Google usando o e-mail de uma conta com senha, a conta é ligada ao Google, a senha é removida e as sessões antigas são encerradas: quem prova a posse do e-mail fica com a conta.
- **Confiança no cliente:** a importação do save do navegador é o único momento em que a API aceita números do cliente. Acontece uma vez por conta, e a API valida o formato e os limites do save: ids de dinossauro, dificuldade e item, níveis da loja, dificuldade vencida dentro do intervalo, teto de maestria, vitórias ≤ runs e nenhum valor negativo. Fósseis, runs e recordes não têm teto. Num jogo que roda no navegador, nenhuma verificação impede 100% das trapaças. Por isso a API recalcula todas as recompensas e recusa runs inconsistentes; a próxima fase troca isso por **runs com seed**: o servidor entrega uma seed, o jogo envia a seed e os comandos do jogador, e o servidor reproduz a partida para conferir o resultado. Enquanto isso não existe, o ranking público aceita qualquer run consistente, até 4 h de tempo.
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

## Deploy

Passo a passo para produção (Neon, Render, Google e Vercel) em [`docs/deploy.md`](docs/deploy.md). A API tem imagem Docker em `server/Dockerfile` (build a partir da raiz: `docker build -f server/Dockerfile .`).

Antes do merge na `main`: o jogo importa `shared/economy.json`, que fica fora de `client/`. No projeto da Vercel, defina o **Root Directory** como `client` e ative **Include files outside the Root Directory in the Build Step**.

## Próximas fases

- **Fase 3:** antitrapaça com runs por seed (simulação determinística, reproduzida no servidor) para validar o ranking.
- **Fase 4:** deploy da API, rewrite `/api/*` na Vercel, rate limiting e observabilidade. A consulta do ranking varre a tabela `run` inteira (sem índice que dê o melhor tempo por jogador direto); por ora ela é cacheada por 30 s (`app.leaderboard.cache-ttl`). Uma tabela `player_best` (ou materialized view) e rate limiting na rota pública vêm junto com o trabalho de deploy.
