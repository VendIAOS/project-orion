import MainLayout from "@/components/layout/MainLayout";
import ArtifactLibraryDashboard from "@/components/projects/ArtifactLibraryDashboard";

export default function ImagesPage() {
  return (
    <MainLayout>
      <ArtifactLibraryDashboard kind="imagem" />
    </MainLayout>
  );
}
