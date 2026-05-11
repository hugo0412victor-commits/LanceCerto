import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyFinancialState } from "@/components/financial/empty-financial-state";
import { FinancialFilters } from "@/components/financial/financial-filters";
import { FinancialPageHeader } from "@/components/financial/financial-page-header";
import { FinancialEntriesTable } from "@/components/financial/financial-table";
import { getFinancialOverview } from "@/lib/data";

export default async function CommissionsPage() {
  const financial = await getFinancialOverview();
  const entries = financial.entries.filter((entry) => {
    const text = `${entry.description ?? ""} ${entry.category?.name ?? ""} ${entry.subcategory?.name ?? ""}`.toLowerCase();
    return text.includes("comiss") || text.includes("parceir") || text.includes("despach") || text.includes("intermedi");
  });

  return (
    <div className="space-y-6">
      <FinancialPageHeader title="Comissoes e Parceiros" description="Controle financeiro de vendedores, parceiros, despachantes, mecanicos e intermediadores." />
      <FinancialFilters vehicles={financial.vehicles} suppliers={financial.suppliers} categories={financial.categories} compact />
      <Card>
        <CardHeader title="Lancamentos de comissoes e parceiros" description="Status de pagamento, parceiro vinculado, veiculo e valor." />
        <CardContent>
          {entries.length > 0 ? <FinancialEntriesTable entries={entries} /> : <EmptyFinancialState title="Nenhuma comissao ou parceiro cadastrado" description="Quando houver lancamentos com categorias ou descricoes relacionadas a parceiros, eles aparecerao aqui." />}
        </CardContent>
      </Card>
    </div>
  );
}
