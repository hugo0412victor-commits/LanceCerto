import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyFinancialState } from "@/components/financial/empty-financial-state";
import { FinancialPageHeader } from "@/components/financial/financial-page-header";
import { CostCentersTable, ReceivablesTable } from "@/components/financial/financial-table";
import { getFinancialOverview } from "@/lib/data";

export default async function SalesReceiptsPage() {
  const financial = await getFinancialOverview();
  const soldSummaries = financial.summaries.filter((summary) => Number(summary.actualSalePrice) > 0 || summary.vehicle.sale);

  return (
    <div className="space-y-6">
      <FinancialPageHeader title="Vendas e Recebimentos" description="Vendas vinculadas aos veiculos, sinal, parcelas, quitacao e lucro final." />
      <Card>
        <CardHeader title="Recebimentos de vendas" description="Sinal, saldo a receber, parcelas e vencimentos." />
        <CardContent>
          {financial.receivables.length > 0 ? <ReceivablesTable receivables={financial.receivables} /> : <EmptyFinancialState title="Nenhum recebimento de venda encontrado" />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Resultado por venda" description="Lucro final das vendas com custo e recebimento por veiculo." />
        <CardContent>
          {soldSummaries.length > 0 ? <CostCentersTable summaries={soldSummaries} /> : <EmptyFinancialState title="Nenhuma venda financeira consolidada" />}
        </CardContent>
      </Card>
    </div>
  );
}
