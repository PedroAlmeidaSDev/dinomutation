# Subindo para produção

Guia passo a passo para colocar contas e save na nuvem no ar. O jogo continua na Vercel; a API vai para o **Render** (container Docker) e o banco para o **Neon** (PostgreSQL gerenciado). As duas opções têm plano gratuito; qualquer host que rode um container e qualquer PostgreSQL 16 servem do mesmo jeito, só mudam os cliques.

```
navegador ──► dinomutation.vercel.app ──► /api/* (rewrite da Vercel) ──► API no Render ──► Neon
```

Jogo e API ficam na **mesma origem** para o navegador (o rewrite da Vercel encaminha `/api/*`), então não há CORS e o cookie de sessão é *first-party*.

A ordem importa: banco → Google → API → jogo. Até o passo 5, o jogo em produção continua exatamente como está hoje.

## Checklist rápido

- [ ] 1. Banco criado no Neon e string JDBC anotada
- [ ] 2. OAuth Client ID do Google com a origem da Vercel
- [ ] 3. API no Render com as variáveis de ambiente e `/actuator/health` respondendo
- [ ] 4. Smoke test da API pelo curl
- [ ] 5. `client/vercel.json` com o rewrite, commitado
- [ ] 6. Vercel: Root Directory `client` + variáveis `VITE_*`
- [ ] 7. Merge na `main` e deploy de produção
- [ ] 8. Roteiro de conferência no navegador

## 1. Banco (Neon)

1. Crie um projeto em <https://neon.tech> (região mais perto dos jogadores, por exemplo `AWS São Paulo` se houver, senão `us-east`). Versão do PostgreSQL: **16**.
2. Em *Connection details*, escolha a conexão **direta** (desligue *Connection pooling*). O Flyway e os *prepared statements* do Hibernate não combinam com o pooler em modo transação.
3. Monte as três variáveis da API a partir da string que o Neon mostra (`postgresql://USUARIO:SENHA@HOST/BANCO?sslmode=require`):

| Variável | Valor |
|---|---|
| `DB_URL` | `jdbc:postgresql://HOST/BANCO?sslmode=require` |
| `DB_USER` | `USUARIO` |
| `DB_PASSWORD` | `SENHA` |

Não precisa criar tabelas: o Flyway roda as migrations (`server/src/main/resources/db/migration`) quando a API sobe.

## 2. Google (login com Google)

No [Google Cloud Console](https://console.cloud.google.com/) → *APIs e serviços* → *Credenciais*:

1. Se ainda não existe, configure a *Tela de consentimento OAuth* (tipo **Externo**, nome "DinoMutation", e-mail de suporte) e **publique** o app (*Em produção*). Em modo *Teste* só os usuários de teste conseguem entrar.
2. *Criar credenciais* → *ID do cliente OAuth* → tipo **Aplicativo da Web**.
3. *Origens JavaScript autorizadas*: `https://dinomutation.vercel.app` e `http://localhost:5173`. Não precisa de URI de redirecionamento (o jogo usa o Google Identity Services com o botão).
4. Anote o **Client ID** (`….apps.googleusercontent.com`). O mesmo valor vai para a API (`GOOGLE_CLIENT_ID`) e para o jogo (`VITE_GOOGLE_CLIENT_ID`).

Sem o Client ID, o login por e-mail e senha funciona normalmente e o botão do Google simplesmente não aparece.

## 3. API (Render)

1. Em <https://render.com>: *New* → *Web Service* → conecte o repositório do GitHub.
2. Configuração:

| Campo | Valor |
|---|---|
| Branch | `feat/backend-fase2` por enquanto (troque para `main` depois do merge, no passo 7) |
| Root Directory | *(vazio: a raiz do repositório)* |
| Runtime / Language | **Docker** |
| Dockerfile Path | `server/Dockerfile` |
| Docker Build Context | `.` |
| Health Check Path | `/actuator/health` |
| Instance type | Free (veja "Cold start" abaixo) |

3. Variáveis de ambiente (*Environment*):

| Variável | Valor |
|---|---|
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | do passo 1 |
| `JWT_SECRET` | segredo aleatório com pelo menos 32 bytes: `openssl rand -base64 48` (no Git Bash). Guarde só no Render. |
| `GOOGLE_CLIENT_ID` | do passo 2 |
| `COOKIE_SECURE` | `true` (já é o padrão; deixe explícito) |

`PORT` é definida pelo próprio Render; a API escuta nela (`server.port: ${PORT:8080}`). **Não** defina `SPRING_PROFILES_ACTIVE=dev` em produção: o perfil `dev` tem um segredo JWT público e desliga o `Secure` do cookie.

4. *Create Web Service*. O primeiro build demora alguns minutos (baixa o Maven e as dependências). Os testes não rodam no build da imagem; eles rodam no GitHub Actions.
5. Quando ficar *Live*, anote a URL, por exemplo `https://dinomutation-api.onrender.com`, e confira:

```bash
curl https://dinomutation-api.onrender.com/actuator/health
# {"groups":["liveness","readiness"],"status":"UP"}
```

Se a API não subir, veja os *Logs* do Render. As causas mais comuns:
- `Defina JWT_SECRET com pelo menos 32 bytes`: falta o `JWT_SECRET` ou ele é curto.
- Erro de conexão do Flyway: `DB_URL` sem `jdbc:` na frente, sem `?sslmode=require`, ou usando o host do *pooler*.

**Cold start:** no plano gratuito o Render desliga a API depois de ~15 min sem tráfego e leva perto de 1 minuto para religar. O jogo espera até 45 s por resposta; se passar disso, mostra "Servidor indisponível", continua com a prévia local e reenvia as runs pendentes depois. Para evitar isso:
- plano pago do Render (sem *spin down*); ou
- um ping a cada 10 min na URL direta da API, `https://dinomutation-api.onrender.com/actuator/health`, num serviço como o [cron-job.org](https://cron-job.org). O plano gratuito do Render tem 750 h/mês, o bastante para uma instância ligada o mês inteiro.

## 4. Smoke test da API

Direto na URL do Render (troque a URL e o e-mail):

```bash
API=https://dinomutation-api.onrender.com
curl -s -X POST $API/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"voce+teste@example.com","password":"senha-forte-123","displayName":"Teste"}'
# {"accessToken":"…","expiresIn":900}
```

A documentação interativa fica em `$API/swagger-ui`.

## 5. Rewrite `/api/*` na Vercel

Crie `client/vercel.json` com a URL do passo 3 (sem barra no fim):

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://dinomutation-api.onrender.com/api/:path*" }
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
3. No Render, troque a *Branch* do serviço para `main`. A partir daí, cada push na `main` atualiza a API também.

## 8. Roteiro de conferência (produção)

Em <https://dinomutation.vercel.app/>, numa janela anônima:

1. **Visitante:** "Jogar como visitante", uma run curta. Tudo igual a antes, save no navegador.
2. **Criar conta** com e-mail e senha. Se havia progresso de visitante, aceite **importar**: Fósseis, maestria e loja aparecem no menu e no Covil.
3. Jogue uma run e **vença o chefe**: a tela de resultado mostra "1ª VITÓRIA +N" e a dificuldade liberada.
4. **Covil:** compre um item; os Fósseis diminuem.
5. **Recarregue a página:** a sessão volta sozinha (cookie de renovação) e o progresso é o da nuvem.
6. **Sair** e **entrar com Google** usando o mesmo e-mail: a conta é a mesma (o Google passa a ser o login e a senha é removida; veja "Decisões de segurança" no README).
7. Abra noutro navegador ou celular e entre na mesma conta: o progresso aparece lá.

## Voltar atrás

- **Desligar contas sem tirar o jogo do ar:** na Vercel, `VITE_API_ENABLED=false` e *Redeploy*. O jogo volta ao modo só visitante; o progresso das contas fica guardado no banco.
- **Voltar o jogo inteiro:** na Vercel, *Deployments* → deploy anterior → *Promote to Production*.

## Variáveis, resumo

| Onde | Variável | Obrigatória | Observação |
|---|---|---|---|
| Render | `DB_URL` | sim | `jdbc:postgresql://…?sslmode=require`, conexão direta |
| Render | `DB_USER`, `DB_PASSWORD` | sim | |
| Render | `JWT_SECRET` | sim | ≥ 32 bytes; ao trocar, os access tokens em uso deixam de valer e o jogo renova a sessão sozinho |
| Render | `GOOGLE_CLIENT_ID` | não | sem ela, login com Google é recusado |
| Render | `COOKIE_SECURE` | não | padrão `true`; nunca `false` em produção |
| Vercel | `VITE_API_ENABLED` | sim | `true` liga contas e save na nuvem |
| Vercel | `VITE_GOOGLE_CLIENT_ID` | não | mesmo valor do `GOOGLE_CLIENT_ID` |
