"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Database,
  KeyRound,
  Loader2,
  Server,
  UsersRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";

type ServiceStatus = "ready" | "missing";

interface HealthResponse {
  services: {
    openai: ServiceStatus;
    supabase: {
      url: ServiceStatus;
      anonKey: ServiceStatus;
      serviceRole: ServiceStatus;
      ready: boolean;
    };
    bootstrap: {
      workspaceId: ServiceStatus;
      userId: ServiceStatus;
      ready: boolean;
    };
  };
}

interface StatusCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  status?: ServiceStatus | boolean;
  details?: Array<{
    label: string;
    status?: ServiceStatus | boolean;
  }>;
}

function getReady(status?: ServiceStatus | boolean) {
  if (typeof status === "boolean") {
    return status;
  }

  return status === "ready";
}

function StatusCard({ title, description, icon: Icon, status, details = [] }: StatusCardProps) {
  const isLoading = status === undefined;
  const isReady = getReady(status);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
            <Icon className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>

            {details.length > 0 && (
              <div className="mt-4 space-y-2">
                {details.map((detail) => {
                  const detailReady = getReady(detail.status);

                  return (
                    <div key={detail.label} className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      {detail.status === undefined ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                      ) : detailReady ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-amber-600" />
                      )}
                      {detail.label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            isLoading
              ? "bg-slate-100 text-slate-500"
              : isReady
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isReady ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          {isLoading ? "Verificando" : isReady ? "Pronto" : "Pendente"}
        </div>
      </div>
    </div>
  );
}

export default function SystemStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadHealth() {
      try {
        const response = await fetch("/api/system/health", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Nao foi possivel verificar o status do sistema.");
        }

        const data = (await response.json()) as HealthResponse;

        if (isMounted) {
          setHealth(data);
        }
      } catch {
        if (isMounted) {
          setHealth({
            services: {
              openai: "missing",
              supabase: {
                url: "missing",
                anonKey: "missing",
                serviceRole: "missing",
                ready: false,
              },
              bootstrap: {
                workspaceId: "missing",
                userId: "missing",
                ready: false,
              },
            },
          });
        }
      }
    }

    loadHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="grid gap-4 lg:grid-cols-4">
      <StatusCard
        title="OpenAI"
        description="Rota server-side ativa para gerar respostas reais no AI Studio sem expor a chave no frontend."
        icon={KeyRound}
        status={health?.services.openai}
        details={[
          {
            label: "OPENAI_API_KEY",
            status: health?.services.openai,
          },
        ]}
      />

      <StatusCard
        title="Supabase publico"
        description="URL e chave anonima para leitura segura no cliente quando a autenticacao for ativada."
        icon={Database}
        status={
          health
            ? health.services.supabase.url === "ready" &&
              health.services.supabase.anonKey === "ready"
            : undefined
        }
        details={[
          {
            label: "NEXT_PUBLIC_SUPABASE_URL",
            status: health?.services.supabase.url,
          },
          {
            label: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
            status: health?.services.supabase.anonKey,
          },
        ]}
      />

      <StatusCard
        title="Supabase server-side"
        description="Service role reservada para rotas internas, persistencia de projetos e operacoes protegidas."
        icon={Server}
        status={health?.services.supabase.ready}
        details={[
          {
            label: "SUPABASE_SERVICE_ROLE_KEY",
            status: health?.services.supabase.serviceRole,
          },
        ]}
      />

      <StatusCard
        title="Workspace inicial"
        description="IDs temporarios usados para salvar projetos no banco antes da autenticacao completa."
        icon={UsersRound}
        status={health?.services.bootstrap.ready}
        details={[
          {
            label: "VENDIAOS_DEFAULT_WORKSPACE_ID",
            status: health?.services.bootstrap.workspaceId,
          },
          {
            label: "VENDIAOS_DEFAULT_USER_ID",
            status: health?.services.bootstrap.userId,
          },
        ]}
      />
    </section>
  );
}
