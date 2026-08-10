export function getBootstrapWorkspaceContext(): WorkspaceContext | null {
  // Nunca permitir o fallback de bootstrap em produção, mesmo que as
  // variáveis de ambiente estejam configuradas por engano.
  const bootstrapAllowed =
    process.env.NODE_ENV !== "production" || process.env.VENDIAOS_ALLOW_BOOTSTRAP === "true";

  if (!bootstrapAllowed) {
    return null;
  }

  const workspaceId = process.env.VENDIAOS_DEFAULT_WORKSPACE_ID;
  const userId = process.env.VENDIAOS_DEFAULT_USER_ID;

  if (!workspaceId || !userId) {
    return null;
  }

  return {
    workspaceId,
    userId,
    source: "bootstrap",
  };
}
