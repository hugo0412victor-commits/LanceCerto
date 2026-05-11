import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyFinancialState } from "@/components/financial/empty-financial-state";
import { FinancialFilters } from "@/components/financial/financial-filters";
import { FinancialPageHeader } from "@/components/financial/financial-page-header";
import { ManualFinancialEntryForm } from "@/components/financial/financial-sections";
import { FinancialEntriesTable } from "@/components/financial/financial-table";
import { getFinancialOverview } from "@/lib/data";

export default async function OperationalExpensesPage() {
  const financial = await getFinancialOverview();
  const entries = financial.entries.filter((entry) => entry.type === "OUT" && !entry.vehicleId);

  return (
    <div className="space-y-6">
      <FinancialPageHeader title="Despesas Operacionais" description="Despesas gerais que nao pertencem diretamente a um veiculo." />
      <FinancialFilters vehicles={financial.vehicles} suppliers={financial.suppliers} categories={financial.categories} compact />
      <Card>
        <CardHeader title="Despesas gerais" description="Aluguel, internet, sistemas, marketing, contador, taxas bancarias e demais gastos operacionais." />
        <CardContent>
          {entries.length > 0 ? <FinancialEntriesTable entries={entries} /> : <EmptyFinancialState title="Nenhuma despesa operacional registrada" />}
        </CardContent>
      </Card>
      <ManualFinancialEntryForm financial={financial} />
    </div>
  );
}
