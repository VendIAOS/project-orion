create table if not exists public.agent_run_cycles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  mode text not null check (mode in ('manual', 'automatic')),
  status text not null check (status in ('completed', 'skipped', 'failed')),
  cleanup_count integer not null default 0,
  process_count integer not null default 0,
  skipped boolean not null default false,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_run_cycles_workspace_created_at
  on public.agent_run_cycles(workspace_id, created_at desc);

alter table public.agent_run_cycles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agent_run_cycles'
      and policyname = 'members can read agent run cycles'
  ) then
    create policy "members can read agent run cycles"
      on public.agent_run_cycles
      for select
      using (public.is_workspace_member(workspace_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agent_run_cycles'
      and policyname = 'members can create agent run cycles'
  ) then
    create policy "members can create agent run cycles"
      on public.agent_run_cycles
      for insert
      with check (public.is_workspace_member(workspace_id));
  end if;
end $$;
