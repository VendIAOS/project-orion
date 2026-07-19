import AuthStatus from "@/components/auth/AuthStatus";

export default function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>
      </div>

      <div className="flex items-center gap-4">
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-white">
          Novo Video
        </button>

        <AuthStatus />

        <div className="h-10 w-10 rounded-full bg-slate-300" />
      </div>
    </header>
  );
}
