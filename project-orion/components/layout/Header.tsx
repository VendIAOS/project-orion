import AuthStatus from "@/components/auth/AuthStatus";

import Link from "next/link";

export default function Header() {
  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/videos" className="rounded-lg bg-slate-900 px-4 py-2 text-white transition hover:bg-blue-700">
          Novo Video
        </Link>

        <AuthStatus />

        <div aria-hidden="true" className="hidden h-10 w-10 rounded-full bg-slate-300 sm:block" />
      </div>
    </header>
  );
}
