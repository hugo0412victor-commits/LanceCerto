import Link from "next/link";
import { updateVehicleStatusAction } from "@/app/actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { VehicleStatusBadge } from "@/components/vehicles/status-badge";
import { VEHICLE_STATUS_LABELS } from "@/lib/constants";
import { VehicleStatus } from "@/lib/prisma-enums";

const columns: VehicleStatus[] = [
  "ANALISE_LOTE",
  "ARREMATADO",
  "AGUARDANDO_PAGAMENTO",
  "PAGO",
  "AGUARDANDO_RETIRADA",
  "RETIRADO",
  "VISTORIA_INICIAL",
  "ORCAMENTO_REPAROS",
  "MECANICA",
  "FUNILARIA",
  "PINTURA",
  "ESTETICA",
  "DOCUMENTACAO",
  "PRECIFICACAO",
  "FOTOS_ANUNCIO",
  "ANUNCIADO",
  "EM_NEGOCIACAO",
  "VENDIDO",
  "TRANSFERIDO",
  "FINALIZADO"
];

type BoardVehicle = {
  id: string;
  stockCode?: string | null;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  status: VehicleStatus;
  completenessPercent: number;
  pendingFields: string[];
  opportunityScore?: { score: number } | null;
  inspectionSummary?: {
    total: number;
    completed: number;
    progressPercent: number;
    attentionCount: number;
    notOkCount: number;
  } | null;
  inspectionReadyForRepairs?: boolean;
};

export function KanbanBoard({ vehicles }: { vehicles: BoardVehicle[] }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4">
        {columns.map((column) => {
          const columnVehicles = vehicles.filter((vehicle) => vehicle.status === column);

          return (
            <Card key={column} className="min-h-[320px] w-[320px] shrink-0">
              <CardHeader title={VEHICLE_STATUS_LABELS[column]} description={`${columnVehicles.length} veiculo(s)`} />
              <CardContent className="space-y-3">
                {columnVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="rounded-3xl border border-border bg-white/80 p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{vehicle.stockCode ?? "Sem codigo"}</p>
                          <p className="text-sm text-muted">
                            {[vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ")}
                          </p>
                        </div>
                        <VehicleStatusBadge status={vehicle.status} />
                      </div>

                      <p className="text-xs uppercase tracking-[0.16em] text-muted">
                        Completeness {vehicle.completenessPercent}% • Score {vehicle.opportunityScore?.score ?? 0}
                      </p>

                      {vehicle.status === "VISTORIA_INICIAL" ? (
                        <div className="rounded-2xl border border-border/80 bg-background/60 px-3 py-3 text-xs text-muted">
                          <p className="font-semibold text-primary">
                            Checklist {vehicle.inspectionSummary?.completed ?? 0}/{vehicle.inspectionSummary?.total ?? 0} itens
                          </p>
                          <p className="mt-1">{vehicle.inspectionSummary?.progressPercent ?? 0}% concluido</p>
                          {(vehicle.inspectionSummary?.attentionCount ?? 0) > 0 || (vehicle.inspectionSummary?.notOkCount ?? 0) > 0 ? (
                            <p className="mt-1">
                              {(vehicle.inspectionSummary?.attentionCount ?? 0)} atencao • {(vehicle.inspectionSummary?.notOkCount ?? 0)} nao confere
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {vehicle.pendingFields.length > 0 ? (
                        <p className="text-xs text-muted">{vehicle.pendingFields.length} pendencia(s) para revisar.</p>
                      ) : null}

                      <form action={updateVehicleStatusAction} className="space-y-2">
                        <input type="hidden" name="vehicleId" value={vehicle.id} />
                        <Select name="status" defaultValue={vehicle.status}>
                          {Object.entries(VEHICLE_STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                        <button type="submit" className="w-full rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-white">
                          Atualizar etapa
                        </button>
                      </form>

                      <div className="space-y-2">
                        <Link href={`/vehicles/${vehicle.id}`} className="block text-center text-sm font-semibold text-accent">
                          {vehicle.status === "VISTORIA_INICIAL" ? "Abrir checklist" : "Abrir detalhe"}
                        </Link>

                        {vehicle.status === "VISTORIA_INICIAL" && vehicle.inspectionReadyForRepairs ? (
                          <form action={updateVehicleStatusAction}>
                            <input type="hidden" name="vehicleId" value={vehicle.id} />
                            <input type="hidden" name="status" value="ORCAMENTO_REPAROS" />
                            <button type="submit" className="w-full rounded-2xl border border-primary/20 bg-primary/8 px-4 py-2 text-sm font-semibold text-primary">
                              Sugerir ir para orcamento
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
