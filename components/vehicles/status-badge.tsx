import { Badge } from "@/components/ui/badge";
import { VEHICLE_STATUS_LABELS } from "@/lib/constants";
import type { VehicleStatus } from "@/lib/prisma-enums";

const toneMap: Record<VehicleStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  ANALISE_LOTE: "warning",
  ARREMATADO: "info",
  AGUARDANDO_PAGAMENTO: "warning",
  PAGO: "info",
  AGUARDANDO_RETIRADA: "warning",
  RETIRADO: "info",
  VISTORIA_INICIAL: "info",
  ORCAMENTO_REPAROS: "warning",
  MECANICA: "warning",
  FUNILARIA: "warning",
  PINTURA: "warning",
  ESTETICA: "info",
  DOCUMENTACAO: "danger",
  PRECIFICACAO: "info",
  FOTOS_ANUNCIO: "info",
  ANUNCIADO: "success",
  EM_NEGOCIACAO: "info",
  VENDIDO: "success",
  TRANSFERIDO: "success",
  FINALIZADO: "success",
  CANCELADO: "danger"
};

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  return (
    <Badge tone={toneMap[status]} className="whitespace-nowrap">
      {VEHICLE_STATUS_LABELS[status]}
    </Badge>
  );
}
