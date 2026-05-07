import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LotImportCard } from "@/components/vehicles/lot-import-card";
import { VehicleStatusBadge } from "@/components/vehicles/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { getVehiclesList } from "@/lib/data";

export default async function VehiclesPage() {
  const vehicles = await getVehiclesList();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Estoque e lotes"
        title="Gestão de lotes e veículos"
        description="Cadastre manualmente ou importe por link. Todo campo permanece editável e o snapshot fica salvo internamente."
        actions={
          <Link href="/vehicles/new">
            <Button variant="accent" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo cadastro
            </Button>
          </Link>
        }
      />

      <LotImportCard defaultUrl="https://www.copart.com.br/lot/1090276" />

      <Card>
        <CardHeader
          title="Lotes cadastrados"
          description="Carteira ativa, em preparação, anunciada e já convertida em venda."
          actions={<Badge tone="info">{vehicles.length} registros</Badge>}
        />
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-background/70 text-muted">
                <th className="px-4 py-3 font-medium">Estoque</th>
                <th className="px-4 py-3 font-medium">Veículo</th>
                <th className="px-4 py-3 font-medium">Leiloeira</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Custo previsto</th>
                <th className="px-4 py-3 font-medium">Venda prevista</th>
                <th className="px-4 py-3 font-medium">Lucro previsto</th>
                <th className="px-4 py-3 font-medium">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-b border-border/60 transition hover:bg-background/50">
                  <td className="px-4 py-4 font-semibold text-primary">{vehicle.stockCode ?? "Sem código"}</td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-foreground">
                        {[vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ")}
                      </p>
                      <p className="text-xs text-muted">
                        Lote {vehicle.lotCode ?? "pendente"} • Completo {vehicle.completenessPercent}%
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">{vehicle.auctionHouse?.name ?? "Não informada"}</td>
                  <td className="px-4 py-4">
                    <VehicleStatusBadge status={vehicle.status as never} />
                  </td>
                  <td className="px-4 py-4 font-semibold">{formatCurrency(Number(vehicle.totalPredictedCost ?? 0))}</td>
                  <td className="px-4 py-4 font-semibold">{formatCurrency(Number(vehicle.predictedSalePrice ?? 0))}</td>
                  <td className="px-4 py-4 font-semibold text-primary">{formatCurrency(Number(vehicle.predictedProfit ?? 0))}</td>
                  <td className="px-4 py-4">
                    <Link href={`/vehicles/${vehicle.id}`} className="inline-flex items-center gap-2 font-semibold text-primary">
                      Abrir veículo
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
