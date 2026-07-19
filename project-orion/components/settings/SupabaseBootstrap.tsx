"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2, Rocket, ShieldCheck } from "lucide-react";

interface BootstrapResponse {
  bootstrap?: {
    workspaceId: string;
    userId: string;
    ownerEmail: string;
    workspaceName: string;
  };
  env?: {
    VENDIAOS_DEFAULT_WORKSPACE_ID: string;
    VENDIAOS_DEFAULT_USER_ID: string;
  };
  nextStep?: string;
  error?: string;
  reason?: string;
}

interface HealthResponse {
  services?: {
    supabase?: {
      ready: boolean;
    };
    bootstrap?: {
      ready: boolean;
    };
  };
}

function createEnvSnippet(data: BootstrapResponse) {
  if (!data.env) {
    return "";
  }

  return [
    `VENDIAOS_DEFAULT_WORKSPACE_ID=${data.env.VENDIAOS_DEFAULT_WORKSPACE_ID}`,
    `VENDIAOS_DEFAULT_USER_ID=${data.env.VENDIAOS_DEFAULT_USER_ID}`,
  ].join("\n");
}

export default function SupabaseBootstrap() {
  const [workspaceName, setWorkspaceName] = useState("VendIAOS Demo");
  const [ownerEmail, setOwnerEmail] = useState("oqncoficial@gmail.com");
  const [secret, setSecret] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(true);
  const [isBootstrapReady, setIsBootstrapReady] = useState(false);
  const [result, setResult] = useState<BootstrapResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(async () => {
      try {
        const response = await fetch("/api/system/health", { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as HealthResponse;
        const ready = Boolean(data.services?.supabase?.ready && data.services?.bootstrap?.ready);

        if (isMounted) {
          setIsBootstrapReady(ready);
        }
      } finally {
        if (isMounted) {
          setIsCheckingHealth(false);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function runBootstrap() {
    if (isBootstrapReady) {
      return;
    }

    setIsLoading(true);
    setResult(null);
    setCopied(false);

    try {
      const response = await fetch("/api/system/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceName,
          ownerEmail,
          secret: secret.trim() || undefined,
        }),
      });

      const data = (await response.json()) as BootstrapResponse;
      setResult(data);

      if (data.env) {
        setIsBootstrapReady(true);
      }
    } catch {
      setResult({ error: "Nao foi possivel chamar o bootstrap." });
    } finally {
      setIsLoading(false);
    }
  }

  async function copyEnv() {
    if (!result?.env) {
      return;
    }

    await navigator.clipboard.writeText(createEnvSnippet(result));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const envSnippet = result?.env ? createEnvSnippet(result) : "";
  const buttonDisabled = isLoading || isCheckingHealth || workspaceName.trim().length === 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <div className="mb-3 flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <Rocket className="h-4 w-4" />
            Bootstrap Supabase
          </div>

          <h2 className="text-lg font-semibold text-slate-950">
            {isBootstrapReady ? "Workspace inicial pronto" : "Criar workspace inicial"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isBootstrapReady
              ? "O VendIAOS ja tem workspace e usuario inicial configurados para salvar projetos no Supabase."
              : "Use depois de aplicar a migration no Supabase. O VendIAOS cria um usuario confirmado, workspace e membro owner para ativar persistencia real."}
          </p>
        </div>

        {isBootstrapReady ? (
          <div className="flex w-full flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 lg:max-w-md">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Bootstrap concluido</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  As variaveis VENDIAOS_DEFAULT_WORKSPACE_ID e VENDIAOS_DEFAULT_USER_ID estao ativas. Nao e necessario criar outro workspace.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3 lg:max-w-md">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Nome do workspace
              <input
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm normal-case tracking-normal text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Email owner
              <input
                value={ownerEmail}
                onChange={(event) => setOwnerEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm normal-case tracking-normal text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Segredo opcional
              <input
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="VENDIAOS_BOOTSTRAP_SECRET"
                type="password"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm normal-case tracking-normal text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <button
              type="button"
              onClick={runBootstrap}
              disabled={buttonDisabled}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isLoading || isCheckingHealth ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {isCheckingHealth ? "Verificando" : isLoading ? "Criando" : "Criar workspace"}
            </button>
          </div>
        )}
      </div>

      {result && (
        <div
          className={`mt-5 rounded-2xl border p-4 ${
            result.env ? "border-emerald-100 bg-emerald-50" : "border-amber-100 bg-amber-50"
          }`}
        >
          {result.env ? (
            <>
              <p className="text-sm font-semibold text-emerald-800">Workspace inicial criado.</p>
              <p className="mt-1 text-sm text-slate-700">
                Copie os IDs para o arquivo <span className="font-semibold">.env.local</span> e reinicie o servidor.
              </p>

              <pre className="mt-4 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {envSnippet}
              </pre>

              <button
                type="button"
                onClick={copyEnv}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copiado" : "Copiar variaveis"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-amber-800">{result.error ?? "Bootstrap pendente."}</p>
              {result.reason && <p className="mt-1 text-sm text-slate-700">{result.reason}</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
