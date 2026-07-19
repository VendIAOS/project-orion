import { NextResponse } from "next/server";

import {
  canManageWorkspaceBilling,
  canManageWorkspaceMembers,
  canOperateAgentRuns,
  getWorkspaceContextFromRequest,
} from "@/lib/auth-workspace-context";
import { supabaseRest } from "@/lib/supabase-rest";

type SmokeStatus = "passed" | "warning" | "failed";

interface CountRow {
  count?: number;
}

interface SmokeCheck {
  id: string;
  title: string;
  status: SmokeStatus;
  detail: string;
  durationMs: number;
}

async function measureCheck(id: string, title: string, run: () => Promise<Omit<SmokeCheck, "id" | "title" | "durationMs">>): Promise<SmokeCheck> {
  const startedAt = Date.now();

  try {
    const result = await run();

    return {
      id,
      title,
      durationMs: Date.now() - startedAt,
      ...result,
    };
  } catch (error) {
    return {
      id,
      title,
      status: "failed",
      detail: String(error),
      durationMs: Date.now() - startedAt,
    };
  }
}

async function countRows(table: string, query: string) {
  const result = await supabaseRest<CountRow[]>(table, {
    query: `${query}&select=count`,
  });

  if (result.error) {
    throw new Error(String(result.error));
  }

  return Number(result.data?.[0]?.count ?? 0);
}

function getOverallStatus(checks: SmokeCheck[]): SmokeStatus {
  if (checks.some((check) => check.status === "failed")) {
    return "failed";
  }

  if (checks.some((check) => check.status === "warning")) {
    return "warning";
  }

  return "passed";
}

export async function GET(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  const checks = await Promise.all([
    measureCheck("openai_env", "OpenAI configurada", async () => {
      const ready = Boolean(process.env.OPENAI_API_KEY?.trim());

      return {
        status: ready ? "passed" : "failed",
        detail: ready ? "OPENAI_API_KEY presente no servidor." : "OPENAI_API_KEY ausente no servidor.",
      };
    }),
    measureCheck("workspace_context", "Workspace operacional", async () => {
      if (!context) {
        return {
          status: "failed",
          detail: "Contexto de workspace ausente.",
        };
      }

      return {
        status: "passed",
        detail: `Workspace ativo via ${context.source}. Papel: ${context.role ?? "owner-local"}.`,
      };
    }),
    measureCheck("permissions", "Permissoes criticas", async () => {
      if (!context) {
        return {
          status: "failed",
          detail: "Sem contexto para calcular permissoes.",
        };
      }

      const canOperate = canOperateAgentRuns(context.role);
      const canManageBilling = canManageWorkspaceBilling(context.role);
      const canManageMembers = canManageWorkspaceMembers(context.role);

      return {
        status: canOperate && canManageBilling && canManageMembers ? "passed" : "warning",
        detail: `Operar agentes: ${canOperate ? "sim" : "nao"}; billing: ${canManageBilling ? "sim" : "nao"}; membros/auditoria: ${canManageMembers ? "sim" : "nao"}.`,
      };
    }),
    measureCheck("projects_table", "Persistencia de projetos", async () => {
      if (!context) {
        return {
          status: "failed",
          detail: "Sem workspace para consultar projetos.",
        };
      }

      const count = await countRows("artifacts", `workspace_id=eq.${context.workspaceId}`);

      return {
        status: "passed",
        detail: `${count} artefato(s) acessivel(is) no Supabase.`,
      };
    }),
    measureCheck("agent_runs_table", "Fila de agentes", async () => {
      if (!context) {
        return {
          status: "failed",
          detail: "Sem workspace para consultar execucoes.",
        };
      }

      const count = await countRows("agent_runs", `workspace_id=eq.${context.workspaceId}`);

      return {
        status: "passed",
        detail: `${count} execucao(oes) acessivel(is) no Supabase.`,
      };
    }),
    measureCheck("billing_table", "Billing", async () => {
      if (!context) {
        return {
          status: "failed",
          detail: "Sem workspace para consultar billing.",
        };
      }

      const count = await countRows("workspace_billing", `workspace_id=eq.${context.workspaceId}`);

      return {
        status: count > 0 ? "passed" : "warning",
        detail: count > 0 ? "Registro de billing encontrado." : "Sem registro de billing; usando fallback Starter.",
      };
    }),
    measureCheck("admin_audit_table", "Auditoria administrativa", async () => {
      if (!context) {
        return {
          status: "failed",
          detail: "Sem workspace para consultar auditoria.",
        };
      }

      if (!canManageWorkspaceMembers(context.role)) {
        return {
          status: "warning",
          detail: "Usuario atual nao pode consultar auditoria administrativa.",
        };
      }

      const count = await countRows("admin_audit_events", `workspace_id=eq.${context.workspaceId}`);

      return {
        status: "passed",
        detail: `${count} evento(s) de auditoria acessivel(is).`,
      };
    }),
  ]);

  return NextResponse.json({
    source: context ? "supabase" : "local-fallback",
    status: getOverallStatus(checks),
    passed: checks.filter((check) => check.status === "passed").length,
    warning: checks.filter((check) => check.status === "warning").length,
    failed: checks.filter((check) => check.status === "failed").length,
    checks,
    generatedAt: new Date().toISOString(),
  });
}
