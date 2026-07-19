import MainLayout from "@/components/layout/MainLayout";
import ArtifactLibraryDashboard from "@/components/projects/ArtifactLibraryDashboard";

export default function VideosPage() {
  return (
    <MainLayout>
      <ArtifactLibraryDashboard kind="video" />
    </MainLayout>
  );
}
