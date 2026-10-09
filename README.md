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
