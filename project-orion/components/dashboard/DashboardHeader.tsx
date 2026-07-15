export default function DashboardHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-4xl font-bold">
          Dashboard
        </h1>

        <p className="mt-2 text-slate-500">
          Bem-vindo ao VendIAOS 🚀
        </p>
      </div>

      <button className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700">
        + Novo Projeto
      </button>
    </div>
  );
}