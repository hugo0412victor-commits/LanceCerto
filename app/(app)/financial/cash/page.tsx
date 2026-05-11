import { ArrowDownLeft, ArrowUpRight, WalletCards } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyFinancialState } from "@/components/financial/empty-financial-state";
import { FinancialFilters } from "@/components/financial/financial-filters";
import { FinancialPageHeader } from "@/components/financial/financial-page-header";
import { SimpleBar } from "@/components/financial/financial-sections";
import { FinancialSummaryCard } from "@/components/financial/financial-summary-card";
import { FinancialEntriesTable } from "@/components/financial/financial-table";
import { getFinancialOverview } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export default async function FinancialCashPage() {
  const financial = await getFinancialOverview();
  const movementMax = Math.max(...financial.charts.entriesByMonth.map((item) => Math.max(item.entradas, item.saidas)), 1);

  return (
    <div className="space-y-6">
      <FinancialPageHeader title="Caixa" description="Saldo atual, entradas, saidas, formas de pagamento e fluxo diario ou mensal." />
      <FinancialFilters vehicles={financial.vehicles} suppliers={financial.suppliers} categories={financial.categories} compact />
      <div className="grid auto-rows-fr gap-3 md:grid-cols-3">
        <FinancialSummaryCard label="Saldo atual" value={formatCurrency(financial.metrics.cashBalance)} icon={WalletCards} tone="good" />
        <FinancialSummaryCard label="Entradas" value={formatCurrency(financial.metrics.periodIn)} icon={ArrowDownLeft} />
        <FinancialSummaryCard label="Saidas" value={formatCurrency(financial.metrics.periodOut)} icon={ArrowUpRight} tone="alert" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Fluxo mensal" description="Entradas e saidas agrupadas por competencia." />
          <CardContent className="space-y-4">
            {financial.charts.entriesByMonth.length > 0 ? financial.charts.entriesByMonth.slice(-10).map((item) => (
              <div key={item.month} className="space-y-3 rounded-2xl border border-border bg-white/75 p-4">
                <p className="font-semibold text-primary">{item.month}</p>
                <SimpleBar label="Entradas" value={item.entradas} max={movementMax} />
                <SimpleBar label="Saidas" value={item.saidas} max={movementMax} />
              </div>
            )) : <EmptyFinancialState title="Nenhum fluxo de caixa encontrado" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Historico de caixa" description="Lancamentos recentes que movimentam o caixa." />
          <CardContent>
            {financial.recentEntries.length > 0 ? <FinancialEntriesTable entries={financial.recentEntries} /> : <EmptyFinancialState title="Nenhuma movimentacao de caixa encontrada" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
