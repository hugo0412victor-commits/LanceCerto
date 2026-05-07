import { PageHeader } from "@/components/common/page-header";
import { KanbanBoard } from "@/components/processes/kanban-board";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getProcessOverview } from "@/lib/data";

export default async function ProcessesPage() {
  const { vehicles, steps } = await getProcessOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operacao"
        title="Processos e kanban"
        description="Acompanhe etapa, responsavel, prazo e atrasos por veiculo."
      />

      <KanbanBoard
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          stockCode: vehicle.stockCode,
          brand: vehicle.brand,
          model: vehicle.model,
          version: vehicle.version,
          status: vehicle.status as never,
          completenessPercent: vehicle.completenessPercent,
          pendingFields: vehicle.pendingFields,
          opportunityScore: vehicle.opportunityScore,
          inspectionSummary: vehicle.inspectionSummary,
          inspectionReadyForRepairs: vehicle.inspectionReadyForRepairs
        }))}
      />

      <Card>
        <CardHeader title="Timeline base" description="Passos configurados para o fluxo operacional padrao." />
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {steps.map((step) => (
            <div key={step.id} className="rounded-3xl border border-border bg-white/75 p-4">
              <p className="font-semibold">{step.order}. {step.name}</p>
              <p className="mt-2 text-sm text-muted">Slug: {step.slug}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
