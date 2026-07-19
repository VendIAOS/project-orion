create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_events_workspace_created_idx
  on public.admin_audit_events(workspace_id, created_at desc);

create index if not exists admin_audit_events_type_idx
  on public.admin_audit_events(event_type);

alter table public.admin_audit_events enable row level security;
