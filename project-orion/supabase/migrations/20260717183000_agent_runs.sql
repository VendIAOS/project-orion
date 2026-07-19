-- VendIAOS / Project Orion
-- Build 0.36.0 - Agent runs foundation

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artifact_id uuid references public.artifacts(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  agent text not null default 'marketing_orchestrator',
  target_mode text not null check (target_mode in ('campanha', 'video', 'imagem', 'avatar', 'analise', 'funil')),
  status text not null default 'sent_to_studio' check (status in ('queued', 'sent_to_studio', 'running', 'completed', 'failed', 'cancelled')),
  input_prompt text not null,
  input_snapshot text,
  output_artifact_id uuid references public.artifacts(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_runs_workspace_created_at on public.agent_runs(workspace_id, created_at desc);
create index if not exists idx_agent_runs_artifact_id on public.agent_runs(artifact_id);
create index if not exists idx_agent_runs_project_id on public.agent_runs(project_id);
create index if not exists idx_agent_runs_status on public.agent_runs(status);

drop trigger if exists set_agent_runs_updated_at on public.agent_runs;
create trigger set_agent_runs_updated_at
before update on public.agent_runs
for each row execute function public.set_updated_at();

alter table public.agent_runs enable row level security;

drop policy if exists "members can read agent runs" on public.agent_runs;
create policy "members can read agent runs"
on public.agent_runs
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "members can create agent runs" on public.agent_runs;
create policy "members can create agent runs"
on public.agent_runs
for insert
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "members can update agent runs" on public.agent_runs;
create policy "members can update agent runs"
on public.agent_runs
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
