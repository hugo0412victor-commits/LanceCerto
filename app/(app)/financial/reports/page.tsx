import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyFinancialState } from "@/components/financial/empty-financial-state";
import { FinancialPageHeader } from "@/components/financial/financial-page-header";
import { SimpleBar } from "@/components/financial/financial-sections";
import { getFinancialOverview } from "@/lib/data";

const reports = [
  "Fluxo de caixa",
  "DRE simplificada",
  "Lucro por veiculo",
  "Despesas por categoria",
  "Vendas por periodo",
  "Contas a pagar",
  "Contas a receber"
];

export default async function FinancialReportsPage() {
  const financial = await getFinancialOverview();
  const categoryMax = Math.max(...financial.charts.expensesByCategory.map((item) => item.value), 1);

  return (
    <div className="space-y-6">
      <FinancialPageHeader
        title="Relatorios Financeiros"
        description="Fluxo de caixa, DRE simplificada, lucro por veiculo, categorias e exportacoes."
        actions={
          <a href="/api/exports/financial-ledger?format=csv" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-transparent bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-glow transition hover:bg-[#C88914]">
            <Download className="h-4 w-4" />
            Exportar CSV
          </a>
        }
      />
      <div className="grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-4">
        {reports.map((report) => (
          <Card key={report}>
            <CardContent className="flex min-h-[116px] flex-col justify-between p-4">
              <p className="font-semibold text-primary">{report}</p>
              <Badge tone="info">Disponivel</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="Despesas por categoria" description="Resumo pronto para analise e exportacao." />
        <CardContent className="space-y-4">
          {financial.charts.expensesByCategory.length > 0 ? financial.charts.expensesByCategory.map((item) => (
            <SimpleBar key={item.name} label={item.name} value={item.value} max={categoryMax} />
          )) : <EmptyFinancialState title="Nenhum dado para relatorio financeiro" />}
        </CardContent>
      </Card>
    </div>
  );
}
