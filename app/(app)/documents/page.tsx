import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDocumentsOverview } from "@/lib/data";
import { formatDate } from "@/lib/format";

export default async function DocumentsPage() {
  const documents = await getDocumentsOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Acervo"
        title="Documentos"
        description="Repositório central dos arquivos vinculados aos veículos, com leitura rápida de categoria, vínculo e data."
      />

      <Card>
        <CardHeader title="Documentos enviados" description="Visualização global do acervo documental do sistema." />
        <CardContent className="space-y-3">
          <div className="rounded-[1.8rem] border border-dashed border-primary/22 bg-background/55 p-6">
            <p className="font-semibold text-primary">Área de documentos</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Organize PDFs, imagens, laudos e comprovantes com status claro de validação e vínculo por lote.
            </p>
          </div>
          {documents.map((document) => (
            <a key={document.id} href={document.publicUrl} className="block rounded-[1.7rem] border border-border bg-background/45 p-4 transition hover:bg-background/75">
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Arquivo</p>
                  <p className="font-semibold text-primary">{document.fileName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Categoria</p>
                  <div className="mt-1">
                    <Badge tone="info">{document.category}</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Veículo</p>
                  <p className="font-semibold">{document.vehicle.stockCode}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Upload</p>
                  <p className="font-semibold">{formatDate(document.createdAt)}</p>
                </div>
              </div>
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
