"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, ListChecks, RefreshCcw } from "lucide-react";

import {
  AgentRunLog,
  getAgentRunLogLevelClasses,
  loadSyncedAgentRunLogs,
} from "@/components/ai/lib/agent-runs-client";

interface AgentRunLogsTimelineProps {
  runId: string;
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

export default function AgentRunLogsTimeline({ runId }: AgentRunLogsTimelineProps) {
  const [logs, setLogs] = useState<AgentRunLog[]>([]);
  const [source, setSource] = useState<"supabase" | "local">("local");
  const [isLoading, setIsLoading] = useState(true);

  const refreshLogs = useCallback(async () => {
    setIsLoading(true);
    const result = await loadSyncedAgentRunLogs(runId);
    setLogs(result.logs);
    setSource(result.source);
    setIsLoading(false);
  }, [runId]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshLogs();
    });

    function handleLogsUpdated() {
      queueMicrotask(() => {
        void refreshLogs();
      });
    }

    window.addEventListener("vendiaos:agent-run-logs-updated", handleLogsUpdated);
    return () => window.removeEventListener("vendiaos:agent-run-logs-updated", handleLogsUpdated);
  }, [refreshLogs]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-slate-100 p-2 text-slate-700">
            <ListChecks size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Logs da execucao</h2>
            <p className="text-xs text-slate-500">
              Rastro operacional do agente, do disparo ao artefato final.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
            {source === "supabase" ? "Supabase" : "Local"}
          </span>
          <button
            type="button"
            onClick={() => void refreshLogs()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCcw size={14} />
            Atualizar
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Carregando logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Nenhum log registrado para esta execucao ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <article
              key={log.id}
              className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4"
            >
              <span className={`mt-1 rounded-full border p-1 ${getAgentRunLogLevelClasses(log.level)}`}>
                <Clock3 size={13} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-950">{log.event}</span>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getAgentRunLogLevelClasses(log.level)}`}>
                    {log.level}
                  </span>
                  <span className="text-xs text-slate-400">{formatDate(log.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{log.message}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
