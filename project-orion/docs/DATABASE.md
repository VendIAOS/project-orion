# Database

Build 0.9.0 introduces the first Supabase persistence model for VendIAOS.

## Tables

- `workspaces`: account/workspace container.
- `workspace_members`: users that can access a workspace.
- `projects`: saved marketing projects and their operational mode.
- `conversations`: AI Studio conversations, optionally linked to projects.
- `messages`: user/assistant/system messages inside conversations.
- `artifacts`: reusable outputs such as briefs, scripts, prompts, campaigns and funnel maps.
- `workspace_billing`: plan, subscription status, period limits and Stripe identifiers per workspace.
- `billing_webhook_events`: processed Stripe events for idempotency and traceability.
- `billing_limit_events`: billing enforcement events, such as blocked agent runs after quota exhaustion.
- `admin_audit_events`: administrative audit trail for sensitive workspace actions.

## Modes

`project_mode` supports:

- `campanha`
- `video`
- `imagem`
- `avatar`
- `analise`
- `funil`

## Applying the schema

Run the migration in Supabase SQL Editor or through Supabase CLI:

```powershell
supabase db push
```

Migration file:

```text
supabase/migrations/20260716090000_initial_marketing_os_schema.sql
```

Additional migrations add operational modules such as agent runs, logs, cycles, workspace invites and billing.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

The frontend must only use `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
The service role key is server-only and must never be exposed in client components.

## Security

Row Level Security is enabled for all tables.

The initial policy model is workspace based:

- a user can read data only if they are a workspace member;
- a user can create projects, conversations, messages and artifacts only inside a workspace they belong to;
- project and artifact updates are restricted to workspace members.

## Bootstrap inicial

Depois de aplicar a migration e configurar as chaves Supabase server-side, acesse:

```text
/settings
```

Use o card `Bootstrap Supabase` para criar:

- usuario inicial no Supabase Auth;
- workspace inicial;
- vinculo `owner` em `workspace_members`.

O card retorna:

```env
VENDIAOS_DEFAULT_WORKSPACE_ID=
VENDIAOS_DEFAULT_USER_ID=
```

Copie esses valores para `.env.local` e reinicie o servidor Next.js.

Em producao, configure `VENDIAOS_BOOTSTRAP_SECRET` antes de expor a rota de bootstrap.
