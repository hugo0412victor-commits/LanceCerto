import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyFinancialState } from "@/components/financial/empty-financial-state";
import { FinancialFilters } from "@/components/financial/financial-filters";
import { FinancialPageHeader } from "@/components/financial/financial-page-header";
import { FinancialSummaryCard } from "@/components/financial/financial-summary-card";
import { PayablesTable } from "@/components/financial/financial-table";
import { getFinancialOverview } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export default async function FinancialPayablesPage() {
  const financial = await getFinancialOverview();
  const overdue = financial.payables.filter((item) => item.status === "OVERDUE");
  const paid = financial.payables.filter((item) => item.status === "PAID");

  return (
    <div className="space-y-6">
      <FinancialPageHeader title="Contas a Pagar" description="Acompanhe pagamentos pendentes, vencidos, parciais e pagos." />
      <FinancialFilters vehicles={financial.vehicles} suppliers={financial.suppliers} categories={financial.categories} compact />
      <div className="grid auto-rows-fr gap-3 md:grid-cols-3">
        <FinancialSummaryCard label="Pendente a pagar" value={formatCurrency(financial.metrics.accountsPayable)} icon={CalendarClock} tone="alert" />
        <FinancialSummaryCard label="Vencidos" value={`${overdue.length} lancamentos`} icon={CalendarClock} tone="alert" />
        <FinancialSummaryCard label="Pagos" value={`${paid.length} lancamentos`} icon={CalendarClock} tone="good" />
      </div>
      <Card>
        <CardHeader title="Lancamentos a pagar" description="Fornecedor, vencimento, veiculo vinculado e status de pagamento." />
        <CardContent>
          {financial.payables.length > 0 ? <PayablesTable payables={financial.payables} /> : <EmptyFinancialState title="Nenhuma conta a pagar cadastrada" />}
        </CardContent>
      </Card>
    </div>
  );
}
