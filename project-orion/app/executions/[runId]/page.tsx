import MainLayout from "@/components/layout/MainLayout";
import AgentRunDetail from "@/components/projects/AgentRunDetail";

interface AgentRunDetailPageProps {
  params: Promise<{
    runId: string;
  }>;
}

export default async function AgentRunDetailPage({ params }: AgentRunDetailPageProps) {
  const { runId } = await params;

  return (
    <MainLayout>
      <AgentRunDetail runId={decodeURIComponent(runId)} />
    </MainLayout>
  );
}
