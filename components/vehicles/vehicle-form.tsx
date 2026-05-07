import { saveVehicleAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { VEHICLE_STATUS_LABELS } from "@/lib/constants";
import { VehicleStatus } from "@/lib/prisma-enums";

type VehicleFormProps = {
  vehicle?: Record<string, unknown> | null;
  auctionHouses: Array<{ id: string; name: string }>;
};

function dateValue(value?: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function VehicleForm({ vehicle, auctionHouses }: VehicleFormProps) {
  return (
    <form action={saveVehicleAction} className="space-y-6">
      <input type="hidden" name="id" defaultValue={String(vehicle?.id ?? "")} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Origem do lote" description="Dados de captura, leiloeira e identificação principal." />
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Código interno</span>
              <Input name="stockCode" defaultValue={String(vehicle?.stockCode ?? "")} />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium">Link do lote</span>
              <Input name="lotUrl" defaultValue={String(vehicle?.lotUrl ?? "")} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Leiloeira</span>
              <Select name="auctionHouseId" defaultValue={String(vehicle?.auctionHouseId ?? "")}>
                <option value="">Selecione</option>
                {auctionHouses.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Código do lote</span>
              <Input name="lotCode" defaultValue={String(vehicle?.lotCode ?? "")} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Status do veículo</span>
              <Select name="status" defaultValue={String(vehicle?.status ?? VehicleStatus.ANALISE_LOTE)}>
                {Object.entries(VEHICLE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Data do leilão</span>
              <Input name="auctionDate" type="date" defaultValue={dateValue(vehicle?.auctionDate)} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Data do arremate</span>
              <Input name="bidDate" type="date" defaultValue={dateValue(vehicle?.bidDate)} />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium">Observações</span>
              <Textarea name="notes" defaultValue={String(vehicle?.notes ?? "")} />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Dados do veículo" description="Todos os campos permanecem editáveis, mesmo com importação parcial." />
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              ["brand", "Marca"],
              ["model", "Modelo"],
              ["version", "Versão"],
              ["manufacturingYear", "Ano fabricação"],
              ["modelYear", "Ano modelo"],
              ["plate", "Placa"],
              ["plateFinal", "Final da placa"],
              ["chassis", "Chassi"],
              ["chassisType", "Tipo de chassi"],
              ["color", "Cor"],
              ["fuel", "Combustível"],
              ["transmission", "Câmbio"],
              ["mileage", "Quilometragem"],
              ["documentType", "Documento"],
              ["mountType", "Tipo de monta"],
              ["condition", "Condição do veículo"],
              ["yard", "Pátio"],
              ["city", "Cidade"],
              ["state", "Estado"]
            ].map(([name, label]) => (
              <label key={name} className="space-y-2 text-sm">
                <span className="font-medium">{label}</span>
                <Input name={name} defaultValue={String(vehicle?.[name] ?? "")} />
              </label>
            ))}
            <label className="space-y-2 text-sm">
              <span className="font-medium">Chave</span>
              <Select name="hasKey" defaultValue={String(vehicle?.hasKey ?? "")}>
                <option value="">Pendente</option>
                <option value="true">Sim</option>
                <option value="false">Nao</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Funcionamento</span>
              <Select name="runningCondition" defaultValue={String(vehicle?.runningCondition ?? "")}>
                <option value="">Pendente</option>
                <option value="true">Funciona</option>
                <option value="false">Não confirmado</option>
              </Select>
            </label>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Financeiro e margem" description="O motor de cálculo atualiza custo total, margem, ROI e lance máximo recomendado." />
        <CardContent className="grid gap-4 md:grid-cols-3">
          {[
            ["fipeValue", "Valor FIPE"],
            ["marketEstimatedValue", "Valor de mercado estimado"],
            ["bidValue", "Valor de arremate"],
            ["auctionCommission", "Comissão do leilão"],
            ["administrativeFees", "Taxas administrativas"],
            ["yardCost", "Pátio"],
            ["towCost", "Guincho"],
            ["documentationExpected", "Documentação"],
            ["repairsExpected", "Reparos previstos"],
            ["predictedSalePrice", "Preço de venda previsto"]
          ].map(([name, label]) => (
            <label key={name} className="space-y-2 text-sm">
              <span className="font-medium">{label}</span>
              <Input name={name} defaultValue={String(vehicle?.[name] ?? "")} />
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Snapshot e consistência" description="Confirmação do snapshot e data de congelamento das informações capturadas." />
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Snapshot confirmado</span>
            <Select name="snapshotConfirmed" defaultValue={String(vehicle?.snapshotConfirmed ?? false)}>
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Data do snapshot</span>
            <Input name="snapshotDate" type="date" defaultValue={dateValue(vehicle?.snapshotDate)} />
          </label>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">
          O sistema salva dados incompletos, marca pendências automaticamente e recalcula os indicadores.
        </p>
        <Button type="submit" variant="primary">
          Salvar veículo
        </Button>
      </div>
    </form>
  );
}
