"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, RotateCcw, Zap } from "lucide-react";

import { AgentRunHealth, loadAgentRunHealth } from "@/components/ai/lib/agent-runs-client";

function formatDate(value: string | null) {
  if (!value) {
    return "Sem registros";
  }

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

export default function AgentQueueHealthPanel() {
  const [health, setHealth] = useState<AgentRunHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const refreshHealth = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true);
    }

    const result = await loadAgentRunHealth();
    setHealth(result);
    setIsLoading(false);
    setLastUpdatedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshHealth();
    });
  }, [refreshHealth]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshHealth({ silent: true });
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [refreshHealth]);

  const cards = useMemo(() => {
    const statusCounts = health?.statusCounts;

    return [
      {
        label: "Pendentes",
        value: (statusCounts?.queued ?? 0) + (statusCounts?.sent_to_studio ?? 0),
        icon: Clock3,
        tone: "bg-blue-50 text-blue-700",
      },
      {
        label: "Rodando",
        value: statusCounts?.running ?? 0,
        icon: Zap,
        tone: "bg-amber-50 text-amber-700",
      },
      {
        label: "Travadas",
        value: health?.stuckCount ?? 0,
        icon: AlertTriangle,
        tone: "bg-red-50 text-red-700",
      },
      {
        label: "Retries prontos",
        value: health?.retryReadyCount ?? 0,
        icon: RotateCcw,
        tone: "bg-purple-50 text-purple-700",
      },
      {
        label: "Concluidas",
        value: statusCounts?.completed ?? 0,
        icon: CheckCircle2,
        tone: "bg-emerald-50 text-emerald-700",
      },
    ];
  }, [health]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            <Activity size={14} />
            Saude da fila
          </div>
          <h2 className="mt-3 text-lg font-semibold text-slate-950">Operacao dos agentes</h2>
          <p className="mt-1 text-sm text-slate-500">
            Visao rapida de capacidade, riscos e progresso da fila do VendIAOS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            {health?.source === "supabase" ? "Supabase" : "Local"}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            Ultima: {formatDate(health?.latestRunAt ?? null)}
          </span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
            Auto 15s{lastUpdatedAt ? ` - ${formatDate(lastUpdatedAt)}` : ""}
          </span>
          <button
            type="button"
            onClick={() => void refreshHealth()}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {isLoading ? "Atualizando" : "Atualizar saude"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <article key={card.label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.tone}`}>
                <Icon size={17} />
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-400">{card.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{card.value}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total analisado</p>
          <p className="mt-1 text-lg font-bold text-slate-950">{health?.total ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Ativas</p>
          <p className="mt-1 text-lg font-bold text-slate-950">{health?.activeRuns ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Taxa concluida</p>
          <p className="mt-1 text-lg font-bold text-slate-950">{health?.completedRate ?? 0}%</p>
        </div>
      </div>
    </section>
  );
}
