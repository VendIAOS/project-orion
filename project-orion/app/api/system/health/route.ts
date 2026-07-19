import { NextResponse } from "next/server";

type ServiceStatus = "ready" | "missing";

function getStatus(value: string | undefined): ServiceStatus {
  return value && value.trim().length > 0 ? "ready" : "missing";
}

export async function GET() {
  const openai = getStatus(process.env.OPENAI_API_KEY);
  const supabaseUrl = getStatus(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnon = getStatus(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const supabaseService = getStatus(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const defaultWorkspace = getStatus(process.env.VENDIAOS_DEFAULT_WORKSPACE_ID);
  const defaultUser = getStatus(process.env.VENDIAOS_DEFAULT_USER_ID);

  return NextResponse.json({
    services: {
      openai,
      supabase: {
        url: supabaseUrl,
        anonKey: supabaseAnon,
        serviceRole: supabaseService,
        ready:
          supabaseUrl === "ready" &&
          supabaseAnon === "ready" &&
          supabaseService === "ready",
      },
      bootstrap: {
        workspaceId: defaultWorkspace,
        userId: defaultUser,
        ready: defaultWorkspace === "ready" && defaultUser === "ready",
      },
    },
  });
}
