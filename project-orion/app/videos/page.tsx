import MainLayout from "@/components/layout/MainLayout";

export default function VideosPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="text-4xl font-bold">Vídeos</h1>

        <p className="text-slate-600">
          Aqui ficarão todos os vídeos gerados.
        </p>
      </div>
    </MainLayout>
  );
}