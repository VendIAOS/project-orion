import MainLayout from "@/components/layout/MainLayout";

export default function ImagesPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="text-4xl font-bold">Imagens</h1>

        <p className="text-slate-600">
          Biblioteca de imagens criadas pela IA.
        </p>
      </div>
    </MainLayout>
  );
}