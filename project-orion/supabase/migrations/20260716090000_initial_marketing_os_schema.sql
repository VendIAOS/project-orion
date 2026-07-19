-- VendIAOS / Project Orion
-- Build 0.9.0 - Initial persistence schema

create extension if not exists "pgcrypto";

do $$
begin
  create type public.project_mode as enum (
    'campanha',
    'video',
    'imagem',
    'avatar',
    'analise',
    'funil'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.artifact_type as enum (
    'briefing',
    'copy',
    'script',
    'image_prompt',
    'campaign_plan',
    'funnel_map',
    'analysis_report',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  mode public.project_mode not null,
  objective text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  source text not null default 'ai_studio',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null default 'AI Studio',
  mode public.project_mode,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  type public.artifact_type not null default 'other',
  mode public.project_mode not null,
  title text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_members_user_id on public.workspace_members(user_id);
create index if not exists idx_projects_workspace_id on public.projects(workspace_id);
create index if not exists idx_projects_mode on public.projects(mode);
create index if not exists idx_conversations_project_id on public.conversations(project_id);
create index if not exists idx_messages_conversation_id_created_at on public.messages(conversation_id, created_at);
create index if not exists idx_artifacts_project_id on public.artifacts(project_id);
create index if not exists idx_artifacts_workspace_mode on public.artifacts(workspace_id, mode);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

drop trigger if exists set_artifacts_updated_at on public.artifacts;
create trigger set_artifacts_updated_at
before update on public.artifacts
for each row execute function public.set_updated_at();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.artifacts enable row level security;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

drop policy if exists "members can read workspaces" on public.workspaces;
create policy "members can read workspaces"
on public.workspaces
for select
using (public.is_workspace_member(id));

drop policy if exists "users can create owned workspaces" on public.workspaces;
create policy "users can create owned workspaces"
on public.workspaces
for insert
with check (owner_id = auth.uid());

drop policy if exists "members can read workspace members" on public.workspace_members;
create policy "members can read workspace members"
on public.workspace_members
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "owners can create workspace membership" on public.workspace_members;
create policy "owners can create workspace membership"
on public.workspace_members
for insert
with check (user_id = auth.uid());

drop policy if exists "members can read projects" on public.projects;
create policy "members can read projects"
on public.projects
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "members can create projects" on public.projects;
create policy "members can create projects"
on public.projects
for insert
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "members can update projects" on public.projects;
create policy "members can update projects"
on public.projects
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members can read conversations" on public.conversations;
create policy "members can read conversations"
on public.conversations
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "members can create conversations" on public.conversations;
create policy "members can create conversations"
on public.conversations
for insert
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "members can read messages" on public.messages;
create policy "members can read messages"
on public.messages
for select
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and public.is_workspace_member(c.workspace_id)
  )
);

drop policy if exists "members can create messages" on public.messages;
create policy "members can create messages"
on public.messages
for insert
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and public.is_workspace_member(c.workspace_id)
  )
);

drop policy if exists "members can read artifacts" on public.artifacts;
create policy "members can read artifacts"
on public.artifacts
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "members can create artifacts" on public.artifacts;
create policy "members can create artifacts"
on public.artifacts
for insert
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "members can update artifacts" on public.artifacts;
create policy "members can update artifacts"
on public.artifacts
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
