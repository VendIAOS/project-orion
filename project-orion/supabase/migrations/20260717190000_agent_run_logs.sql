create table if not exists public.agent_run_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  level text not null default 'info' check (level in ('info', 'success', 'warning', 'error')),
  event text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_run_logs_run_created_at
  on public.agent_run_logs(run_id, created_at);

create index if not exists idx_agent_run_logs_workspace_created_at
  on public.agent_run_logs(workspace_id, created_at desc);

alter table public.agent_run_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agent_run_logs'
      and policyname = 'members can read agent run logs'
  ) then
    create policy "members can read agent run logs"
      on public.agent_run_logs
      for select
      using (public.is_workspace_member(workspace_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agent_run_logs'
      and policyname = 'members can create agent run logs'
  ) then
    create policy "members can create agent run logs"
      on public.agent_run_logs
      for insert
      with check (public.is_workspace_member(workspace_id));
  end if;
end $$;
