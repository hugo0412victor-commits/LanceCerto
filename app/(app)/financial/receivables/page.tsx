import { ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyFinancialState } from "@/components/financial/empty-financial-state";
import { FinancialFilters } from "@/components/financial/financial-filters";
import { FinancialPageHeader } from "@/components/financial/financial-page-header";
import { FinancialSummaryCard } from "@/components/financial/financial-summary-card";
import { ReceivablesTable } from "@/components/financial/financial-table";
import { getFinancialOverview } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export default async function FinancialReceivablesPage() {
  const financial = await getFinancialOverview();
  const overdue = financial.receivables.filter((item) => item.status === "OVERDUE");
  const received = financial.receivables.filter((item) => item.status === "RECEIVED");

  return (
    <div className="space-y-6">
      <FinancialPageHeader title="Contas a Receber" description="Acompanhe recebimentos pendentes, recebidos, vencidos e parcelas." />
      <FinancialFilters vehicles={financial.vehicles} suppliers={financial.suppliers} categories={financial.categories} compact />
      <div className="grid auto-rows-fr gap-3 md:grid-cols-3">
        <FinancialSummaryCard label="Saldo a receber" value={formatCurrency(financial.metrics.accountsReceivable)} icon={ReceiptText} />
        <FinancialSummaryCard label="Vencidos" value={`${overdue.length} lancamentos`} icon={ReceiptText} tone="alert" />
        <FinancialSummaryCard label="Recebidos" value={`${received.length} lancamentos`} icon={ReceiptText} tone="good" />
      </div>
      <Card>
        <CardHeader title="Recebimentos" description="Cliente, parcelas, veiculo vinculado e status de recebimento." />
        <CardContent>
          {financial.receivables.length > 0 ? <ReceivablesTable receivables={financial.receivables} /> : <EmptyFinancialState title="Nenhuma conta a receber cadastrada" />}
        </CardContent>
      </Card>
    </div>
  );
}
