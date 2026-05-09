import { deleteExpenseAction, saveExpenseAction } from "@/app/actions";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHOD_OPTIONS, PAYMENT_STATUS_OPTIONS } from "@/lib/constants";
import { getExpensesOverview } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function ExpensesPage() {
  const { expenses, vehicles, suppliers, categories } = await getExpensesOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Financeiro"
        description="Lancamentos previstos e realizados por veiculo, fornecedor e categoria."
      />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader title="Novo lancamento" description="O sistema recalcula custo total, lucro e margem do veiculo relacionado." />
          <CardContent>
            <form action={saveExpenseAction} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Veiculo</span>
                <Select name="vehicleId" required>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.stockCode} • {[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Descricao</span>
                <Input name="description" required />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Categoria</span>
                <Select name="categoryId">
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Fornecedor</span>
                <Select name="supplierId">
                  <option value="">Nao vincular</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </label>
              {[
                ["date", "Data", "date"],
                ["dueDate", "Vencimento", "date"],
                ["predictedAmount", "Valor previsto", "text"],
                ["actualAmount", "Valor realizado", "text"]
              ].map(([name, label, type]) => (
                <label key={name} className="space-y-2 text-sm">
                  <span className="font-medium">{label}</span>
                  <Input name={name} type={type} />
                </label>
              ))}
              <label className="space-y-2 text-sm">
                <span className="font-medium">Status</span>
                <Select name="paymentStatus">
                  {PAYMENT_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Forma de pagamento</span>
                <Select name="paymentMethod">
                  <option value="">Selecione</option>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Observacao</span>
                <Textarea name="note" />
              </label>
              <button type="submit" className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white md:col-span-2">
                Salvar gasto
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Lancamentos financeiros" description="Historico completo de gastos registrados no sistema." />
          <CardContent className="space-y-3">
            {expenses.map((expense) => (
              <div key={expense.id} className="rounded-3xl border border-border bg-white/75 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Veiculo</p>
                    <p className="font-semibold">{expense.vehicle.stockCode}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Categoria</p>
                    <p className="font-semibold">{expense.category.name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Valor</p>
                    <p className="font-semibold">{formatCurrency(Number(expense.actualAmount ?? expense.predictedAmount ?? 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Data</p>
                    <p className="font-semibold">{formatDate(expense.date)}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted">
                  {expense.description}
                  {expense.supplier ? ` • ${expense.supplier.name}` : ""}
                </p>
                <form action={deleteExpenseAction} className="mt-3">
                  <input type="hidden" name="id" value={expense.id} />
                  <input type="hidden" name="vehicleId" value={expense.vehicleId} />
                  <button type="submit" className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                    Excluir gasto
                  </button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
