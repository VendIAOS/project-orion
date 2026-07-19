create table if not exists public.billing_limit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  plan text not null,
  status text not null,
  used_count integer not null default 0,
  limit_count integer not null default 0,
  remaining_count integer not null default 0,
  period_start timestamptz not null,
  period_end timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_limit_events_workspace_created_idx
  on public.billing_limit_events(workspace_id, created_at desc);

create index if not exists billing_limit_events_type_idx
  on public.billing_limit_events(event_type);

alter table public.billing_limit_events enable row level security;
