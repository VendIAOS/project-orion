"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, Check, Copy, MailPlus, RefreshCcw, RotateCcw, Send, ShieldCheck, UserRound, UsersRound } from "lucide-react";

import { getAuthHeaders } from "@/components/auth/auth-fetch";
import { loadVendiaosSession, VENDIAOS_AUTH_CHANGED_EVENT, type VendiaosAuthSession } from "@/components/auth/auth-client";

type WorkspaceMemberRole = "owner" | "admin" | "member";
type InviteRole = "admin" | "member";

interface WorkspaceMember {
  id: string;
  userId: string;
  role: WorkspaceMemberRole;
  createdAt: string | null;
  isCurrentUser: boolean;
}

interface WorkspaceMembersResponse {
  members?: WorkspaceMember[];
  source?: "supabase" | "local-fallback";
  role?: WorkspaceMemberRole;
  permissions?: {
    role: WorkspaceMemberRole | "bootstrap";
    canManageMembers: boolean;
  };
  reason?: string;
  error?: string;
}

interface WorkspaceInvite {
  id: string;
  email: string;
  role: InviteRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  acceptPath?: string;
  expiresAt: string;
  createdAt: string;
}

interface WorkspaceInvitesResponse {
  invites?: WorkspaceInvite[];
  canManage?: boolean;
  permissions?: {
    role: WorkspaceMemberRole | "bootstrap";
    canManageMembers: boolean;
  };
  source?: "supabase" | "local-fallback";
  reason?: string;
  error?: string;
}

const ROLE_LABELS: Record<WorkspaceMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Membro",
};

function formatDate(value: string | null) {
  if (!value) {
    return "Sem data";
  }

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function WorkspaceMembers() {
  const [session, setSession] = useState<VendiaosAuthSession | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [canManageInvites, setCanManageInvites] = useState(false);
  const [currentRole, setCurrentRole] = useState<WorkspaceMemberRole | "bootstrap" | null>(null);
  const [source, setSource] = useState<"supabase" | "local-fallback">("local-fallback");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("member");
  const [inviteMessage, setInviteMessage] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  async function refreshMembers() {
    setIsLoading(true);
    setMessage("");

    try {
      const [membersResponse, invitesResponse] = await Promise.all([
        fetch("/api/workspace/members", {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
        fetch("/api/workspace/invites", {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
      ]);
      const data = (await membersResponse.json()) as WorkspaceMembersResponse;
      const invitesData = (await invitesResponse.json()) as WorkspaceInvitesResponse;

      setMembers(data.members ?? []);
      setInvites(invitesData.invites ?? []);
      setCanManageInvites(Boolean(invitesData.permissions?.canManageMembers ?? data.permissions?.canManageMembers ?? invitesData.canManage));
      setCurrentRole(invitesData.permissions?.role ?? data.permissions?.role ?? data.role ?? null);
      setSource(data.source ?? "local-fallback");
      setMessage(data.reason ?? data.error ?? invitesData.reason ?? invitesData.error ?? "");
    } catch (error) {
      setMembers([]);
      setInvites([]);
      setCanManageInvites(false);
      setCurrentRole(null);
      setSource("local-fallback");
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar membros.");
    } finally {
      setIsLoading(false);
    }
  }

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

  async function createInvite() {
    const email = inviteEmail.trim().toLowerCase();

    if (!email) {
      setInviteMessage("Informe um email para convidar.");
      return;
    }

    setIsInviting(true);
    setInviteMessage("");

    try {
      const response = await fetch("/api/workspace/invites", {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          email,
          role: inviteRole,
        }),
      });
      const data = (await response.json()) as { invite?: WorkspaceInvite; error?: string; reused?: boolean };

      if (!response.ok || !data.invite) {
        setInviteMessage(data.error ?? "Nao foi possivel criar convite.");
        return;
      }

      setInviteEmail("");
      setInviteMessage(data.reused ? "Convite pendente ja existia para este email." : "Convite criado com sucesso.");
      await refreshMembers();
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : "Nao foi possivel criar convite.");
    } finally {
      setIsInviting(false);
    }
  }

  async function copyInviteLink(invite: WorkspaceInvite) {
    if (!invite.acceptPath) {
      setInviteMessage("Link do convite ainda nao esta disponivel.");
      return;
    }

    const url = `${window.location.origin}${invite.acceptPath}`;
    await navigator.clipboard.writeText(url);
    setCopiedInviteId(invite.id);
    window.setTimeout(() => setCopiedInviteId(null), 1800);
  }

  async function updateInvite(invite: WorkspaceInvite, action: "revoke" | "renew") {
    setInviteMessage(action === "revoke" ? "Revogando convite..." : "Renovando convite...");

    try {
      const response = await fetch("/api/workspace/invites", {
        method: "PATCH",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          inviteId: invite.id,
          action,
        }),
      });
      const data = (await response.json()) as { invite?: WorkspaceInvite; error?: string };

      if (!response.ok || !data.invite) {
        setInviteMessage(data.error ?? "Nao foi possivel atualizar convite.");
        return;
      }

      setInviteMessage(action === "revoke" ? "Convite revogado." : "Convite renovado com novo link.");
      await refreshMembers();
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar convite.");
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void refreshMembers();
    });
  }, []);

  const roleCounts = useMemo(() => {
    return {
      owner: members.filter((member) => member.role === "owner").length,
      admin: members.filter((member) => member.role === "admin").length,
      member: members.filter((member) => member.role === "member").length,
    };
  }, [members]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-3 flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            <UsersRound size={14} />
            Workspace
          </div>
          <h2 className="text-xl font-bold text-slate-950">Membros do workspace</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Controle operacional de usuarios vinculados ao ambiente ativo, convites pendentes e permissoes iniciais.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshMembers()}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <RefreshCcw size={14} className={isLoading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-blue-800">
          <MailPlus size={17} />
          Convidar membro
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="email@empresa.com"
            disabled={!canManageInvites || isInviting}
            className="rounded-lg border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
          <select
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value as InviteRole)}
            disabled={!canManageInvites || isInviting}
            className="rounded-lg border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <option value="member">Membro</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="button"
            onClick={() => void createInvite()}
            disabled={!canManageInvites || isInviting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Send size={14} />
            {isInviting ? "Convidando" : "Convidar"}
          </button>
        </div>
        <p className="mt-3 text-xs font-semibold text-blue-700">
          {canManageInvites
            ? inviteMessage || "Owners e admins podem criar convites. O envio de email automatico entra quando integrarmos provedor transacional."
            : "Apenas owners e admins podem criar convites."}
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Workspace</p>
          <p className="mt-2 truncate text-sm font-bold text-slate-950">{session?.workspace?.name ?? "Sincronizando"}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Seu papel</p>
          <p className="mt-2 text-sm font-bold text-slate-950">
            {currentRole === "bootstrap" ? "Owner local" : currentRole ? ROLE_LABELS[currentRole] : "Sincronizando"}
          </p>
          <p className={`mt-1 text-xs font-semibold ${canManageInvites ? "text-emerald-700" : "text-amber-700"}`}>
            {canManageInvites ? "Pode gerenciar convites" : "Somente visualizacao"}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Owners</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{roleCounts.owner}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Admins</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{roleCounts.admin}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Membros</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{roleCounts.member}</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200">
        {isLoading ? (
          <div className="p-6 text-sm font-semibold text-slate-500">Carregando membros...</div>
        ) : members.length === 0 ? (
          <div className="p-6 text-sm font-semibold text-slate-500">
            Nenhum membro retornado. {message || "Verifique a configuracao do Supabase."}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {members.map((member) => (
              <article key={member.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <UserRound size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">
                      {member.isCurrentUser ? session?.user.email ?? member.userId : member.userId}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-400">Entrada: {formatDate(member.createdAt)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {member.isCurrentUser && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Voce
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    <ShieldCheck size={13} />
                    {ROLE_LABELS[member.role]}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-slate-200">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Convites pendentes</p>
        </div>
        {invites.length === 0 ? (
          <div className="p-6 text-sm font-semibold text-slate-500">
            Nenhum convite pendente encontrado.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {invites.map((invite) => (
              <article key={invite.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{invite.email}</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">Expira em: {formatDate(invite.expiresAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {ROLE_LABELS[invite.role]}
                  </span>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    {invite.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyInviteLink(invite)}
                    disabled={invite.status !== "pending"}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                  >
                    {copiedInviteId === invite.id ? <Check size={13} /> : <Copy size={13} />}
                    {copiedInviteId === invite.id ? "Copiado" : "Copiar link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateInvite(invite, "renew")}
                    disabled={!canManageInvites}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <RotateCcw size={13} />
                    Renovar
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateInvite(invite, "revoke")}
                    disabled={!canManageInvites || invite.status !== "pending"}
                    className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <Ban size={13} />
                    Revogar
                  </button>
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
