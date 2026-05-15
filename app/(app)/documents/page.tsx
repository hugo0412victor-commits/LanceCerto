import { PageHeader } from "@/components/common/page-header";
import { DocumentManagement } from "@/components/documents/document-management";
import { getDocumentsWorkspace } from "@/lib/data";

export default async function DocumentsPage() {
  const { documents, vehicles } = await getDocumentsWorkspace();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Acervo"
        title="Documentos"
        description="Armazenamento, organizacao e gestao documental dos lotes e veiculos."
      />

      <DocumentManagement documents={documents} vehicles={vehicles} />
    </div>
  );
}
