import { ArrowDownLeft, ArrowUpRight, CalendarClock, LineChart, ReceiptText, TrendingUp, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyFinancialState } from "@/components/financial/empty-financial-state";
import { FinancialFilters } from "@/components/financial/financial-filters";
import { FinancialPageHeader } from "@/components/financial/financial-page-header";
import { LegacySyncNotice, SimpleBar } from "@/components/financial/financial-sections";
import { FinancialSummaryCard } from "@/components/financial/financial-summary-card";
import { PayablesTable, ReceivablesTable } from "@/components/financial/financial-table";
import { getFinancialOverview } from "@/lib/data";
import { formatCurrency, formatPercent } from "@/lib/format";

const dashboardMetrics = [
  ["Saldo em caixa", "cashBalance", WalletCards],
  ["Entradas no periodo", "periodIn", ArrowDownLeft],
  ["Saidas no periodo", "periodOut", ArrowUpRight],
  ["Lucro liquido", "netProfit", TrendingUp],
  ["Contas a pagar", "accountsPayable", CalendarClock],
  ["Contas a receber", "accountsReceivable", ReceiptText]
] as const;

export default async function FinancialDashboardPage() {
  const financial = await getFinancialOverview();
  const categoryMax = Math.max(...financial.charts.expensesByCategory.map((item) => item.value), 1);
  const movementMax = Math.max(...financial.charts.entriesByMonth.map((item) => Math.max(item.entradas, item.saidas)), 1);

  return (
    <div className="space-y-6">
      <FinancialPageHeader
        title="Dashboard Financeiro"
        description="Visao geral do caixa, lucro, margem e movimentacoes da operacao."
        actions={<Badge tone="info">{financial.entries.length} movimentacoes</Badge>}
      />
      <LegacySyncNotice financial={financial} />
      <FinancialFilters vehicles={financial.vehicles} suppliers={financial.suppliers} categories={financial.categories} compact />

      <div className="grid auto-rows-fr gap-3 md:grid-cols-3 xl:grid-cols-4">
        {dashboardMetrics.map(([label, key, Icon]) => (
          <FinancialSummaryCard
            key={key}
            label={label}
            value={formatCurrency(financial.metrics[key])}
            icon={Icon}
            tone={key === "netProfit" || key === "cashBalance" ? "good" : key === "accountsPayable" ? "alert" : "neutral"}
          />
        ))}
        <FinancialSummaryCard label="Margem media" value={formatPercent(financial.metrics.marginAverage)} icon={LineChart} />
        <FinancialSummaryCard label="ROI medio" value={formatPercent(financial.metrics.roiAverage)} icon={TrendingUp} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Entradas x saidas" description="Fluxo mensal consolidado do livro razao." />
          <CardContent className="space-y-4">
            {financial.charts.entriesByMonth.length > 0 ? financial.charts.entriesByMonth.slice(-8).map((item) => (
              <div key={item.month} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.month}</span>
                  <span className="text-muted">E {formatCurrency(item.entradas)} / S {formatCurrency(item.saidas)}</span>
                </div>
                <SimpleBar label="Entradas" value={item.entradas} max={movementMax} />
                <SimpleBar label="Saidas" value={item.saidas} max={movementMax} />
              </div>
            )) : <EmptyFinancialState title="Nenhuma movimentacao encontrada" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Despesas por categoria" description="Principais grupos de saida da operacao." />
          <CardContent className="space-y-4">
            {financial.charts.expensesByCategory.length > 0 ? financial.charts.expensesByCategory.slice(0, 8).map((item) => (
              <SimpleBar key={item.name} label={item.name} value={item.value} max={categoryMax} />
            )) : <EmptyFinancialState title="Nenhuma despesa categorizada" />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Proximos pagamentos" description="Contas a pagar em ordem de vencimento." />
          <CardContent>
            {financial.payables.length > 0 ? <PayablesTable payables={financial.payables.slice(0, 5)} /> : <EmptyFinancialState title="Nenhuma conta a pagar cadastrada" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Proximos recebimentos" description="Contas a receber e parcelas vinculadas." />
          <CardContent>
            {financial.receivables.length > 0 ? <ReceivablesTable receivables={financial.receivables.slice(0, 5)} /> : <EmptyFinancialState title="Nenhuma conta a receber cadastrada" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
