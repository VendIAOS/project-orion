import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import { getSupabaseServerConfig } from "@/lib/supabase-config";
import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

interface BootstrapBody {
  workspaceName?: string;
  ownerEmail?: string;
  secret?: string;
}

interface SupabaseAuthUser {
  id: string;
  email?: string;
}

interface SupabaseWorkspaceRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
}

interface SupabaseWorkspaceMemberRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
}

function normalizeEmail(email?: string) {
  const cleanEmail = email?.trim().toLowerCase();

  if (cleanEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return cleanEmail;
  }

  return `bootstrap-${Date.now()}@vendiaos.local`;
}

function createSlug(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${slug || "vendiaos"}-${randomBytes(3).toString("hex")}`;
}

function assertBootstrapAllowed(request: Request, body: BootstrapBody) {
  const expectedSecret = process.env.VENDIAOS_BOOTSTRAP_SECRET;

  if (expectedSecret) {
    const providedSecret = request.headers.get("x-vendiaos-bootstrap-secret") ?? body.secret;
    return providedSecret === expectedSecret;
  }

  return process.env.NODE_ENV !== "production";
}

async function createAuthUser(email: string) {
  const config = getSupabaseServerConfig();

  if (!config) {
    throw new SupabaseConfigError();
  }

  const password = randomBytes(18).toString("base64url");
  const response = await fetch(`${config.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        source: "vendiaos_bootstrap",
      },
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as SupabaseAuthUser | { error?: string; msg?: string; message?: string };

  if (!response.ok || !("id" in data)) {
    return {
      user: null,
      error: data,
      status: response.status,
    };
  }

  return {
    user: data,
    error: null,
    status: response.status,
  };
}

export async function POST(request: Request) {
  let body: BootstrapBody;

  try {
    body = (await request.json()) as BootstrapBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido." }, { status: 400 });
  }

  if (!assertBootstrapAllowed(request, body)) {
    return NextResponse.json(
      {
        error: "Bootstrap bloqueado.",
        reason: "Configure VENDIAOS_BOOTSTRAP_SECRET e envie o segredo correto para criar workspace inicial.",
      },
      { status: 403 },
    );
  }

  const workspaceName = body.workspaceName?.trim() || "VendIAOS Demo";
  const ownerEmail = normalizeEmail(body.ownerEmail);

  try {
    const authResult = await createAuthUser(ownerEmail);

    if (!authResult.user) {
      return NextResponse.json(
        {
          error: "Nao foi possivel criar usuario inicial no Supabase Auth.",
          details: authResult.error,
        },
        { status: authResult.status },
      );
    }

    const workspaceResult = await supabaseRest<SupabaseWorkspaceRow[]>("workspaces", {
      method: "POST",
      body: {
        name: workspaceName,
        slug: createSlug(workspaceName),
        owner_id: authResult.user.id,
      },
    });

    if (workspaceResult.error || !workspaceResult.data?.[0]) {
      return NextResponse.json(
        {
          error: "Usuario criado, mas workspace nao foi criado.",
          userId: authResult.user.id,
          details: workspaceResult.error,
        },
        { status: workspaceResult.status },
      );
    }

    const workspace = workspaceResult.data[0];
    const memberResult = await supabaseRest<SupabaseWorkspaceMemberRow[]>("workspace_members", {
      method: "POST",
      body: {
        workspace_id: workspace.id,
        user_id: authResult.user.id,
        role: "owner",
      },
    });

    if (memberResult.error || !memberResult.data?.[0]) {
      return NextResponse.json(
        {
          error: "Workspace criado, mas membro inicial nao foi vinculado.",
          workspaceId: workspace.id,
          userId: authResult.user.id,
          details: memberResult.error,
        },
        { status: memberResult.status },
      );
    }

    return NextResponse.json({
      bootstrap: {
        workspaceId: workspace.id,
        userId: authResult.user.id,
        ownerEmail,
        workspaceName: workspace.name,
      },
      env: {
        VENDIAOS_DEFAULT_WORKSPACE_ID: workspace.id,
        VENDIAOS_DEFAULT_USER_ID: authResult.user.id,
      },
      nextStep: "Copie os IDs para .env.local e reinicie o servidor Next.js.",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json(
        {
          error: error.message,
          requiredEnv: [
            "NEXT_PUBLIC_SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
          ],
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Erro inesperado ao executar bootstrap Supabase." }, { status: 500 });
  }
}
