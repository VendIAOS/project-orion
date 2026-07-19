"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  History,
  RefreshCcw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { AgentRunCycle, loadSyncedAgentRunCycles } from "@/components/ai/lib/agent-runs-client";
import OperationalContextPanel from "@/components/auth/OperationalContextPanel";

type ModeFilter = "todos" | "manual" | "automatic";
type StatusFilter = "todos" | "completed" | "skipped" | "failed";
type PeriodFilter = "todos" | "24h" | "7d";

const MODE_FILTERS: ModeFilter[] = ["todos", "manual", "automatic"];
const STATUS_FILTERS: StatusFilter[] = ["todos", "completed", "skipped", "failed"];
const PERIOD_FILTERS: PeriodFilter[] = ["todos", "24h", "7d"];

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

function getModeLabel(mode: ModeFilter) {
  const labels: Record<ModeFilter, string> = {
    todos: "Todos",
    manual: "Manual",
    automatic: "Automatico",
  };

  return labels[mode];
}

function getStatusLabel(status: StatusFilter) {
  const labels: Record<StatusFilter, string> = {
    todos: "Todos",
    completed: "Concluidos",
    skipped: "Ignorados",
    failed: "Falhas",
  };

  return labels[status];
}

function getPeriodLabel(period: PeriodFilter) {
  const labels: Record<PeriodFilter, string> = {
    todos: "Todo periodo",
    "24h": "24h",
    "7d": "7 dias",
  };

  return labels[period];
}

function isInsidePeriod(cycle: AgentRunCycle, period: PeriodFilter) {
  if (period === "todos") {
    return true;
  }

  const createdAt = new Date(cycle.createdAt).getTime();
  const now = Date.now();
  const windowMs = period === "24h" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

  return now - createdAt <= windowMs;
}

function getStatusClasses(status: AgentRunCycle["status"]) {
  const classes: Record<AgentRunCycle["status"], string> = {
    completed: "bg-emerald-50 text-emerald-700",
    skipped: "bg-amber-50 text-amber-700",
    failed: "bg-red-50 text-red-700",
  };

  return classes[status];
}

export default function OperationalAuditDashboard() {
  const [cycles, setCycles] = useState<AgentRunCycle[]>([]);
  const [source, setSource] = useState<"local" | "supabase">("local");
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("todos");

  async function refreshCycles() {
    setIsLoading(true);
    const result = await loadSyncedAgentRunCycles();
    setCycles(result.cycles);
    setSource(result.source);
    setIsLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      void refreshCycles();
    });
  }, []);

  const filteredCycles = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return cycles.filter((cycle) => {
      const matchesMode = modeFilter === "todos" || cycle.mode === modeFilter;
      const matchesStatus = statusFilter === "todos" || cycle.status === statusFilter;
      const matchesPeriod = isInsidePeriod(cycle, periodFilter);
      const matchesQuery = !cleanQuery || `${cycle.mode} ${cycle.status} ${cycle.message}`.toLowerCase().includes(cleanQuery);

      return matchesMode && matchesStatus && matchesPeriod && matchesQuery;
    });
  }, [cycles, modeFilter, periodFilter, query, statusFilter]);

  const metrics = useMemo(() => {
    return {
      total: filteredCycles.length,
      completed: filteredCycles.filter((cycle) => cycle.status === "completed").length,
      failed: filteredCycles.filter((cycle) => cycle.status === "failed").length,
      automatic: filteredCycles.filter((cycle) => cycle.mode === "automatic").length,
      locks: filteredCycles.reduce((sum, cycle) => sum + cycle.cleanupCount, 0),
      processed: filteredCycles.reduce((sum, cycle) => sum + cycle.processCount, 0),
    };
  }, [filteredCycles]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            <ShieldCheck size={16} />
            Auditoria operacional
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Ciclos dos agentes</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Analise ciclos manuais e automaticos da fila, com filtros para investigar operacao, falhas e produtividade.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <span className="font-semibold text-slate-900">{isLoading ? "..." : cycles.length}</span> ciclos
          <span className="ml-3 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
            {source === "supabase" ? "Supabase" : "Local"}
          </span>
        </div>
      </header>

      <OperationalContextPanel source={source} />

      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Filtrados", value: metrics.total, icon: History, tone: "bg-blue-50 text-blue-700" },
          { label: "Concluidos", value: metrics.completed, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Falhas", value: metrics.failed, icon: XCircle, tone: "bg-red-50 text-red-700" },
          { label: "Automaticos", value: metrics.automatic, icon: Activity, tone: "bg-purple-50 text-purple-700" },
          { label: "Locks limpos", value: metrics.locks, icon: RefreshCcw, tone: "bg-amber-50 text-amber-700" },
          { label: "Processadas", value: metrics.processed, icon: CalendarClock, tone: "bg-slate-100 text-slate-700" },
        ].map((metric) => {
          const Icon = metric.icon;

          return (
            <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${metric.tone}`}>
                <Icon size={17} />
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-400">{metric.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{metric.value}</p>
            </article>
          );
        })}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <Search size={18} className="text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por mensagem, modo ou status..."
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>

          <button
            type="button"
            onClick={() => void refreshCycles()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            <RefreshCcw size={14} />
            Atualizar
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {MODE_FILTERS.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setModeFilter(mode)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                modeFilter === mode ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {getModeLabel(mode)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                statusFilter === status ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {getStatusLabel(status)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {PERIOD_FILTERS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setPeriodFilter(period)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                periodFilter === period ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {getPeriodLabel(period)}
            </button>
          ))}
        </div>
      </section>

      {isLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">Carregando auditoria</h2>
          <p className="mt-2 text-sm text-slate-500">Buscando ciclos operacionais persistidos.</p>
        </section>
      ) : filteredCycles.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">Nenhum ciclo encontrado</h2>
          <p className="mt-2 text-sm text-slate-500">Ajuste os filtros ou rode um ciclo na Central de Execucoes.</p>
        </section>
      ) : (
        <section className="grid gap-3">
          {filteredCycles.map((cycle) => (
            <article key={cycle.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {cycle.mode === "automatic" ? "Automatico" : "Manual"}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(cycle.status)}`}>
                      {cycle.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{cycle.message}</p>
                  <p className="mt-2 text-xs font-medium text-slate-400">{formatDate(cycle.createdAt)}</p>
                </div>

                <div className="grid shrink-0 grid-cols-2 gap-2 text-xs md:w-64">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="font-semibold uppercase tracking-widest text-slate-400">Locks</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{cycle.cleanupCount}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="font-semibold uppercase tracking-widest text-slate-400">Execucoes</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{cycle.processCount}</p>
                  </div>
                  <Link
                    href={`/audit/${encodeURIComponent(cycle.id)}`}
                    className="col-span-2 inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                  >
                    Ver detalhe
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

