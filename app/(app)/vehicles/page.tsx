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

export default async function VehiclesPage({
  searchParams
}: {
  searchParams?: {
    q?: string;
    importUrl?: string;
    deleted?: string;
  };
}) {
  const vehicles = await getVehiclesList();
  const searchQuery = searchParams?.q?.trim() ?? "";
  const importUrl = searchParams?.importUrl?.trim();
  const normalizedSearchQuery = searchQuery.toLowerCase();
  const filteredVehicles = normalizedSearchQuery
    ? vehicles.filter((vehicle) =>
        [
          vehicle.stockCode,
          vehicle.lotCode,
          vehicle.displayName,
          vehicle.brand,
          vehicle.model,
          vehicle.version,
          vehicle.auctionHouse?.name,
          vehicle.sellerName,
          vehicle.yard,
          vehicle.city,
          vehicle.state
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearchQuery)
      )
    : vehicles;

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

      {searchParams?.deleted === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Lote excluido com sucesso.
        </div>
      ) : null}

      <LotImportCard autoImportUrl={importUrl} embedded />

      <Card>
        <CardHeader
          title="Lotes cadastrados"
          description="Carteira ativa, em preparação, anunciada e já convertida em venda."
          actions={<Badge tone="info">{filteredVehicles.length} registros</Badge>}
        />
        <CardContent className="overflow-x-auto">
          {searchQuery ? <p className="mb-4 text-sm text-muted">Resultado da busca por “{searchQuery}”.</p> : null}
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-background/70 text-muted">
                <th className="px-4 py-3 font-medium">Estoque</th>
                <th className="px-4 py-3 font-medium">Veículo</th>
                <th className="px-4 py-3 font-medium">Leiloeira</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Custo atual</th>
                <th className="px-4 py-3 font-medium">Venda prevista</th>
                <th className="px-4 py-3 font-medium">Lucro previsto</th>
                <th className="px-4 py-3 font-medium">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-b border-border/60 transition hover:bg-background/50">
                  <td className="px-4 py-4 font-semibold text-primary">{vehicle.stockCode ?? "Sem código"}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={vehicle.photos[0]?.publicUrl ?? vehicle.mainPhotoUrl ?? "/placeholders/vehicle-1.svg"}
                        alt="Foto do veículo"
                        className="h-12 w-16 rounded-xl border border-border object-cover"
                      />
                      <div>
                        <p className="font-medium text-foreground">
                          {vehicle.displayName ?? [vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ")}
                        </p>
                        <p className="text-xs text-muted">
                          Lote {vehicle.lotCode ?? "pendente"} • Completo {vehicle.completenessPercent}%
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">{vehicle.auctionHouse?.name ?? "Não informada"}</td>
                  <td className="px-4 py-4">
                    <VehicleStatusBadge status={vehicle.status as never} />
                  </td>
                  <td className="px-4 py-4 font-semibold">{formatCurrency(Number(vehicle.financialSummary?.totalCost ?? vehicle.totalActualCost ?? vehicle.totalPredictedCost ?? 0))}</td>
                  <td className="px-4 py-4 font-semibold">{formatCurrency(Number(vehicle.predictedSalePrice ?? 0))}</td>
                  <td className="px-4 py-4 font-semibold text-primary">{formatCurrency(Number(vehicle.financialSummary?.netProfit ?? vehicle.predictedProfit ?? 0))}</td>
                  <td className="px-4 py-4">
                    <Link href={`/vehicles/${vehicle.id}`} className="inline-flex items-center gap-2 font-semibold text-primary">
                      Abrir veículo
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">
                    Nenhum lote encontrado para esta busca.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
