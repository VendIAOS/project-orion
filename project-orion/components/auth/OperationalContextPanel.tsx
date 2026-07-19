"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, Database, ShieldCheck, UserRound } from "lucide-react";

import { loadVendiaosSession, VENDIAOS_AUTH_CHANGED_EVENT, type VendiaosAuthSession } from "./auth-client";

interface OperationalContextPanelProps {
  source?: "local" | "supabase";
}

function getSourceLabel(source?: "local" | "supabase") {
  if (!source) {
    return "Sincronizando";
  }

  return source === "supabase" ? "Supabase" : "Local";
}

export default function OperationalContextPanel({ source }: OperationalContextPanelProps) {
  const [session, setSession] = useState<VendiaosAuthSession | null>(null);

  useEffect(() => {
    function syncSession() {
      setSession(loadVendiaosSession());
    }

    syncSession();
    window.addEventListener(VENDIAOS_AUTH_CHANGED_EVENT, syncSession);
    window.addEventListener("storage", syncSession);

    return () => {
      window.removeEventListener(VENDIAOS_AUTH_CHANGED_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  return (
    <section className="grid gap-3 md:grid-cols-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          <BriefcaseBusiness size={15} />
          Workspace
        </div>
        <p className="mt-2 truncate text-sm font-bold text-slate-950">{session?.workspace?.name ?? "Sincronizando"}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          <ShieldCheck size={15} />
          Perfil
        </div>
        <p className="mt-2 text-sm font-bold capitalize text-slate-950">{session?.workspace?.role ?? "owner"}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          <UserRound size={15} />
          Operador
        </div>
        <p className="mt-2 truncate text-sm font-bold text-slate-950">{session?.user.email ?? "Sessao ativa"}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          <Database size={15} />
          Persistencia
        </div>
        <p className="mt-2 text-sm font-bold text-slate-950">{getSourceLabel(source)}</p>
      </div>
    </section>
  );
}
