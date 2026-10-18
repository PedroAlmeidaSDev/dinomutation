# Subindo para produção

Guia passo a passo para colocar contas e save na nuvem no ar. O jogo continua na Vercel; a API vai para o **Railway** (container Docker) e o banco para o **Supabase** (PostgreSQL gerenciado). Qualquer host que rode um container e qualquer PostgreSQL 15+ servem do mesmo jeito, só mudam os cliques.

```
navegador ──► dinomutation.vercel.app ──► /api/* (rewrite da Vercel) ──► API no Railway ──► Supabase
```

Jogo e API ficam na **mesma origem** para o navegador (o rewrite da Vercel encaminha `/api/*`), então não há CORS e o cookie de sessão é *first-party*.

A ordem importa: banco → Google → API → jogo. Até o passo 5, o jogo em produção continua exatamente como está hoje.

## Checklist rápido

- [ ] 1. Banco criado no Supabase e string JDBC do *Session pooler* anotada
- [ ] 2. OAuth Client ID do Google com a origem da Vercel
- [ ] 3. API no Railway com as variáveis de ambiente e `/actuator/health` respondendo
- [ ] 4. Smoke test da API pelo curl
- [ ] 5. `client/vercel.json` com o rewrite, commitado
- [ ] 6. Vercel: Root Directory `client` + variáveis `VITE_*`
- [ ] 7. Merge na `main` e deploy de produção
- [ ] 8. Roteiro de conferência no navegador

## 1. Banco (Supabase)

1. Crie um projeto em <https://supabase.com> (região mais perto dos jogadores, por exemplo `South America (São Paulo)`). Anote a senha do banco que você definir.
2. No projeto, clique em **Connect** e escolha **Session pooler** (porta `5432` no host `….pooler.supabase.com`).
   - **Não** use a *Direct connection*: ela só tem IPv6 (sem o add-on pago de IPv4), e a conexão pode falhar a partir do Railway.
   - **Não** use o *Transaction pooler* (porta `6543`): o Flyway e os *prepared statements* do Hibernate não combinam com o pooler em modo transação.
3. Monte as três variáveis da API a partir da string que o Supabase mostra (`postgresql://postgres.REF:SENHA@aws-0-REGIAO.pooler.supabase.com:5432/postgres`):

| Variável | Valor |
|---|---|
| `DB_URL` | `jdbc:postgresql://aws-0-REGIAO.pooler.supabase.com:5432/postgres?sslmode=require` |
| `DB_USER` | `postgres.REF` (com o ref do projeto depois do ponto) |
| `DB_PASSWORD` | `SENHA` |

Não precisa criar tabelas: o Flyway roda as migrations (`server/src/main/resources/db/migration`) no schema `public` quando a API sobe. A API acessa o banco direto pelo JDBC; a API REST automática do Supabase (PostgREST) não é usada pelo jogo.

**Segurança no Supabase:** a API REST automática expõe o schema `public` para qualquer um com a chave `anon` (que é pública). A migration `V6__enable_row_level_security.sql` liga o RLS em todas as tabelas sem nenhuma *policy*, o que bloqueia esse acesso; a API conecta como dona das tabelas e não é afetada. **Toda tabela nova precisa de um `ALTER TABLE … ENABLE ROW LEVEL SECURITY` na própria migration.** Se quiser fechar de vez, desligue a *Data API* em *Project Settings* → *Data API*.

A tabela do Flyway fica de fora da migration (o Flyway trava essa tabela noutra conexão enquanto migra, e o `ALTER` esperaria para sempre). Depois que a API subir pela primeira vez, rode uma vez no *SQL Editor* do Supabase:

```sql
ALTER TABLE flyway_schema_history ENABLE ROW LEVEL SECURITY;
```

## 2. Google (login com Google)

No [Google Cloud Console](https://console.cloud.google.com/) → *APIs e serviços* → *Credenciais*:

1. Se ainda não existe, configure a *Tela de consentimento OAuth* (tipo **Externo**, nome "DinoMutation", e-mail de suporte) e **publique** o app (*Em produção*). Em modo *Teste* só os usuários de teste conseguem entrar.
2. *Criar credenciais* → *ID do cliente OAuth* → tipo **Aplicativo da Web**.
3. *Origens JavaScript autorizadas*: `https://dinomutation.vercel.app` e `http://localhost:5173`. Não precisa de URI de redirecionamento (o jogo usa o Google Identity Services com o botão).
4. Anote o **Client ID** (`….apps.googleusercontent.com`). O mesmo valor vai para a API (`GOOGLE_CLIENT_ID`) e para o jogo (`VITE_GOOGLE_CLIENT_ID`).

Sem o Client ID, o login por e-mail e senha funciona normalmente e o botão do Google simplesmente não aparece.

## 3. API (Railway)

O build e o deploy já estão descritos em [`railway.json`](../railway.json), na raiz do repositório: imagem a partir de `server/Dockerfile` (contexto na raiz, porque o build lê `shared/economy.json`), health check em `/actuator/health` e redeploy só quando mudam `server/`, `shared/` ou o próprio `railway.json`.

1. Em <https://railway.com>: *New Project* → *Deploy from GitHub repo* → escolha o repositório `dinomutation`.
2. No serviço criado, em *Settings*:

| Campo | Valor |
|---|---|
| Source → Branch | `feat/backend-fase2` por enquanto (troque para `main` depois do merge, no passo 7) |
| Source → Root Directory | *(vazio: a raiz do repositório)* |
| Config-as-code | `railway.json` (detectado sozinho na raiz) |
| Networking → Public Networking | *Generate Domain* (porta: a que o Railway sugerir, a mesma de `PORT`) |
| Deploy → Region | a mesma região do Supabase, ou a mais perto dela |

3. Variáveis (*Variables*):

| Variável | Valor |
|---|---|
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | do passo 1 |
| `JWT_SECRET` | segredo aleatório com pelo menos 32 bytes: `openssl rand -base64 48` (no Git Bash). Guarde só no Railway. |
| `GOOGLE_CLIENT_ID` | do passo 2 |
| `COOKIE_SECURE` | `true` (já é o padrão; deixe explícito) |
| `JAVA_TOOL_OPTIONS` | `-XX:MaxRAMPercentage=75 -Xmx512m` (opcional, veja "Memória" abaixo) |

`PORT` é definida pelo próprio Railway; a API escuta nela (`server.port: ${PORT:8080}`). **Não** defina `SPRING_PROFILES_ACTIVE=dev` em produção: o perfil `dev` tem um segredo JWT público e desliga o `Secure` do cookie.

4. *Deploy*. O primeiro build demora alguns minutos (baixa o Maven e as dependências). Os testes não rodam no build da imagem; eles rodam no GitHub Actions. O Railway só troca para a versão nova depois que `/actuator/health` responde `UP`.
5. Quando ficar *Active*, anote a URL, por exemplo `https://dinomutation-api.up.railway.app`, e confira:

```bash
curl https://dinomutation-api.up.railway.app/actuator/health
# {"groups":["liveness","readiness"],"status":"UP"}
```

Se a API não subir, veja os *Deploy Logs* do serviço. As causas mais comuns:
- `Defina JWT_SECRET com pelo menos 32 bytes`: falta o `JWT_SECRET` ou ele é curto.
- Erro de conexão do Flyway: `DB_URL` sem `jdbc:` na frente, sem `?sslmode=require`, usando a *Direct connection* (IPv6) ou o *Transaction pooler* (porta `6543`).
- `password authentication failed`: `DB_USER` sem o `.REF` do projeto (no pooler o usuário é `postgres.REF`, não só `postgres`).

**Memória:** o Railway cobra pelo uso e o limite do container costuma ser bem maior que o necessário. O `JAVA_TOOL_OPTIONS` do Dockerfile deixa o heap em 75% do limite do container; o `-Xmx512m` acima põe um teto fixo, suficiente para a API. Outra opção é limitar a memória do serviço em *Settings* → *Deploy* → *Resource Limits*.

**Sem cold start:** num plano pago o serviço fica sempre ligado (não ative *Serverless* / *App Sleeping* nas configurações do serviço). O jogo ainda espera até 45 s por resposta; se passar disso, mostra "Servidor indisponível", continua com a prévia local e reenvia as runs pendentes depois.

**Supabase gratuito:** projetos do plano Free são pausados depois de ~1 semana sem atividade no banco. Com jogadores entrando isso não acontece; se o jogo ficar parado, reative o projeto no painel do Supabase.

## 4. Smoke test da API

Direto na URL do Railway (troque a URL e o e-mail):

```bash
API=https://dinomutation-api.up.railway.app
curl -s -X POST $API/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"voce+teste@example.com","password":"senha-forte-123","displayName":"Teste"}'
# {"accessToken":"…","expiresIn":900}
```

A documentação interativa fica em `$API/swagger-ui`.

No Supabase, *Table Editor* → schema `public`: as tabelas das migrations e a conta de teste aparecem lá.

## 5. Rewrite `/api/*` na Vercel

Crie `client/vercel.json` com a URL do passo 3 (sem barra no fim):

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://dinomutation-api.up.railway.app/api/:path*" }
  ]
}
```

Commit e push na `feat/backend-fase2`:

```bash
git add client/vercel.json
git commit -m "chore: rewrite /api para a API em produção"
git push
```

## 6. Vercel

No projeto `dinomutation` da Vercel, em *Settings*:

1. *Build and Deployment* → **Root Directory** = `client`, e ative **Include files outside the Root Directory in the Build Step** (o jogo importa `../shared/economy.json`). Framework: Vite (detectado sozinho); build `npm run build`, saída `dist`.
2. *Environment Variables* (marque **Production** e **Preview**):

| Variável | Valor |
|---|---|
| `VITE_API_ENABLED` | `true` |
| `VITE_GOOGLE_CLIENT_ID` | Client ID do passo 2 |

As variáveis `VITE_*` entram no build: depois de mudar qualquer uma, faça *Redeploy*.

**Teste no preview antes da produção:** o push do passo 5 gera um deploy de *Preview* da branch. Abra a URL do preview e faça o roteiro do passo 8 com e-mail e senha. O botão do Google só funciona nas origens cadastradas no passo 2; se quiser testá-lo no preview, adicione temporariamente a URL do preview às origens.

> Atenção: a troca do Root Directory vale também para os builds da `main`. Se a `main` ainda não tem a pasta `client/` quando você trocar, um novo deploy de produção falha (o site atual continua no ar, só não atualiza). Por isso faça o passo 6 e o passo 7 em sequência.

## 7. Merge e produção

1. Confira que o CI do GitHub Actions está verde na `feat/backend-fase2`.
2. Faça o merge seguindo o fluxo do repositório (`feat/backend-fase2` → `dev` → `main`). O push na `main` dispara o deploy de produção da Vercel.
3. No Railway, troque a *Branch* do serviço para `main`. A partir daí, cada push na `main` que mexa em `server/` ou `shared/` atualiza a API também.

## 8. Roteiro de conferência (produção)

Em <https://dinomutation.vercel.app/>, numa janela anônima:

1. **Visitante:** "Jogar como visitante", uma run curta. Tudo igual a antes, save no navegador.
2. **Criar conta** com e-mail e senha. Se havia progresso de visitante, aceite **importar**: Fósseis, maestria e loja aparecem no menu e no Covil.
3. Jogue uma run e **vença o chefe**: a tela de resultado mostra "1ª VITÓRIA +N" e a dificuldade liberada.
4. **Covil:** compre um item; os Fósseis diminuem.
5. **Recarregue a página:** a sessão volta sozinha (cookie de renovação) e o progresso é o da nuvem.
6. **Sair** e **entrar com Google** usando o mesmo e-mail: a conta é a mesma (o Google passa a ser o login e a senha é removida; veja "Decisões de segurança" no README).
7. Abra noutro navegador ou celular e entre na mesma conta: o progresso aparece lá.
8. **RANKING** como visitante: abra a tela e circule os filtros de dino e dificuldade (as setas); a lista atualiza sem travar.
9. **Entre na conta** e volte ao RANKING: a sua linha aparece destacada (ou aparece abaixo de um separador, se estiver fora do top exibido).
10. Com `VITE_API_ENABLED=false`, o botão de RANKING não aparece no menu.

## Voltar atrás

- **Desligar contas sem tirar o jogo do ar:** na Vercel, `VITE_API_ENABLED=false` e *Redeploy*. O jogo volta ao modo só visitante; o progresso das contas fica guardado no banco.
- **Voltar o jogo inteiro:** na Vercel, *Deployments* → deploy anterior → *Promote to Production*.
- **Voltar só a API:** no Railway, *Deployments* → deploy anterior → *Redeploy*.

## Variáveis, resumo

| Onde | Variável | Obrigatória | Observação |
|---|---|---|---|
| Railway | `DB_URL` | sim | `jdbc:postgresql://…pooler.supabase.com:5432/postgres?sslmode=require`, *Session pooler* |
| Railway | `DB_USER`, `DB_PASSWORD` | sim | usuário no formato `postgres.REF` |
| Railway | `JWT_SECRET` | sim | ≥ 32 bytes; ao trocar, os access tokens em uso deixam de valer e o jogo renova a sessão sozinho |
| Railway | `GOOGLE_CLIENT_ID` | não | sem ela, login com Google é recusado |
| Railway | `COOKIE_SECURE` | não | padrão `true`; nunca `false` em produção |
| Railway | `JAVA_TOOL_OPTIONS` | não | `-XX:MaxRAMPercentage=75 -Xmx512m` para limitar a memória (e o custo) |
| Vercel | `VITE_API_ENABLED` | sim | `true` liga contas e save na nuvem |
| Vercel | `VITE_GOOGLE_CLIENT_ID` | não | mesmo valor do `GOOGLE_CLIENT_ID` |
