export default function Header() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div>
        <h2 className="text-xl font-semibold">
          Dashboard
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <button className="rounded-lg bg-slate-900 text-white px-4 py-2">
          Novo Vídeo
        </button>

        <div className="w-10 h-10 rounded-full bg-slate-300" />
      </div>
    </header>
  );
}