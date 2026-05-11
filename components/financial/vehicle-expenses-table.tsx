"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Paperclip, Pencil, Save, Trash2, X } from "lucide-react";
import { deleteVehicleExpenseAction, markExpensePaidAction, saveExpenseAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";

type ExpenseRow = {
  id: string;
  vehicleId: string;
  categoryId: string;
  categoryCode?: string | null;
  categoryName: string;
  supplierId?: string | null;
  supplierName?: string | null;
  description: string;
  predictedAmount: number;
  actualAmount: number;
  paymentStatus: string;
  paymentMethod?: string | null;
  dueDate?: string | null;
  date?: string | null;
  proofPath?: string | null;
  note?: string | null;
};

type Option = {
  id: string;
  name: string;
};

const coreExpenseCodes = new Set(["ARREMATE", "COMISSAO_LEILAO", "TAXA_ADMINISTRATIVA"]);

function badgeTone(status: string) {
  if (status === "PAID") return "success";
  if (status === "CANCELLED") return "danger";
  return "warning";
}

export function VehicleExpensesTable({
  expenses,
  vehicleId,
  categories,
  suppliers,
  paymentStatuses,
  paymentMethods
}: {
  expenses: ExpenseRow[];
  vehicleId: string;
  categories: Option[];
  suppliers: Option[];
  paymentStatuses: string[];
  paymentMethods: string[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function markAsPaid(expenseId: string) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("expenseId", expenseId);
        formData.set("vehicleId", vehicleId);
        await markExpensePaidAction(formData);
        window.alert("Despesa marcada como paga.");
        router.refresh();
      } catch {
        window.alert("Nao foi possivel marcar a despesa como paga. Tente novamente.");
      }
    });
  }

  function deleteExpense(expense: ExpenseRow) {
    const isCoreExpense = expense.categoryCode ? coreExpenseCodes.has(expense.categoryCode) : false;
    const message = isCoreExpense
      ? "Essa despesa faz parte dos custos principais do veiculo. Excluir pode alterar o custo total e a margem. Deseja continuar?"
      : "Essa acao removera esta despesa do veiculo e recalculara os totais financeiros. Deseja continuar?";

    if (!window.confirm(`Excluir despesa?\n\n${message}`)) {
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("expenseId", expense.id);
        formData.set("vehicleId", vehicleId);
        await deleteVehicleExpenseAction(formData);
        window.alert("Despesa excluida com sucesso.");
        router.refresh();
      } catch {
        window.alert("Nao foi possivel excluir a despesa. Tente novamente.");
      }
    });
  }

  function saveEdit(formData: FormData) {
    startTransition(async () => {
      try {
        await saveExpenseAction(formData);
        setEditingId(null);
        window.alert("Despesa atualizada com sucesso.");
        router.refresh();
      } catch {
        window.alert("Nao foi possivel salvar a despesa. Tente novamente.");
      }
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-background/70 text-muted">
            <th className="px-4 py-3 font-medium">Categoria</th>
            <th className="px-4 py-3 font-medium">Descricao</th>
            <th className="px-4 py-3 text-right font-medium">Previsto</th>
            <th className="px-4 py-3 text-right font-medium">Realizado</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Vencimento</th>
            <th className="px-4 py-3 font-medium">Pagamento</th>
            <th className="px-4 py-3 font-medium">Fornecedor</th>
            <th className="px-4 py-3 font-medium">Forma</th>
            <th className="px-4 py-3 font-medium">Comprovante</th>
            <th className="px-4 py-3 font-medium">Acoes</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => {
            const editing = editingId === expense.id;

            if (editing) {
              return (
                <tr key={expense.id} className="border-b border-border/60 bg-primary/3 align-top">
                  <td colSpan={11} className="px-4 py-4">
                    <form action={saveEdit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <input type="hidden" name="id" value={expense.id} />
                      <input type="hidden" name="vehicleId" value={vehicleId} />
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">Categoria</span>
                        <Select name="categoryId" defaultValue={expense.categoryId} required>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </Select>
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">Fornecedor</span>
                        <Select name="supplierId" defaultValue={expense.supplierId ?? ""}>
                          <option value="">Sem fornecedor</option>
                          {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                          ))}
                        </Select>
                      </label>
                      <label className="space-y-2 text-sm xl:col-span-2">
                        <span className="font-medium">Descricao</span>
                        <Input name="description" defaultValue={expense.description} required />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">Valor previsto</span>
                        <Input name="predictedAmount" defaultValue={expense.predictedAmount || ""} />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">Valor realizado</span>
                        <Input name="actualAmount" defaultValue={expense.actualAmount || ""} />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">Status</span>
                        <Select name="paymentStatus" defaultValue={expense.paymentStatus}>
                          {paymentStatuses.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </Select>
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">Forma</span>
                        <Select name="paymentMethod" defaultValue={expense.paymentMethod ?? ""}>
                          <option value="">Selecione</option>
                          {paymentMethods.map((method) => (
                            <option key={method} value={method}>{method}</option>
                          ))}
                        </Select>
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">Data de pagamento</span>
                        <Input name="date" type="date" defaultValue={expense.date ?? ""} />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">Vencimento</span>
                        <Input name="dueDate" type="date" defaultValue={expense.dueDate ?? ""} />
                      </label>
                      <label className="space-y-2 text-sm xl:col-span-2">
                        <span className="font-medium">Observacao</span>
                        <Textarea name="note" defaultValue={expense.note ?? ""} />
                      </label>
                      <div className="flex flex-wrap items-end gap-2 xl:col-span-4">
                        <Button type="submit" variant="primary" disabled={isPending}>
                          <Save className="h-4 w-4" />
                          Salvar
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={isPending}>
                          <X className="h-4 w-4" />
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={expense.id} className="border-b border-border/60">
                <td className="px-4 py-3">{expense.categoryName}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-foreground">{expense.description}</p>
                  {expense.note ? <p className="text-xs text-muted">{expense.note}</p> : null}
                </td>
                <td className="px-4 py-3 text-right">{formatCurrency(expense.predictedAmount)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(expense.actualAmount)}</td>
                <td className="px-4 py-3"><Badge tone={badgeTone(expense.paymentStatus)}>{expense.paymentStatus}</Badge></td>
                <td className="px-4 py-3">{formatDate(expense.dueDate)}</td>
                <td className="px-4 py-3">{expense.paymentStatus === "PAID" ? formatDate(expense.date) : "Pendente"}</td>
                <td className="px-4 py-3">{expense.supplierName ?? "Sem fornecedor"}</td>
                <td className="px-4 py-3">{expense.paymentMethod ?? "Pendente"}</td>
                <td className="px-4 py-3">{expense.proofPath ? <a className="font-semibold text-primary" href={expense.proofPath}>Abrir</a> : "Sem anexo"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={() => setEditingId(expense.id)} disabled={isPending}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    {expense.paymentStatus !== "PAID" ? (
                      <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={() => markAsPaid(expense.id)} disabled={isPending}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Paga
                      </Button>
                    ) : null}
                    <Button type="button" variant="ghost" className="h-9 px-3 text-xs" disabled={isPending}>
                      <Paperclip className="h-3.5 w-3.5" />
                      Anexar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-3 text-xs text-red-700 hover:bg-red-50"
                      onClick={() => deleteExpense(expense)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
