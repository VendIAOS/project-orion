"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { LockKeyhole, LogIn, ShieldCheck } from "lucide-react";

import {
  clearVendiaosSession,
  loadVendiaosSession,
  syncAuthenticatedWorkspace,
  VENDIAOS_AUTH_CHANGED_EVENT,
  type VendiaosAuthSession,
} from "./auth-client";

interface AuthGuardProps {
  children: ReactNode;
}

function getValidSession() {
  const session = loadVendiaosSession();

  if (session?.expiresAt && session.expiresAt <= Date.now()) {
    clearVendiaosSession();
    return null;
  }

  return session;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [session, setSession] = useState<VendiaosAuthSession | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");

  useEffect(() => {
    function syncSession() {
      setSession(getValidSession());
      setHasChecked(true);
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
    if (!session || session.workspace) {
      return;
    }

    let isActive = true;

    queueMicrotask(() => {
      void syncAuthenticatedWorkspace()
        .then((nextSession) => {
          if (isActive && nextSession) {
            setSession(nextSession);
            setWorkspaceError("");
          }
        })
        .catch((error: unknown) => {
          if (isActive) {
            setWorkspaceError(error instanceof Error ? error.message : "Nao foi possivel sincronizar workspace.");
          }
        });
    });

    return () => {
      isActive = false;
    };
  }, [session]);

  if (!hasChecked) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <ShieldCheck size={22} />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-950">Verificando sessao</h1>
          <p className="mt-2 text-sm text-slate-500">Preparando acesso seguro ao VendIAOS.</p>
        </div>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <LockKeyhole size={22} />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">Acesso protegido</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Entre com sua conta para acessar o painel operacional, projetos, execucoes, auditorias e configuracoes do VendIAOS.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <LogIn size={16} />
            Entrar no VendIAOS
          </Link>
        </div>
      </section>
    );
  }

  if (!session.workspace && !workspaceError) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <ShieldCheck size={22} />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-950">Sincronizando workspace</h1>
          <p className="mt-2 text-sm text-slate-500">Conectando sua sessao ao ambiente operacional do VendIAOS.</p>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
