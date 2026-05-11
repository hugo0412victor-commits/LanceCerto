import { CarFront, Landmark, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyFinancialState } from "@/components/financial/empty-financial-state";
import { FinancialPageHeader } from "@/components/financial/financial-page-header";
import { FinancialSummaryCard } from "@/components/financial/financial-summary-card";
import { CostCentersTable } from "@/components/financial/financial-table";
import { getFinancialOverview } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export default async function CostCentersPage() {
  const financial = await getFinancialOverview();

  return (
    <div className="space-y-6">
      <FinancialPageHeader title="Centros de Custo" description="Cada veiculo ou lote como centro de custo, com investimento, venda, lucro, margem e ROI." />
      <div className="grid auto-rows-fr gap-3 md:grid-cols-3">
        <FinancialSummaryCard label="Veiculos monitorados" value={`${financial.summaries.length}`} icon={CarFront} />
        <FinancialSummaryCard label="Custo total" value={formatCurrency(financial.metrics.totalInvestedInStock)} icon={Landmark} />
        <FinancialSummaryCard label="Lucro liquido" value={formatCurrency(financial.metrics.netProfit)} icon={TrendingUp} tone="good" />
      </div>
      <Card>
        <CardHeader title="Centros por veiculo" description="Custo total, despesas pagas e pendentes, venda prevista ou realizada, lucro, margem e ROI." />
        <CardContent>
          {financial.summaries.length > 0 ? <CostCentersTable summaries={financial.summaries} /> : <EmptyFinancialState title="Nenhum centro de custo encontrado" />}
        </CardContent>
      </Card>
    </div>
  );
}
