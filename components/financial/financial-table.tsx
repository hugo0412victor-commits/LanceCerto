import Link from "next/link";
import { updateFinancialEntryStatusAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";

export function StatusBadge({ value }: { value: string }) {
  const tone = value === "PAID" || value === "RECEIVED" || value === "SETTLED" ? "success" : value === "CANCELLED" ? "danger" : "warning";
  return <Badge tone={tone}>{value}</Badge>;
}

export function EditableEntryStatus({
  entryId,
  status,
  compact = false
}: {
  entryId: string;
  status: string;
  compact?: boolean;
}) {
  return (
    <form action={updateFinancialEntryStatusAction} className="min-w-[142px]">
      <input type="hidden" name="entryId" value={entryId} />
      <Select
        name="status"
        defaultValue={status}
        aria-label="Editar status financeiro"
        className={compact ? "h-10 rounded-xl px-3 text-xs" : "h-11 rounded-xl px-3 text-xs"}
      >
        <option value="PENDING">Pendente</option>
        <option value="PAID">Pago</option>
        <option value="RECEIVED">Recebido</option>
        <option value="OVERDUE">Vencido</option>
        <option value="PARTIAL">Parcial</option>
        <option value="CANCELLED">Cancelado</option>
      </Select>
      <Button type="submit" variant="ghost" className="mt-1 h-8 w-full rounded-xl px-2 py-1 text-xs">
        Aplicar
      </Button>
    </form>
  );
}

export function FinancialEntriesTable({ entries }: { entries: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-background/70 text-muted">
            <th className="px-4 py-3 font-medium">Data</th>
            <th className="px-4 py-3 font-medium">Descricao</th>
            <th className="px-4 py-3 font-medium">Origem</th>
            <th className="px-4 py-3 font-medium">Veiculo</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-border/60">
              <td className="px-4 py-3">{formatDate(entry.competenceDate ?? entry.dueDate ?? entry.createdAt)}</td>
              <td className="px-4 py-3">
                <p className="font-semibold text-foreground">{entry.description}</p>
                <p className="text-xs text-muted">{entry.category?.name ?? "Sem categoria"} {entry.isAnomalous ? "- legado anomalo" : ""}</p>
              </td>
              <td className="px-4 py-3"><Badge tone={entry.isAnomalous ? "warning" : "neutral"}>{entry.sourceType}</Badge></td>
              <td className="px-4 py-3">{entry.vehicle?.stockCode ?? "Operacional"}</td>
              <td className="px-4 py-3"><EditableEntryStatus entryId={entry.id} status={entry.status} compact /></td>
              <td className={`px-4 py-3 text-right font-semibold ${entry.type === "IN" ? "text-emerald-700" : "text-slate-900"}`}>
                {entry.type === "IN" ? "+" : "-"} {formatCurrency(Number(entry.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PayablesTable({ payables }: { payables: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-background/70 text-muted">
            <th className="px-4 py-3 font-medium">Lancamento</th>
            <th className="px-4 py-3 font-medium">Fornecedor</th>
            <th className="px-4 py-3 font-medium">Veiculo</th>
            <th className="px-4 py-3 font-medium">Vencimento</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody>
          {payables.map((payable) => (
            <tr key={payable.id} className="border-b border-border/60">
              <td className="px-4 py-3 font-semibold">{payable.transaction.description}</td>
              <td className="px-4 py-3">{payable.supplier?.name ?? payable.transaction.supplier?.name ?? "Sem fornecedor"}</td>
              <td className="px-4 py-3">{payable.vehicle?.stockCode ?? payable.transaction.vehicle?.stockCode ?? "Operacional"}</td>
              <td className="px-4 py-3">{formatDate(payable.dueDate)}</td>
              <td className="px-4 py-3"><EditableEntryStatus entryId={payable.transactionId} status={payable.status} compact /></td>
              <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(payable.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReceivablesTable({ receivables }: { receivables: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-background/70 text-muted">
            <th className="px-4 py-3 font-medium">Recebimento</th>
            <th className="px-4 py-3 font-medium">Cliente</th>
            <th className="px-4 py-3 font-medium">Veiculo</th>
            <th className="px-4 py-3 font-medium">Vencimento</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody>
          {receivables.map((receivable) => (
            <tr key={receivable.id} className="border-b border-border/60">
              <td className="px-4 py-3 font-semibold">{receivable.transaction.description}</td>
              <td className="px-4 py-3">{receivable.customerName ?? "Cliente pendente"}</td>
              <td className="px-4 py-3">{receivable.vehicle?.stockCode ?? receivable.transaction.vehicle?.stockCode ?? "Sem veiculo"}</td>
              <td className="px-4 py-3">{formatDate(receivable.dueDate)}</td>
              <td className="px-4 py-3"><EditableEntryStatus entryId={receivable.transactionId} status={receivable.status} compact /></td>
              <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(receivable.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CostCentersTable({ summaries }: { summaries: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-background/70 text-muted">
            <th className="px-4 py-3 font-medium">Veiculo</th>
            <th className="px-4 py-3 font-medium">Custo</th>
            <th className="px-4 py-3 font-medium">Pendente</th>
            <th className="px-4 py-3 font-medium">Venda prevista/real</th>
            <th className="px-4 py-3 font-medium">Recebido</th>
            <th className="px-4 py-3 font-medium">Lucro</th>
            <th className="px-4 py-3 font-medium">Margem</th>
            <th className="px-4 py-3 font-medium">ROI</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => (
            <tr key={summary.id} className="border-b border-border/60">
              <td className="px-4 py-3">
                <Link href={`/financial/vehicle-expenses?vehicleId=${summary.vehicleId}`} className="font-semibold text-primary hover:underline">
                  {summary.vehicle.stockCode ?? "Sem codigo"}
                </Link>
                <p className="text-xs text-muted">{[summary.vehicle.brand, summary.vehicle.model].filter(Boolean).join(" ")}</p>
              </td>
              <td className="px-4 py-3">{formatCurrency(Number(summary.totalCost))}</td>
              <td className="px-4 py-3">{formatCurrency(Number(summary.pendingExpenses))}</td>
              <td className="px-4 py-3">{formatCurrency(Number(summary.actualSalePrice || summary.expectedSalePrice))}</td>
              <td className="px-4 py-3">{formatCurrency(Number(summary.receivedAmount))}</td>
              <td className="px-4 py-3 font-semibold">{formatCurrency(Number(summary.netProfit))}</td>
              <td className="px-4 py-3">{formatPercent(Number(summary.marginPercent))}</td>
              <td className="px-4 py-3">{formatPercent(Number(summary.roiPercent))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
