import { PageHeader } from "@/components/common/page-header";
import { LotImportCard } from "@/components/vehicles/lot-import-card";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { getReferenceData } from "@/lib/data";

export default async function NewVehiclePage() {
  const { auctionHouses } = await getReferenceData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Novo cadastro"
        title="Novo lote ou veiculo"
        description="Use a importacao por link quando possivel ou preencha manualmente. Nenhum fluxo deve parar por informacao faltante."
      />
      <LotImportCard defaultUrl="https://www.copart.com.br/lot/1090276" />
      <VehicleForm auctionHouses={auctionHouses} />
    </div>
  );
}
