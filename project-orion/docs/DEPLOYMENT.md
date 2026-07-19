# Deploy VendIAOS

Guia operacional para publicar o VendIAOS em ambiente externo controlado.

## 1. Pre-deploy local

Rode:

```powershell
npm run lint
npm run build
```

Abra localmente:

```text
http://localhost:3000/production
```

Clique em:

- Verificar agora
- Rodar smoke test

Corrija qualquer falha critica antes de seguir.

## 2. Ambiente de deploy

Configure o projeto na plataforma escolhida, por exemplo Vercel:

- Root Directory: `project-orion`
- Framework: Next.js
- Build command: `npm run build`
- Install command: `npm install`
- Output: padrao Next.js

Conecte o repositorio correto:

```text
VendIAOS/project-orion
```

Importante: o repositorio remoto tem o app dentro da pasta `project-orion`. Se a plataforma perguntar por root directory, selecione exatamente:

```text
project-orion
```

Se deixar a raiz do repositorio, o deploy pode tentar usar arquivos soltos fora do app.

## 3. Variaveis obrigatorias

Configure no ambiente de producao:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VENDIAOS_DEFAULT_WORKSPACE_ID=
VENDIAOS_DEFAULT_USER_ID=
NEXT_PUBLIC_APP_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_GROWTH=
STRIPE_PRICE_SCALE=
```

Para o primeiro deploy controlado, `NEXT_PUBLIC_APP_URL` deve ser a URL publica gerada pela plataforma. Depois de configurar o dominio final, atualize essa variavel para o dominio definitivo.

Opcional:

```env
VENDIAOS_BOOTSTRAP_SECRET=
```

Nunca coloque chaves secretas no frontend. Somente variaveis com prefixo `NEXT_PUBLIC_` podem ficar acessiveis ao cliente.

## 4. Supabase

Antes do deploy:

- Aplicar todas as migrations em `supabase/migrations`.
- Confirmar tabelas de workspace, projetos, artefatos, agentes, billing e auditoria.
- Confirmar Auth URL publica em Supabase Auth.
- Atualizar redirects/callbacks para a URL final.

## 5. Stripe

No Stripe em producao:

- Criar ou conferir produtos Growth e Scale.
- Copiar Price IDs para `STRIPE_PRICE_GROWTH` e `STRIPE_PRICE_SCALE`.
- Criar webhook apontando para:

```text
https://SEU-DOMINIO/api/billing/webhook
```

Eventos esperados:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Copie o webhook secret para `STRIPE_WEBHOOK_SECRET`.

## 6. Dominio

Depois de publicar:

- Apontar DNS para a plataforma de deploy.
- Configurar `NEXT_PUBLIC_APP_URL` com a URL final.
- Atualizar Supabase Auth URLs.
- Testar `/login`, `/invite/[token]`, `/billing`, `/production`.

## 7. Pos-deploy

Na URL publica, abra:

```text
/production
```

Execute:

- Verificar agora
- Rodar smoke test

Aceitacao minima:

- Deploy check sem variaveis obrigatorias faltantes.
- Smoke test sem falhas criticas.
- AI Studio responde via OpenAI.
- Projeto salva no Supabase.
- Transformacao cria execucao de agente.
- Billing abre checkout ou portal conforme permissao.

## 8. Rollback

Se a URL publica falhar:

- Reverter para o deploy anterior na plataforma.
- Conferir variaveis de ambiente.
- Conferir migrations aplicadas.
- Abrir `/production` novamente e repetir smoke test.
