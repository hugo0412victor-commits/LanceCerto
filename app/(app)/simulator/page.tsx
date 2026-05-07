import { saveSimulationAction } from "@/app/actions";
import { PageHeader } from "@/components/common/page-header";
import { SimulationForm } from "@/components/simulator/simulation-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LOT_ANALYSIS_DEFAULTS } from "@/lib/calculations";
import { getSimulationsOverview } from "@/lib/data";
import { formatCurrency, formatPercent } from "@/lib/format";

export default async function SimulatorPage() {
  const { simulations, vehicles } = await getSimulationsOverview();

  const preparedVehicles = vehicles.map((vehicle) => ({
    id: vehicle.id,
    stockCode: vehicle.stockCode,
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version,
    modelYear: vehicle.modelYear,
    fipeValue: Number(vehicle.fipeValue ?? 0),
    marketEstimatedValue: Number(vehicle.marketEstimatedValue ?? 0),
    bidValue: Number(vehicle.bidValue ?? vehicle.maxRecommendedBid ?? 0),
    auctionCommission:
      Number(vehicle.auctionCommission ?? 0) ||
      Number(vehicle.bidValue ?? vehicle.maxRecommendedBid ?? 0) * (LOT_ANALYSIS_DEFAULTS.auctioneerCommissionPercent / 100),
    administrativeFees: Number(vehicle.administrativeFees ?? LOT_ANALYSIS_DEFAULTS.originExpensesCost),
    yardCost: Number(vehicle.yardCost ?? 0),
    towCost: Number(vehicle.towCost ?? 0),
    documentationExpected: Number(vehicle.documentationExpected ?? LOT_ANALYSIS_DEFAULTS.dsalCost),
    repairsExpected: Number(vehicle.repairsExpected ?? 0),
    predictedSalePrice: Number(vehicle.predictedSalePrice ?? 0),
    predictedMargin: Number(vehicle.predictedMargin ?? 0),
    predictedRoi: Number(vehicle.predictedRoi ?? 0)
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pré-arremate"
        title="Simulador de investimento"
        description="Projete margem, ROI, desconto sobre FIPE e lance máximo recomendado antes da compra."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SimulationForm vehicles={preparedVehicles} action={saveSimulationAction} />

        <Card>
          <CardHeader title="Histórico de simulações" description="Transforme análise de compra em base futura para lance e score." />
          <CardContent className="space-y-3">
            {simulations.map((simulation) => (
              <div key={simulation.id} className="rounded-[1.6rem] border border-border bg-background/55 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Veículo</p>
                    <p className="font-semibold">
                      {[simulation.brand, simulation.model, simulation.version].filter(Boolean).join(" ") || simulation.vehicle?.stockCode || "Simulação"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Lucro previsto</p>
                    <p className="font-semibold">{formatCurrency(Number(simulation.predictedProfit ?? 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Margem</p>
                    <p className="font-semibold">{formatPercent(Number(simulation.predictedMargin ?? 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Recomendação</p>
                    <p className="font-semibold">{simulation.recommendation ?? "Pendente"}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
