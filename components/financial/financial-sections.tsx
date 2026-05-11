import { Banknote, ReceiptText } from "lucide-react";
import { saveExpenseAction, saveManualFinancialEntryAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHOD_OPTIONS, PAYMENT_STATUS_OPTIONS, VEHICLE_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

export function LegacySyncNotice({ financial }: { financial: any }) {
  return financial.legacyStatus.needsSync ? (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="font-semibold text-primary">Dados antigos aguardando sincronizacao</p>
          <p className="mt-1 text-sm text-muted">
            Existem {financial.legacyStatus.legacyExpensesCount} gastos, {financial.legacyStatus.legacySalesCount} vendas e {financial.legacyStatus.legacyCashFlowsCount} fluxos legados. Rode <code>npm run finance:sync</code> para popular o livro razao sem duplicar registros.
          </p>
        </div>
        <Badge tone="warning">modo compatibilidade</Badge>
      </CardContent>
    </Card>
  ) : null;
}

export function SimpleBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 0;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium text-foreground">{label}</span>
        <span className="shrink-0 font-semibold text-primary">{formatCurrency(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function ManualFinancialEntryForm({ financial }: { financial: any }) {
  return (
    <Card>
      <CardHeader title="Novo lancamento central" description="Entradas e saidas manuais entram no livro razao financeiro." />
      <CardContent>
        <form action={saveManualFinancialEntryAction} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Tipo</span>
            <Select name="type">
              <option value="OUT">Saida</option>
              <option value="IN">Entrada</option>
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Valor</span>
            <Input name="amount" required />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Descricao</span>
            <Input name="description" required />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Categoria</span>
            <Select name="categoryId">
              <option value="">Padrao do sistema</option>
              {financial.categories.map((category: any) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Veiculo</span>
            <Select name="vehicleId">
              <option value="">Operacional</option>
              {financial.vehicles.map((vehicle: any) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.stockCode} - {[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}</option>
              ))}
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Fornecedor</span>
            <Select name="supplierId">
              <option value="">Nao vincular</option>
              {financial.suppliers.map((supplier: any) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Cliente</span>
            <Input name="customerName" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Competencia</span>
            <Input name="competenceDate" type="date" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Vencimento</span>
            <Input name="dueDate" type="date" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Status</span>
            <Select name="status">
              <option value="">Automatico</option>
              <option value="PENDING">Pendente</option>
              <option value="PAID">Pago</option>
              <option value="RECEIVED">Recebido</option>
              <option value="PARTIAL">Parcial</option>
              <option value="CANCELLED">Cancelado</option>
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Forma</span>
            <Select name="paymentMethod">
              <option value="">Selecione</option>
              {PAYMENT_METHOD_OPTIONS.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </Select>
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Observacoes</span>
            <Textarea name="notes" />
          </label>
          <Button type="submit" variant="primary" className="md:col-span-2">
            <Banknote className="h-4 w-4" />
            Salvar movimentacao
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function VehicleExpenseForm({ legacy, selectedVehicleId }: { legacy: any; selectedVehicleId?: string }) {
  const selectedVehicle = selectedVehicleId ? legacy.vehicles.find((vehicle: any) => vehicle.id === selectedVehicleId) : null;

  return (
    <Card>
      <CardHeader title="Nova despesa por veiculo" description="Compatibilidade com o cadastro antigo de gastos, sincronizado ao livro razao." />
      <CardContent>
        <form action={saveExpenseAction} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Veiculo</span>
            {selectedVehicle ? (
              <>
                <input type="hidden" name="vehicleId" value={selectedVehicle.id} />
                <div className="rounded-2xl border border-border bg-background px-4 py-3 font-semibold text-primary">
                  {selectedVehicle.stockCode} - {[selectedVehicle.brand, selectedVehicle.model].filter(Boolean).join(" ") || selectedVehicle.title || "Veiculo selecionado"}
                </div>
              </>
            ) : (
              <Select name="vehicleId" required>
                {legacy.vehicles.map((vehicle: any) => (
                  <option key={vehicle.id} value={vehicle.id}>{vehicle.stockCode} - {[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}</option>
                ))}
              </Select>
            )}
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Descricao</span>
            <Input name="description" required />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Categoria antiga</span>
            <Select name="categoryId">
              {legacy.categories.map((category: any) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Fornecedor</span>
            <Select name="supplierId">
              <option value="">Nao vincular</option>
              {legacy.suppliers.map((supplier: any) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </Select>
          </label>
          {[
            ["date", "Competencia", "date"],
            ["dueDate", "Vencimento", "date"],
            ["predictedAmount", "Valor previsto", "text"],
            ["actualAmount", "Valor realizado", "text"]
          ].map(([name, label, type]) => (
            <label key={name} className="space-y-2 text-sm">
              <span className="font-medium">{label}</span>
              <Input name={name} type={type} />
            </label>
          ))}
          <label className="space-y-2 text-sm">
            <span className="font-medium">Status</span>
            <Select name="paymentStatus">
              {PAYMENT_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Forma</span>
            <Select name="paymentMethod">
              <option value="">Selecione</option>
              {PAYMENT_METHOD_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Observacao</span>
            <Textarea name="note" />
          </label>
          <Button type="submit" variant="primary" className="md:col-span-2">
            <ReceiptText className="h-4 w-4" />
            Salvar despesa por veiculo
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function StatusInvestmentBars({ financial }: { financial: any }) {
  const statusMax = Math.max(...financial.charts.investmentByStatus.map((item: any) => item.value), 1);

  return (
    <Card>
      <CardHeader title="Investimento por status" description="Capital parado por etapa do veiculo." />
      <CardContent className="space-y-4">
        {financial.charts.investmentByStatus.map((item: any) => (
          <SimpleBar key={item.status} label={VEHICLE_STATUS_LABELS[item.status as keyof typeof VEHICLE_STATUS_LABELS] ?? item.status} value={item.value} max={statusMax} />
        ))}
      </CardContent>
    </Card>
  );
}
