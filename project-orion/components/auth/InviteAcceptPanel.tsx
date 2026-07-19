"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, MailCheck, ShieldCheck, UserPlus } from "lucide-react";

import { loadVendiaosSession, persistVendiaosSession, VENDIAOS_AUTH_CHANGED_EVENT, type VendiaosAuthSession } from "./auth-client";
import { getAuthHeaders } from "./auth-fetch";

interface InviteAcceptPanelProps {
  token: string;
}

interface InviteWorkspace {
  id: string;
  name: string;
  slug: string;
  role?: "owner" | "admin" | "member";
}

interface InviteInfo {
  id: string;
  email: string;
  role: "admin" | "member";
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  workspace: InviteWorkspace | null;
}

interface InviteResponse {
  invite?: InviteInfo;
  workspace?: InviteWorkspace | null;
  user?: VendiaosAuthSession["user"];
  expired?: boolean;
  error?: string;
}

function formatDate(value?: string) {
  if (!value) {
    return "Sem data";
  }

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function InviteAcceptPanel({ token }: InviteAcceptPanelProps) {
  const [session, setSession] = useState<VendiaosAuthSession | null>(null);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadInvite = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/workspace/invites/accept?token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as InviteResponse;

      if (!response.ok || !data.invite) {
        setInvite(null);
        setError(data.error ?? "Convite nao encontrado.");
        return;
      }

      setInvite(data.invite);
      if (data.expired) {
        setError("Este convite esta expirado.");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar convite.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

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
    queueMicrotask(() => {
      void loadInvite();
    });
  }, [loadInvite]);

  async function acceptInvite() {
    setIsAccepting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/workspace/invites/accept?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = (await response.json()) as InviteResponse;

      if (!response.ok || !data.workspace || !data.user) {
        setError(data.error ?? "Nao foi possivel aceitar convite.");
        return;
      }

      const currentSession = loadVendiaosSession();

      if (currentSession) {
        persistVendiaosSession({
          ...currentSession,
          user: data.user,
          workspace: {
            id: data.workspace.id,
            name: data.workspace.name,
            slug: data.workspace.slug,
            role: data.workspace.role ?? invite?.role ?? "member",
          },
        });
      }

      setInvite(data.invite ?? invite);
      setMessage("Convite aceito. Workspace conectado ao seu VendIAOS.");
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Nao foi possivel aceitar convite.");
    } finally {
      setIsAccepting(false);
    }
  }

  const emailMatches = Boolean(session?.user.email && invite?.email && session.user.email.toLowerCase() === invite.email.toLowerCase());
  const canAccept = Boolean(session && invite?.status === "pending" && emailMatches && !error);

  return (
    <main className="flex min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto flex w-full max-w-4xl flex-col justify-center">
        <Link href="/login" className="mb-6 inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-white">
          <ArrowLeft size={16} />
          Login / criar conta
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white p-6 text-slate-950 shadow-2xl md:p-8">
          <div className="mb-5 flex w-fit items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            <MailCheck size={16} />
            Convite VendIAOS
          </div>

          {isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto animate-spin text-blue-700" size={28} />
              <h1 className="mt-4 text-2xl font-bold">Carregando convite</h1>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold tracking-tight">Entrar em um workspace</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Aceite o convite usando exatamente o email convidado. Depois disso o VendIAOS troca seu workspace ativo para o ambiente recebido.
              </p>

              {invite && (
                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Workspace</p>
                    <p className="mt-2 truncate text-sm font-bold text-slate-950">{invite.workspace?.name ?? "Workspace VendIAOS"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Email convidado</p>
                    <p className="mt-2 truncate text-sm font-bold text-slate-950">{invite.email}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Perfil</p>
                    <p className="mt-2 text-sm font-bold capitalize text-slate-950">{invite.role}</p>
                  </div>
                </div>
              )}

              {invite && (
                <div className="mt-5 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-600">
                  Status: <span className="text-slate-950">{invite.status}</span>
                  <span className="mx-2 text-slate-300">|</span>
                  Expira: <span className="text-slate-950">{formatDate(invite.expiresAt)}</span>
                </div>
              )}

              {!session && (
                <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-700">
                  Entre ou crie conta antes de aceitar este convite.
                </div>
              )}

              {session && invite && !emailMatches && (
                <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                  Sessao atual: {session.user.email}. Este convite e para {invite.email}.
                </div>
              )}

              {error && <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
              {message && <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div>}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void acceptInvite()}
                  disabled={!canAccept || isAccepting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isAccepting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  Aceitar convite
                </button>

                <Link
                  href="/settings"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <ShieldCheck size={16} />
                  Ir para configuracoes
                </Link>

                {message && (
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <CheckCircle2 size={16} />
                    Abrir VendIAOS
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
