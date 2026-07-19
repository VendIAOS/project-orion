# VendIAOS

Sistema Operacional de Marketing com IA.

Nome interno: Project Orion.

## Estado atual

Build interna: 0.96.0

O produto ja possui:

- AI Studio com orquestrador de marketing e rota server-side para OpenAI.
- Projetos persistidos no Supabase com arquivamento e restauracao.
- Fila de agentes com execucao, logs, locks, retries, ciclos e auditoria.
- Billing com limites, eventos, Stripe preparado e portal/checkout.
- Workspace, membros, convites, login e permissoes por role.
- Painel `/production` com checklist, smoke test e verificacao de variaveis.

## Rodar localmente

```powershell
npm install
npm run dev
```

Abra:

```text
http://localhost:3000
```

Painel de producao:

```text
http://localhost:3000/production
```

## Validar antes de publicar

```powershell
npm run lint
npm run build
```

Depois abra `/production`, clique em **Verificar agora** e rode **Smoke test**.

## Variaveis principais

Use `.env.example` como referencia. Valores obrigatorios para deploy externo:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VENDIAOS_DEFAULT_WORKSPACE_ID`
- `VENDIAOS_DEFAULT_USER_ID`
- `NEXT_PUBLIC_APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_SCALE`

## Deploy

Leia o guia:

```text
docs/DEPLOYMENT.md
```

O deploy so deve ser considerado pronto quando `/api/production/deploy-check` e `/api/production/smoke` estiverem sem falhas criticas na URL publica.
