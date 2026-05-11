import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyFinancialState } from "@/components/financial/empty-financial-state";
import { FinancialPageHeader } from "@/components/financial/financial-page-header";
import { getFinancialOverview } from "@/lib/data";

export default async function FinancialSettingsPage() {
  const financial = await getFinancialOverview();

  return (
    <div className="space-y-6">
      <FinancialPageHeader title="Configuracoes Financeiras" description="Categorias, subcategorias, formas de pagamento, contas financeiras, parceiros e status." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Categorias e subcategorias" description="Estrutura do livro razao financeiro." />
          <CardContent className="space-y-3">
            {financial.categories.length > 0 ? financial.categories.map((category) => (
              <div key={category.id} className="rounded-2xl border border-border bg-white/75 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-primary">{category.name}</p>
                  <Badge tone="neutral">{category.scope}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted">{category.subcategories.length} subcategorias</p>
              </div>
            )) : <EmptyFinancialState title="Nenhuma categoria financeira cadastrada" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Parametros preparados" description="Itens mantidos para evolucao sem alterar o banco nesta remodelacao." />
          <CardContent className="grid gap-3">
            {["Formas de pagamento", "Contas financeiras", "Tipos de parceiros", "Status financeiros", "Centros de custo"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-2xl border border-border bg-white/75 px-4 py-3">
                <span className="font-medium">{item}</span>
                <Badge tone="info">Preservado</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
