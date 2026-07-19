import MainLayout from "@/components/layout/MainLayout";
import ArtifactLibraryDashboard from "@/components/projects/ArtifactLibraryDashboard";

export default function AvatarsPage() {
  return (
    <MainLayout>
      <ArtifactLibraryDashboard kind="avatar" />
    </MainLayout>
  );
}
