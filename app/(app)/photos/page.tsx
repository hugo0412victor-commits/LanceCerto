import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getPhotosOverview } from "@/lib/data";

export default async function PhotosPage() {
  const photos = await getPhotosOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Acervo"
        title="Fotos"
        description="Galeria central com imagens originais do lote, retirada, reparo e anuncio."
      />

      <Card>
        <CardHeader title="Galeria global" description="Todas as imagens armazenadas no sistema." />
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-3xl border border-border bg-white/75">
              <img src={photo.publicUrl} alt={photo.caption ?? "Foto do veiculo"} className="h-52 w-full object-cover" />
              <div className="p-4">
                <p className="font-semibold">{photo.vehicle.stockCode}</p>
                <p className="mt-1 text-sm text-muted">{photo.category}</p>
                <p className="mt-2 text-sm text-muted">{photo.caption ?? "Sem legenda."}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
