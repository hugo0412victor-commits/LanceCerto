import { Banknote, ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyFinancialState } from "@/components/financial/empty-financial-state";
import { FinancialFilters } from "@/components/financial/financial-filters";
import { FinancialPageHeader } from "@/components/financial/financial-page-header";
import { ManualFinancialEntryForm } from "@/components/financial/financial-sections";
import { FinancialEntriesTable } from "@/components/financial/financial-table";
import { getFinancialOverview } from "@/lib/data";

export default async function FinancialMovementsPage() {
  const financial = await getFinancialOverview();

  return (
    <div className="space-y-6">
      <FinancialPageHeader
        title="Movimentacoes"
        description="Controle todas as entradas, saidas, ajustes e lancamentos financeiros."
        actions={
          <div className="flex flex-wrap gap-2">
            <a href="#novo-lancamento" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/18 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:border-primary/35 hover:bg-primary/5">
              <ReceiptText className="h-4 w-4" />
              Nova saida
            </a>
            <a href="#novo-lancamento" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-transparent bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-glow transition hover:bg-[#C88914]">
              <Banknote className="h-4 w-4" />
              Nova entrada
            </a>
          </div>
        }
      />
      <FinancialFilters vehicles={financial.vehicles} suppliers={financial.suppliers} categories={financial.categories} />
      <Card>
        <CardHeader title="Lista de lancamentos" description="Livro razao completo com origem, veiculo, categoria, status e valor." />
        <CardContent>
          {financial.entries.length > 0 ? <FinancialEntriesTable entries={financial.entries} /> : <EmptyFinancialState title="Nenhum lancamento encontrado" />}
        </CardContent>
      </Card>
      <div id="novo-lancamento">
        <ManualFinancialEntryForm financial={financial} />
      </div>
    </div>
  );
}
