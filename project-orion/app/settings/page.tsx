import MainLayout from "@/components/layout/MainLayout";
import AdminAuditTimeline from "@/components/settings/AdminAuditTimeline";
import SupabaseBootstrap from "@/components/settings/SupabaseBootstrap";
import SystemStatus from "@/components/settings/SystemStatus";
import WorkspaceMembers from "@/components/settings/WorkspaceMembers";

export default function SettingsPage() {
  return (
    <MainLayout>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Configuracoes</h1>

          <p className="mt-3 max-w-2xl text-slate-600">
            Configure credenciais, integracoes e preferencias operacionais do VendIAOS.
          </p>
        </div>

        <SystemStatus />
        <WorkspaceMembers />
        <AdminAuditTimeline />
        <SupabaseBootstrap />
      </div>
    </MainLayout>
  );
}


