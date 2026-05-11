import { LineChart, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyFinancialState } from "@/components/financial/empty-financial-state";
import { FinancialPageHeader } from "@/components/financial/financial-page-header";
import { StatusInvestmentBars } from "@/components/financial/financial-sections";
import { FinancialSummaryCard } from "@/components/financial/financial-summary-card";
import { CostCentersTable } from "@/components/financial/financial-table";
import { getFinancialOverview } from "@/lib/data";
import { formatCurrency, formatPercent } from "@/lib/format";

export default async function ProfitabilityPage() {
  const financial = await getFinancialOverview();

  return (
    <div className="space-y-6">
      <FinancialPageHeader title="Margem e Lucratividade" description="Analise lucro, margem, ROI e ranking de melhores e piores veiculos." />
      <div className="grid auto-rows-fr gap-3 md:grid-cols-3">
        <FinancialSummaryCard label="Lucro bruto" value={formatCurrency(financial.metrics.grossProfit)} icon={TrendingUp} tone="good" />
        <FinancialSummaryCard label="Margem media" value={formatPercent(financial.metrics.marginAverage)} icon={LineChart} />
        <FinancialSummaryCard label="ROI medio" value={formatPercent(financial.metrics.roiAverage)} icon={TrendingUp} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <StatusInvestmentBars financial={financial} />
        <Card>
          <CardHeader title="Ranking de lucratividade" description="Comparativo de lucro, margem e ROI por veiculo." />
          <CardContent>
            {financial.summaries.length > 0 ? <CostCentersTable summaries={financial.topProfitVehicles} /> : <EmptyFinancialState title="Nenhuma analise de lucratividade encontrada" />}
          </CardContent>
        </Card>
      </div>
      {financial.negativeMarginVehicles.length > 0 ? (
        <Card>
          <CardHeader title="Margens negativas" description="Veiculos que exigem atencao no comparativo previsto x realizado." />
          <CardContent><CostCentersTable summaries={financial.negativeMarginVehicles} /></CardContent>
        </Card>
      ) : null}
    </div>
  );
}
