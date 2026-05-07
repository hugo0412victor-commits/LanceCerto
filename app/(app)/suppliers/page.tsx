import { saveSupplierAction } from "@/app/actions";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSuppliersOverview } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export default async function SuppliersPage() {
  const suppliers = await getSuppliersOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rede de apoio"
        title="Fornecedores"
        description="Cadastro operacional com custo medio, prazo, avaliacao e historico de pagamento."
      />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader title="Novo fornecedor" description="Relacionamento futuro com gastos, prazos e retrabalho." />
          <CardContent>
            <form action={saveSupplierAction} className="grid gap-4 md:grid-cols-2">
              {[
                ["name", "Nome"],
                ["category", "Categoria"],
                ["phone", "Telefone"],
                ["email", "E-mail"],
                ["document", "Documento"],
                ["address", "Endereco"],
                ["rating", "Avaliacao (1-5)"],
                ["averageLeadTime", "Prazo medio (dias)"],
                ["averageCost", "Custo medio"]
              ].map(([name, label]) => (
                <label key={name} className="space-y-2 text-sm">
                  <span className="font-medium">{label}</span>
                  <Input name={name} />
                </label>
              ))}
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Observacoes</span>
                <Textarea name="notes" />
              </label>
              <button type="submit" className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white md:col-span-2">
                Salvar fornecedor
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Base cadastrada" description="Visao com custo medio, prazo e quantidade de servicos." />
          <CardContent className="space-y-3">
            {suppliers.map((supplier) => (
              <div key={supplier.id} className="rounded-3xl border border-border bg-white/75 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Fornecedor</p>
                    <p className="font-semibold">{supplier.name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Categoria</p>
                    <p className="font-semibold">{supplier.category}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Prazo medio</p>
                    <p className="font-semibold">{supplier.averageLeadTime ?? 0} dias</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Custo medio</p>
                    <p className="font-semibold">{formatCurrency(Number(supplier.averageCost ?? 0))}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
