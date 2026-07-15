import DashboardCard from "./DashboardCard";

export default function StatsGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <DashboardCard
        title="Créditos"
        value="1.250"
        description="Disponíveis"
      />

      <DashboardCard
        title="Vídeos"
        value="32"
        description="Gerados"
      />

      <DashboardCard
        title="Clientes"
        value="18"
        description="Ativos"
      />

      <DashboardCard
        title="Receita"
        value="R$ 12.450"
        description="Este mês"
      />
    </div>
  );
}