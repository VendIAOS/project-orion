export default function RecentActivity() {
  const activities = [
    "Vídeo criado com sucesso",
    "Novo cliente cadastrado",
    "Créditos adicionados",
    "Avatar atualizado",
  ];

  return (
    <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">
        Atividades Recentes
      </h2>

      <ul className="space-y-3">
        {activities.map((item) => (
          <li
            key={item}
            className="border-b border-slate-100 pb-2 text-slate-700 last:border-0"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}