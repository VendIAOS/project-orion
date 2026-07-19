create table if not exists public.workspace_billing (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade unique,
  plan text not null default 'starter' check (plan in ('starter', 'growth', 'scale')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  monthly_agent_runs_limit integer not null default 100,
  monthly_projects_limit integer not null default 50,
  monthly_storage_mb_limit integer not null default 1024,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz not null default date_trunc('month', now()),
  current_period_end timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_billing_workspace_id on public.workspace_billing(workspace_id);
create index if not exists idx_workspace_billing_plan on public.workspace_billing(plan);
create index if not exists idx_workspace_billing_status on public.workspace_billing(status);

drop trigger if exists set_workspace_billing_updated_at on public.workspace_billing;
create trigger set_workspace_billing_updated_at
before update on public.workspace_billing
for each row execute function public.set_updated_at();

alter table public.workspace_billing enable row level security;

drop policy if exists "members can read workspace billing" on public.workspace_billing;
create policy "members can read workspace billing"
on public.workspace_billing
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "owners can manage workspace billing" on public.workspace_billing;
create policy "owners can manage workspace billing"
on public.workspace_billing
for all
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_billing.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_billing.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
);
