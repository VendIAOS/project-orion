import { NextResponse } from "next/server";


import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { canManageWorkspaceMembers, getMissingWorkspaceContextReason, getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";
import { detectArtifactType, getProjectObjective, getProjectTitle, normalizeProjectMode } from "@/lib/project-content";
import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

interface SaveProjectBody {
  content?: string;
  mode?: string;
  originProjectId?: string;
  originProjectMode?: string;
  originProjectTitle?: string;
}

interface UpdateProjectBody {
  action?: "restore";
  content?: string;
  mode?: string;
}

interface SupabaseProjectRow {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  mode: string;
  objective: string | null;
  created_at: string;
}

interface SupabaseArtifactRow {
  id: string;
  project_id?: string | null;
  mode: string;
  content: string;
  created_at: string;
  archived_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getStringMetadata(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function createOriginMetadata(body: SaveProjectBody) {
  if (!body.originProjectId) {
    return {};
  }

  return {
    originProjectId: body.originProjectId,
    originProjectMode: body.originProjectMode,
    originProjectTitle: body.originProjectTitle,
  };
}

export async function GET(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);
  const status = new URL(request.url).searchParams.get("status");

  if (!context) {
    return NextResponse.json(
      {
        projects: [],
        source: "local-fallback",
        reason: getMissingWorkspaceContextReason(),
      },
      { status: 200 },
    );
  }

  try {
    const archiveFilter = status === "archived" ? "archived_at=not.is.null" : "archived_at=is.null";
    const result = await supabaseRest<SupabaseArtifactRow[]>("artifacts", {
      query: [
        `workspace_id=eq.${context.workspaceId}`,
        archiveFilter,
        "select=id,mode,content,created_at,archived_at,metadata",
        "order=created_at.desc",
        "limit=50",
      ].join("&"),
    });

    if (result.error) {
      return NextResponse.json({ error: "Nao foi possivel listar projetos.", details: result.error }, { status: result.status });
    }

    return NextResponse.json({
      projects: (result.data ?? []).map((project) => ({
        id: project.id,
        mode: project.mode,
        content: project.content,
        createdAt: project.created_at,
        archivedAt: project.archived_at ?? undefined,
        originProjectId: getStringMetadata(project.metadata, "originProjectId"),
        originProjectMode: getStringMetadata(project.metadata, "originProjectMode"),
        originProjectTitle: getStringMetadata(project.metadata, "originProjectTitle"),
      })),
      permissions: {
        role: context.role ?? "bootstrap",
        canRestoreProjects: canManageWorkspaceMembers(context.role),
      },
      source: "supabase",
      workspaceSource: context.source,
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ projects: [], source: "local-fallback", reason: error.message }, { status: 200 });
    }

    return NextResponse.json({ error: "Erro inesperado ao listar projetos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: SaveProjectBody;

  try {
    body = (await request.json()) as SaveProjectBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido." }, { status: 400 });
  }

  if (!body.content || body.content.trim().length === 0) {
    return NextResponse.json({ error: "Conteudo do projeto e obrigatorio." }, { status: 400 });
  }

  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json(
      {
        error: getMissingWorkspaceContextReason(),
        fallback: "localStorage",
      },
      { status: 409 },
    );
  }

  const mode = normalizeProjectMode(body.mode ?? "campanha");
  const content = body.content.trim();
  const title = getProjectTitle(content);
  const objective = getProjectObjective(content);
  const originMetadata = createOriginMetadata(body);

  try {
    const projectResult = await supabaseRest<SupabaseProjectRow[]>("projects", {
      method: "POST",
      body: {
        workspace_id: context.workspaceId,
        created_by: context.userId,
        title,
        objective,
        mode,
        source: "ai_studio",
        metadata: {
          savedFrom: "ai_message_actions",
          workspaceSource: context.source,
          ...originMetadata,
        },
      },
    });

    if (projectResult.error || !projectResult.data?.[0]) {
      return NextResponse.json(
        { error: "Nao foi possivel criar o projeto.", details: projectResult.error },
        { status: projectResult.status },
      );
    }

    const project = projectResult.data[0];
    const artifactResult = await supabaseRest<SupabaseArtifactRow[]>("artifacts", {
      method: "POST",
      body: {
        workspace_id: context.workspaceId,
        project_id: project.id,
        created_by: context.userId,
        type: detectArtifactType(mode),
        mode,
        title,
        content,
        metadata: {
          source: "ai_studio",
          workspaceSource: context.source,
          ...originMetadata,
        },
      },
    });

    if (artifactResult.error || !artifactResult.data?.[0]) {
      return NextResponse.json(
        { error: "Projeto criado, mas o artefato nao foi salvo.", details: artifactResult.error },
        { status: artifactResult.status },
      );
    }

    const artifact = artifactResult.data[0];

    return NextResponse.json({
      project: {
        id: artifact.id,
        mode: artifact.mode,
        content: artifact.content,
        createdAt: artifact.created_at,
        originProjectId: getStringMetadata(artifact.metadata, "originProjectId"),
        originProjectMode: getStringMetadata(artifact.metadata, "originProjectMode"),
        originProjectTitle: getStringMetadata(artifact.metadata, "originProjectTitle"),
      },
      source: "supabase",
      workspaceSource: context.source,
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ error: error.message, fallback: "localStorage" }, { status: 503 });
    }

    if (isRecord(error)) {
      return NextResponse.json({ error: "Erro inesperado ao salvar projeto.", details: error }, { status: 500 });
    }

    return NextResponse.json({ error: "Erro inesperado ao salvar projeto." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);
  const projectId = new URL(request.url).searchParams.get("id");

  if (!projectId) {
    return NextResponse.json({ error: "ID do projeto e obrigatorio." }, { status: 400 });
  }

  if (!isUuid(projectId) || !context) {
    return NextResponse.json({ deleted: true, source: "local-fallback" });
  }

  try {
    const artifactLookup = await supabaseRest<Array<{ id: string; project_id: string | null; mode?: string | null; title?: string | null; metadata?: Record<string, unknown> | null }>>("artifacts", {
      query: [`id=eq.${projectId}`, `workspace_id=eq.${context.workspaceId}`, "select=id,project_id,mode,title,metadata", "limit=1"].join("&"),
    });

    if (artifactLookup.error) {
      return NextResponse.json(
        { error: "Nao foi possivel localizar o artefato.", details: artifactLookup.error },
        { status: artifactLookup.status },
      );
    }

    const artifact = artifactLookup.data?.[0];

    const archivedAt = new Date().toISOString();
    const artifactArchive = await supabaseRest<unknown>("artifacts", {
      method: "PATCH",
      query: [`id=eq.${projectId}`, `workspace_id=eq.${context.workspaceId}`].join("&"),
      body: {
        archived_at: archivedAt,
        archived_by: context.userId,
      },
    });

    if (artifactArchive.error) {
      return NextResponse.json(
        { error: "Nao foi possivel arquivar o artefato.", details: artifactArchive.error },
        { status: artifactArchive.status },
      );
    }

    if (artifact?.project_id) {
      const projectArchive = await supabaseRest<unknown>("projects", {
        method: "PATCH",
        query: [`id=eq.${artifact.project_id}`, `workspace_id=eq.${context.workspaceId}`].join("&"),
        body: {
          archived_at: archivedAt,
          archived_by: context.userId,
        },
      });

      if (projectArchive.error) {
        return NextResponse.json(
          { error: "Artefato arquivado, mas o projeto principal nao foi arquivado.", details: projectArchive.error },
          { status: projectArchive.status },
        );
      }
    }

    await recordAdminAuditEvent({
      workspaceId: context.workspaceId,
      actorUserId: context.userId,
      eventType: "project_artifact_archived",
      targetType: "artifact",
      targetId: projectId,
      metadata: {
        projectId: artifact?.project_id,
        mode: artifact?.mode,
        title: artifact?.title,
        archivedAt,
      },
    });

    return NextResponse.json({ deleted: true, archived: true, source: "supabase", workspaceSource: context.source });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ deleted: true, source: "local-fallback" });
    }

    return NextResponse.json({ error: "Erro inesperado ao remover projeto." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);
  const projectId = new URL(request.url).searchParams.get("id");

  if (!projectId) {
    return NextResponse.json({ error: "ID do projeto e obrigatorio." }, { status: 400 });
  }

  if (!isUuid(projectId) || !context) {
    return NextResponse.json({ error: "Atualizacao server-side indisponivel.", fallback: "localStorage" }, { status: 409 });
  }

  let body: UpdateProjectBody;

  try {
    body = (await request.json()) as UpdateProjectBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido." }, { status: 400 });
  }

  try {
    const artifactLookup = await supabaseRest<Array<{ id: string; project_id: string | null; mode?: string | null; title?: string | null; metadata?: Record<string, unknown> | null }>>("artifacts", {
      query: [`id=eq.${projectId}`, `workspace_id=eq.${context.workspaceId}`, "select=id,project_id,mode,title,metadata", "limit=1"].join("&"),
    });

    if (artifactLookup.error || !artifactLookup.data?.[0]) {
      return NextResponse.json(
        { error: "Nao foi possivel localizar o artefato.", details: artifactLookup.error },
        { status: artifactLookup.status || 404 },
      );
    }

    const artifact = artifactLookup.data[0];

    if (body.action === "restore") {
      if (!canManageWorkspaceMembers(context.role)) {
        return NextResponse.json({ error: "Apenas owners/admins podem restaurar projetos arquivados." }, { status: 403 });
      }

      const artifactRestore = await supabaseRest<SupabaseArtifactRow[]>("artifacts", {
        method: "PATCH",
        query: [`id=eq.${projectId}`, `workspace_id=eq.${context.workspaceId}`].join("&"),
        body: {
          archived_at: null,
          archived_by: null,
        },
      });

      if (artifactRestore.error || !artifactRestore.data?.[0]) {
        return NextResponse.json(
          { error: "Nao foi possivel restaurar o artefato.", details: artifactRestore.error },
          { status: artifactRestore.status },
        );
      }

      if (artifact.project_id) {
        const projectRestore = await supabaseRest<unknown>("projects", {
          method: "PATCH",
          query: [`id=eq.${artifact.project_id}`, `workspace_id=eq.${context.workspaceId}`].join("&"),
          body: {
            archived_at: null,
            archived_by: null,
          },
        });

        if (projectRestore.error) {
          return NextResponse.json(
            { error: "Artefato restaurado, mas projeto principal nao foi restaurado.", details: projectRestore.error },
            { status: projectRestore.status },
          );
        }
      }

      const restoredArtifact = artifactRestore.data[0];

      await recordAdminAuditEvent({
        workspaceId: context.workspaceId,
        actorUserId: context.userId,
        eventType: "project_artifact_restored",
        targetType: "artifact",
        targetId: projectId,
        metadata: {
          projectId: artifact.project_id,
          mode: artifact.mode,
          title: artifact.title,
        },
      });

      return NextResponse.json({
        project: {
          id: restoredArtifact.id,
          mode: restoredArtifact.mode,
          content: restoredArtifact.content,
          createdAt: restoredArtifact.created_at,
          originProjectId: getStringMetadata(restoredArtifact.metadata, "originProjectId"),
          originProjectMode: getStringMetadata(restoredArtifact.metadata, "originProjectMode"),
          originProjectTitle: getStringMetadata(restoredArtifact.metadata, "originProjectTitle"),
        },
        restored: true,
        source: "supabase",
        workspaceSource: context.source,
      });
    }

    if (!body.content || body.content.trim().length === 0) {
      return NextResponse.json({ error: "Conteudo do projeto e obrigatorio." }, { status: 400 });
    }

    const mode = normalizeProjectMode(body.mode ?? "campanha");
    const content = body.content.trim();
    const title = getProjectTitle(content);
    const objective = getProjectObjective(content);

    const artifactUpdate = await supabaseRest<SupabaseArtifactRow[]>("artifacts", {
      method: "PATCH",
      query: [`id=eq.${projectId}`, `workspace_id=eq.${context.workspaceId}`].join("&"),
      body: {
        type: detectArtifactType(mode),
        mode,
        title,
        content,
        metadata: {
          ...(artifact.metadata ?? {}),
          source: "project_detail_edit",
          workspaceSource: context.source,
        },
      },
    });

    if (artifactUpdate.error || !artifactUpdate.data?.[0]) {
      return NextResponse.json(
        { error: "Nao foi possivel atualizar o artefato.", details: artifactUpdate.error },
        { status: artifactUpdate.status },
      );
    }

    if (artifact.project_id) {
      const projectUpdate = await supabaseRest<unknown>("projects", {
        method: "PATCH",
        query: [`id=eq.${artifact.project_id}`, `workspace_id=eq.${context.workspaceId}`].join("&"),
        body: {
          title,
          objective,
          mode,
          metadata: {
            ...(artifact.metadata ?? {}),
            lastEditedFrom: "project_detail",
            workspaceSource: context.source,
          },
        },
      });

      if (projectUpdate.error) {
        return NextResponse.json(
          { error: "Artefato atualizado, mas o projeto principal nao foi atualizado.", details: projectUpdate.error },
          { status: projectUpdate.status },
        );
      }
    }

    const updatedArtifact = artifactUpdate.data[0];

    return NextResponse.json({
      project: {
        id: updatedArtifact.id,
        mode: updatedArtifact.mode,
        content: updatedArtifact.content,
        createdAt: updatedArtifact.created_at,
      },
      source: "supabase",
      workspaceSource: context.source,
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ error: error.message, fallback: "localStorage" }, { status: 503 });
    }

    return NextResponse.json({ error: "Erro inesperado ao atualizar projeto." }, { status: 500 });
  }
}


