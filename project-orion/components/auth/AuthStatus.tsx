"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, LogIn, LogOut, UserRound } from "lucide-react";

import {
  loadVendiaosSession,
  signOutVendiaos,
  syncAuthenticatedWorkspace,
  VENDIAOS_AUTH_CHANGED_EVENT,
  type VendiaosAuthSession,
} from "./auth-client";

export default function AuthStatus() {
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

  useEffect(() => {
    if (session && !session.workspace) {
      void syncAuthenticatedWorkspace().catch(() => undefined);
    }
  }, [session]);

  if (!session) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
      >
        <LogIn size={14} />
        Entrar
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 lg:flex">
        <BriefcaseBusiness size={14} />
        {session.workspace?.name ?? "Sincronizando workspace"}
      </div>
      <div className="hidden items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 md:flex">
        <UserRound size={14} />
        {session.user.email ?? "Sessao ativa"}
      </div>
      <button
        type="button"
        onClick={() => void signOutVendiaos()}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
      >
        <LogOut size={14} />
        Sair
      </button>
    </div>
  );
}
