"use client";

export interface VendiaosAuthUser {
  id: string;
  email?: string;
}

export interface VendiaosWorkspace {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
}

export interface VendiaosAuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  user: VendiaosAuthUser;
  workspace?: VendiaosWorkspace;
}

interface SupabaseAuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id: string;
    email?: string;
  };
  error?: string;
  error_description?: string;
  msg?: string;
}

interface WorkspaceResponse {
  user?: VendiaosAuthUser;
  workspace?: VendiaosWorkspace;
  error?: string;
  details?: unknown;
}

export const VENDIAOS_AUTH_SESSION_KEY = "vendiaos.auth.session";
export const VENDIAOS_AUTH_CHANGED_EVENT = "vendiaos:auth-changed";

function getSupabaseAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return {
    authUrl: `${url.replace(/\/$/, "")}/auth/v1`,
    anonKey,
  };
}

function dispatchAuthChanged() {
  window.dispatchEvent(new Event(VENDIAOS_AUTH_CHANGED_EVENT));
}

function mapAuthError(data: SupabaseAuthResponse) {
  return data.error_description ?? data.msg ?? data.error ?? "Nao foi possivel autenticar.";
}

export function persistVendiaosSession(session: VendiaosAuthSession) {
  window.localStorage.setItem(VENDIAOS_AUTH_SESSION_KEY, JSON.stringify(session));
  dispatchAuthChanged();
}

export function loadVendiaosSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(VENDIAOS_AUTH_SESSION_KEY);
    return raw ? (JSON.parse(raw) as VendiaosAuthSession) : null;
  } catch {
    window.localStorage.removeItem(VENDIAOS_AUTH_SESSION_KEY);
    return null;
  }
}

export function clearVendiaosSession() {
  window.localStorage.removeItem(VENDIAOS_AUTH_SESSION_KEY);
  dispatchAuthChanged();
}

export function isAuthConfigured() {
  return Boolean(getSupabaseAuthConfig());
}

export async function syncAuthenticatedWorkspace() {
  const session = loadVendiaosSession();

  if (!session?.accessToken) {
    return null;
  }

  const response = await fetch("/api/auth/workspace", {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
    cache: "no-store",
  });

  const data = (await response.json()) as WorkspaceResponse;

  if (!response.ok || !data.workspace) {
    throw new Error(data.error ?? "Nao foi possivel sincronizar workspace.");
  }

  const nextSession: VendiaosAuthSession = {
    ...session,
    user: data.user ?? session.user,
    workspace: data.workspace,
  };

  persistVendiaosSession(nextSession);
  return nextSession;
}

async function persistAndSyncWorkspace(session: VendiaosAuthSession) {
  persistVendiaosSession(session);

  try {
    return (await syncAuthenticatedWorkspace()) ?? session;
  } catch {
    return session;
  }
}

export async function signInWithPassword(email: string, password: string) {
  const config = getSupabaseAuthConfig();

  if (!config) {
    throw new Error("Supabase publico ainda nao configurado.");
  }

  const response = await fetch(`${config.authUrl}/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = (await response.json()) as SupabaseAuthResponse;

  if (!response.ok || !data.access_token || !data.user) {
    throw new Error(mapAuthError(data));
  }

  const session: VendiaosAuthSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  };

  return persistAndSyncWorkspace(session);
}

export async function signUpWithPassword(email: string, password: string) {
  const config = getSupabaseAuthConfig();

  if (!config) {
    throw new Error("Supabase publico ainda nao configurado.");
  }

  const response = await fetch(`${config.authUrl}/signup`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = (await response.json()) as SupabaseAuthResponse;

  if (!response.ok || !data.user) {
    throw new Error(mapAuthError(data));
  }

  if (!data.access_token) {
    return null;
  }

  const session: VendiaosAuthSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  };

  return persistAndSyncWorkspace(session);
}

export async function signOutVendiaos() {
  const config = getSupabaseAuthConfig();
  const session = loadVendiaosSession();

  if (config && session?.accessToken) {
    try {
      await fetch(`${config.authUrl}/logout`, {
        method: "POST",
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
    } catch {
      // Logout local continua mesmo se a chamada remota falhar.
    }
  }

  clearVendiaosSession();
}
