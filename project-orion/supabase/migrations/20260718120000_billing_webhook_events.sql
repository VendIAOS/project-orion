create table if not exists public.billing_webhook_events (
  id text primary key,
  event_type text not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  processed_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_billing_webhook_events_workspace_id on public.billing_webhook_events(workspace_id);
create index if not exists idx_billing_webhook_events_event_type on public.billing_webhook_events(event_type);

alter table public.billing_webhook_events enable row level security;
