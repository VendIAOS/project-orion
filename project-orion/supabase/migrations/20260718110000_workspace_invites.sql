create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  token text not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email, status)
);

create index if not exists idx_workspace_invites_workspace_id on public.workspace_invites(workspace_id);
create index if not exists idx_workspace_invites_email on public.workspace_invites(email);
create index if not exists idx_workspace_invites_token on public.workspace_invites(token);

alter table public.workspace_invites enable row level security;

drop policy if exists "members can read workspace invites" on public.workspace_invites;
create policy "members can read workspace invites"
on public.workspace_invites
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "admins can create workspace invites" on public.workspace_invites;
create policy "admins can create workspace invites"
on public.workspace_invites
for insert
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_invites.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
);

drop policy if exists "admins can update workspace invites" on public.workspace_invites;
create policy "admins can update workspace invites"
on public.workspace_invites
for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_invites.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_invites.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
);
