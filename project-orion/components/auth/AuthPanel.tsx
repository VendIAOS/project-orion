"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, LockKeyhole, LogIn, UserPlus } from "lucide-react";

import { isAuthConfigured, signInWithPassword, signUpWithPassword } from "./auth-client";

type AuthMode = "login" | "signup";

export default function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await signInWithPassword(email.trim(), password);
        setMessage("Sessao iniciada e workspace sincronizado. Voce ja pode voltar ao VendIAOS.");
      } else {
        const session = await signUpWithPassword(email.trim(), password);
        setMessage(session ? "Conta criada, sessao iniciada e workspace sincronizado." : "Conta criada. Confirme o email se o Supabase exigir verificacao.");
      }
    } catch (authError) {
      setError(String(authError instanceof Error ? authError.message : authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  const configured = isAuthConfigured();

  return (
    <main className="flex min-h-screen bg-slate-950 text-white">
      <section className="flex flex-1 flex-col justify-between p-8 md:p-12">
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-white">
          <ArrowLeft size={16} />
          Voltar ao VendIAOS
        </Link>

        <div className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-100">
            <LockKeyhole size={16} />
            VendIAOS Auth
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Acesso operacional ao sistema de marketing com IA.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Esta e a primeira camada de autenticacao real do VendIAOS usando Supabase Auth, preparada para evoluir para workspaces, permissoes e billing.
          </p>
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Project Orion / Build 0.61.0</p>
      </section>

      <section className="flex w-full max-w-xl items-center bg-slate-100 p-6 text-slate-950 md:p-10">
        <form onSubmit={submitAuth} className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex rounded-xl bg-slate-100 p-1">
            {[
              { id: "login", label: "Entrar", icon: LogIn },
              { id: "signup", label: "Criar conta", icon: UserPlus },
            ].map((item) => {
              const Icon = item.icon;
              const active = mode === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id as AuthMode)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    active ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <h2 className="text-2xl font-bold">{mode === "login" ? "Entrar no VendIAOS" : "Criar acesso"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Use email e senha configurados no Supabase Auth. Em seguida o header do app passa a mostrar a sessao ativa.
            </p>
          </div>

          {!configured && (
            <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para ativar login real.
            </p>
          )}

          <label className="mt-6 block text-xs font-semibold uppercase tracking-widest text-slate-400">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-blue-400"
              placeholder="voce@empresa.com"
            />
          </label>

          <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-slate-400">
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-blue-400"
              placeholder="minimo 6 caracteres"
            />
          </label>

          {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          {message && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p>}

          <button
            type="submit"
            disabled={isSubmitting || !configured}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </section>
    </main>
  );
}

