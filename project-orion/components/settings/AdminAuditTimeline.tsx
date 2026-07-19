"use client";

import { useEffect, useState } from "react";
import { History, RefreshCcw, ShieldCheck } from "lucide-react";

import { getAuthHeaders } from "@/components/auth/auth-fetch";

interface AdminAuditEvent {
  id: string;
  event_type: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AdminAuditResponse {
  events?: AdminAuditEvent[];
  source?: "supabase" | "local-fallback";
  reason?: string;
  error?: string;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatEventType(value: string) {
  if (value === "project_artifact_archived") {
    return "Projeto arquivado";
  }

  if (value === "project_artifact_restored") {
    return "Projeto restaurado";
  }

  return value.replace(/^workspace_/, "").replace(/_/g, " ");
}

function getMetadataLabel(metadata: Record<string, unknown> | null) {
  const email = metadata?.email;
  const role = metadata?.role;

  if (typeof email === "string" && typeof role === "string") {
    return `${email} - ${role}`;
  }

  if (typeof email === "string") {
    return email;
  }

  return "Evento administrativo";
}

export default function AdminAuditTimeline() {
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<"supabase" | "local-fallback">("local-fallback");

  async function refreshAudit() {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin-audit", {
        headers: getAuthHeaders(),
        cache: "no-store",
      });
      const data = (await response.json()) as AdminAuditResponse;

      setEvents(data.events ?? []);
      setSource(data.source ?? "local-fallback");
      setMessage(data.reason ?? data.error ?? "");
    } catch (error) {
      setEvents([]);
      setSource("local-fallback");
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar auditoria.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void refreshAudit();
    });
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-3 flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            <ShieldCheck size={14} />
            Auditoria
          </div>
          <h2 className="text-xl font-bold text-slate-950">Timeline administrativa</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Registro recente de acoes sensiveis no workspace, como criacao, renovacao e revogacao de convites.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshAudit()}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <RefreshCcw size={14} className={isLoading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {message && (
        <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{message}</p>
      )}

      <div className="mt-5 rounded-xl border border-slate-200">
        {isLoading ? (
          <div className="p-6 text-sm font-semibold text-slate-500">Carregando auditoria...</div>
        ) : events.length === 0 ? (
          <div className="p-6 text-sm font-semibold text-slate-500">
            Nenhum evento administrativo registrado ainda.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {events.slice(0, 12).map((event) => (
              <article key={event.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <History size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold capitalize text-slate-950">{formatEventType(event.event_type)}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-400">{getMetadataLabel(event.metadata)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {event.target_type}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {formatDate(event.created_at)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs font-semibold text-slate-400">
        Persistencia: {source === "supabase" ? "Supabase ativo" : "Fallback local"}
      </p>
    </section>
  );
}
