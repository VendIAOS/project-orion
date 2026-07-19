alter table public.projects
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table public.artifacts
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

create index if not exists projects_workspace_archived_idx
  on public.projects(workspace_id, archived_at);

create index if not exists artifacts_workspace_archived_idx
  on public.artifacts(workspace_id, archived_at);
