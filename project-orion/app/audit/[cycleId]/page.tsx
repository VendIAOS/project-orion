import MainLayout from "@/components/layout/MainLayout";
import OperationalCycleDetail from "@/components/projects/OperationalCycleDetail";

interface AuditCyclePageProps {
  params: Promise<{
    cycleId: string;
  }>;
}

export default async function AuditCyclePage({ params }: AuditCyclePageProps) {
  const { cycleId } = await params;

  return (
    <MainLayout>
      <OperationalCycleDetail cycleId={cycleId} />
    </MainLayout>
  );
}
