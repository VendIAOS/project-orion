-- Security hardening: membership creation is performed only by trusted
-- server-side flows using the service role. Authenticated clients must not be
-- able to attach themselves to an arbitrary workspace by knowing its UUID.

drop policy if exists "owners can create workspace membership" on public.workspace_members;

-- Existing read access remains workspace-scoped. Inserts are intentionally
-- left without an authenticated policy, so RLS denies direct client inserts.
