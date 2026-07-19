import Link from "next/link";
import {
  Bot,
  Clapperboard,
  CreditCard,
  Clock3,
  FolderOpen,
  ImageIcon,
  LayoutDashboard,
  Rocket,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col bg-slate-900 text-white">
      <div className="border-b border-slate-700 p-6">
        <h1 className="text-2xl font-bold text-blue-400">VendIAOS</h1>
      </div>

      <nav className="flex-1 space-y-2 p-4">
        <Link
          href="/"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-slate-800"
        >
          <LayoutDashboard size={20} />
          Dashboard
        </Link>

        <Link
          href="/ai-studio"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-slate-800"
        >
          <Bot size={20} />
          AI Studio
        </Link>

        <Link
          href="/projects"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-slate-800"
        >
          <FolderOpen size={20} />
          Projetos
        </Link>

        <Link
          href="/executions"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-slate-800"
        >
          <Clock3 size={20} />
          Execucoes
        </Link>

        <Link
          href="/audit"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-slate-800"
        >
          <ShieldCheck size={20} />
          Auditoria
        </Link>

        <Link
          href="/production"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-slate-800"
        >
          <Rocket size={20} />
          Producao
        </Link>

        <Link
          href="/videos"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-slate-800"
        >
          <Clapperboard size={20} />
          Videos
        </Link>

        <Link
          href="/avatars"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-slate-800"
        >
          <UserRound size={20} />
          Avatares
        </Link>

        <Link
          href="/images"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-slate-800"
        >
          <ImageIcon size={20} />
          Imagens
        </Link>

        <Link
          href="/billing"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-slate-800"
        >
          <CreditCard size={20} />
          Financeiro
        </Link>
      </nav>

      <div className="border-t border-slate-700 p-4">
        <Link
          href="/settings"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-slate-800"
        >
          <Settings size={20} />
          Configuracoes
        </Link>
      </div>
    </aside>
  );
}

