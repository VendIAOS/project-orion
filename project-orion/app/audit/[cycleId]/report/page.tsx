import AuthGuard from "@/components/auth/AuthGuard";
import OperationalCycleReport from "@/components/projects/OperationalCycleReport";

interface AuditCycleReportPageProps {
  params: Promise<{
    cycleId: string;
  }>;
}

export default async function AuditCycleReportPage({ params }: AuditCycleReportPageProps) {
  const { cycleId } = await params;

  return (
    <AuthGuard>
      <OperationalCycleReport cycleId={cycleId} />
    </AuthGuard>
  );
}
