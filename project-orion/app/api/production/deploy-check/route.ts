import { NextResponse } from "next/server";

type DeployVariableStatus = "ready" | "missing";
type DeployVariableScope = "core" | "billing" | "public-url" | "optional";

interface DeployVariableCheck {
  name: string;
  label: string;
  scope: DeployVariableScope;
  required: boolean;
  status: DeployVariableStatus;
}

const DEPLOY_VARIABLES: Array<Omit<DeployVariableCheck, "status">> = [
  {
    name: "OPENAI_API_KEY",
    label: "OpenAI server-side",
    scope: "core",
    required: true,
  },
  {
    name: "OPENAI_MODEL",
    label: "Modelo padrao de IA",
    scope: "core",
    required: true,
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    label: "URL publica Supabase",
    scope: "core",
    required: true,
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    label: "Chave anonima Supabase",
    scope: "core",
    required: true,
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    label: "Service role Supabase",
    scope: "core",
    required: true,
  },
  {
    name: "VENDIAOS_DEFAULT_WORKSPACE_ID",
    label: "Workspace inicial",
    scope: "core",
    required: true,
  },
  {
    name: "VENDIAOS_DEFAULT_USER_ID",
    label: "Usuario inicial",
    scope: "core",
    required: true,
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    label: "URL publica da aplicacao",
    scope: "public-url",
    required: true,
  },
  {
    name: "STRIPE_SECRET_KEY",
    label: "Stripe secret key",
    scope: "billing",
    required: true,
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    label: "Stripe webhook secret",
    scope: "billing",
    required: true,
  },
  {
    name: "STRIPE_PRICE_GROWTH",
    label: "Price ID plano Growth",
    scope: "billing",
    required: true,
  },
  {
    name: "STRIPE_PRICE_SCALE",
    label: "Price ID plano Scale",
    scope: "billing",
    required: true,
  },
  {
    name: "VENDIAOS_BOOTSTRAP_SECRET",
    label: "Segredo opcional de bootstrap",
    scope: "optional",
    required: false,
  },
];

function isReady(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  const variables = DEPLOY_VARIABLES.map((variable) => ({
    ...variable,
    status: isReady(variable.name) ? ("ready" as const) : ("missing" as const),
  }));

  const requiredVariables = variables.filter((variable) => variable.required);
  const missingRequired = requiredVariables.filter((variable) => variable.status === "missing");
  const readyRequired = requiredVariables.length - missingRequired.length;
  const readyPercent = Math.round((readyRequired / requiredVariables.length) * 100);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  const appUrlLooksPublic = Boolean(appUrl && !appUrl.includes("localhost") && !appUrl.includes("127.0.0.1"));

  return NextResponse.json({
    status: missingRequired.length === 0 && appUrlLooksPublic ? "ready" : missingRequired.length === 0 ? "warning" : "blocked",
    readyPercent,
    readyRequired,
    totalRequired: requiredVariables.length,
    missingRequired: missingRequired.map((variable) => variable.name),
    appUrlLooksPublic,
    variables,
    generatedAt: new Date().toISOString(),
  });
}
