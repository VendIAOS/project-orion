import MainLayout from "@/components/layout/MainLayout";
import ProjectDetail from "@/components/projects/ProjectDetail";

interface ProjectDetailPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;

  return (
    <MainLayout>
      <ProjectDetail projectId={decodeURIComponent(projectId)} />
    </MainLayout>
  );
}
