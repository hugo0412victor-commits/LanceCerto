import { ArrowDownLeft, ArrowUpRight, Banknote, BriefcaseBusiness, CalendarClock, CarFront, CircleDollarSign, HandCoins, Landmark, LineChart, ReceiptText, Settings2, SlidersHorizontal, TrendingUp, WalletCards } from "lucide-react";
import { saveExpenseAction, saveManualFinancialEntryAction, updateFinancialEntryStatusAction } from "@/app/actions";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHOD_OPTIONS, PAYMENT_STATUS_OPTIONS, VEHICLE_STATUS_LABELS } from "@/lib/constants";
import { getFinancialOverview, getExpensesOverview } from "@/lib/data";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";

const moneyMetrics = [
  ["Saldo em caixa", "cashBalance", WalletCards],
  ["Entradas no período", "periodIn", ArrowDownLeft],
  ["Saídas no período", "periodOut", ArrowUpRight],
  ["Contas a pagar", "accountsPayable", CalendarClock],
  ["Contas a receber", "accountsReceivable", ReceiptText],
  ["Total investido em estoque", "totalInvestedInStock", Landmark],
  ["Capital em análise", "analysisCapital", CarFront],
  ["Capital em preparação", "preparationCapital", BriefcaseBusiness],
  ["Lucro bruto", "grossProfit", CircleDollarSign],
  ["Lucro líquido", "netProfit", TrendingUp]
] as const;

const financialAreas = [
  ["Dashboard Financeiro", "Visão consolidada de caixa, lucro, margem, ROI e capital parado."],
  ["Movimentações", "Livro razão central com entradas, saídas, ajustes, origem e validação."],
  ["Contas a Pagar", "Saídas pendentes, vencidas, parciais e pagas por veículo ou operação."],
  ["Contas a Receber", "Recebimentos de vendas, sinais, parcelas e saldos por cliente."],
  ["Centros de Custo por Veículo", "Cada lote com investimento, pendências, venda, margem e ROI."],
  ["Despesas por Veículo", "Gastos que impactam diretamente custo, lucro líquido e ROI do lote."],
  ["Despesas Operacionais", "Custos gerais que não entram automaticamente no centro de custo."],
  ["Margem e Lucratividade", "Ranking de veículos, margem negativa e comparativo previsto x realizado."],
  ["Comissões e Parceiros", "Controle financeiro de comissões e parceiros vinculados."],
  ["Vendas e Recebimentos", "Integração financeira com vendas, quitação e saldo a receber."],
  ["Relatórios Financeiros", "Fluxo de caixa, DRE simplificada, CSV e análises por categoria."],
  ["Configurações Financeiras", "Categorias, subcategorias, contas e regras de cálculo."]
];

const financialAreaTargets = [
  "#dashboard-financeiro",
  "#movimentacoes",
  "#contas-pagar",
  "#contas-receber",
  "#centros-custo",
  "#nova-despesa-veiculo",
  "#novo-lancamento",
  "#margem-lucratividade",
  "#configuracoes-financeiras",
  "#contas-receber",
  "#relatorios-financeiros",
  "#configuracoes-financeiras"
] as const;

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "neutral"
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "good" | "alert";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "alert"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-border bg-white/82 text-primary";

  return (
    <div className={`flex min-h-[132px] flex-col justify-between rounded-[1.2rem] border p-4 shadow-sm ${toneClass}`}>
      <div className="flex min-h-10 items-start justify-between gap-3">
        <p className="max-w-[12rem] text-xs font-semibold uppercase leading-5 tracking-[0.14em] opacity-75">{label}</p>
        <Icon className="h-4 w-4 shrink-0" />
      </div>
      <p className="mt-3 break-words text-2xl font-semibold leading-8 tracking-normal">{value}</p>
    </div>
  );
}

function SimpleBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 0;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium text-foreground">{label}</span>
        <span className="shrink-0 font-semibold text-primary">{formatCurrency(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const tone = value === "PAID" || value === "RECEIVED" || value === "SETTLED" ? "success" : value === "CANCELLED" ? "danger" : "warning";
  return <Badge tone={tone}>{value}</Badge>;
}

function EditableEntryStatus({
  entryId,
  status,
  compact = false
}: {
  entryId: string;
  status: string;
  compact?: boolean;
}) {
  return (
    <form action={updateFinancialEntryStatusAction} className="min-w-[142px]">
      <input type="hidden" name="entryId" value={entryId} />
      <Select
        name="status"
        defaultValue={status}
        aria-label="Editar status financeiro"
        className={compact ? "h-10 rounded-xl px-3 text-xs" : "h-11 rounded-xl px-3 text-xs"}
      >
        <option value="PENDING">Pendente</option>
        <option value="PAID">Pago</option>
        <option value="RECEIVED">Recebido</option>
        <option value="OVERDUE">Vencido</option>
        <option value="PARTIAL">Parcial</option>
        <option value="CANCELLED">Cancelado</option>
      </Select>
      <Button type="submit" variant="ghost" className="mt-1 h-8 w-full rounded-xl px-2 py-1 text-xs">
        Aplicar
      </Button>
    </form>
  );
}

export default async function ExpensesPage() {
  const [financial, legacy] = await Promise.all([getFinancialOverview(), getExpensesOverview()]);
  const categoryMax = Math.max(...financial.charts.expensesByCategory.map((item) => item.value), 1);
  const statusMax = Math.max(...financial.charts.investmentByStatus.map((item) => item.value), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Financeiro LanceCerto"
        description="Livro razão, contas, centros de custo por veículo, margem, ROI e preservação dos dados financeiros antigos."
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/exports/financial-ledger?format=csv"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/18 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:border-primary/35 hover:bg-primary/5"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Exportar relatório
            </a>
            <a
              href="#nova-despesa-veiculo"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/18 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:border-primary/35 hover:bg-primary/5"
            >
              <ReceiptText className="h-4 w-4" />
              Nova despesa por veÃ­culo
            </a>
            <a
              href="#novo-lancamento"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-transparent bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-glow transition hover:bg-[#C88914]"
            >
              <Banknote className="h-4 w-4" />
              Nova movimentação
            </a>
          </div>
        }
      />

      {financial.legacyStatus.needsSync ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold text-primary">Dados antigos aguardando sincronização</p>
              <p className="mt-1 text-sm text-muted">
                Existem {financial.legacyStatus.legacyExpensesCount} gastos, {financial.legacyStatus.legacySalesCount} vendas e {financial.legacyStatus.legacyCashFlowsCount} fluxos legados. Rode <code>npm run finance:sync</code> para popular o livro razão sem duplicar registros.
              </p>
            </div>
            <Badge tone="warning">modo compatibilidade</Badge>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Filtros financeiros" description="Refine por período, veículo, origem, fornecedor, categoria, pagamento e status." />
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <Input name="from" type="date" aria-label="Periodo inicial" />
            <Input name="to" type="date" aria-label="Periodo final" />
            <Select name="vehicleStatus" aria-label="Status do veiculo">
              <option value="">Status do veículo</option>
              {Object.entries(VEHICLE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Select name="vehicleId" aria-label="Veiculo">
              <option value="">Veículo/lote</option>
              {financial.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.stockCode} {vehicle.brand} {vehicle.model}</option>
              ))}
            </Select>
            <Select name="supplierId" aria-label="Fornecedor">
              <option value="">Fornecedor</option>
              {financial.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </Select>
            <Select name="categoryId" aria-label="Categoria financeira">
              <option value="">Categoria</option>
              {financial.categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
            <Select name="paymentMethod" aria-label="Forma de pagamento">
              <option value="">Pagamento</option>
              {PAYMENT_METHOD_OPTIONS.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </Select>
            <Select name="paymentStatus" aria-label="Status do pagamento">
              <option value="">Status</option>
              {PAYMENT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </Select>
          </form>
        </CardContent>
      </Card>

      <div id="dashboard-financeiro" className="grid auto-rows-fr gap-3 md:grid-cols-3 xl:grid-cols-6">
        {moneyMetrics.map(([label, key, Icon]) => (
          <MetricCard
            key={key}
            label={label}
            value={formatCurrency(financial.metrics[key])}
            icon={Icon}
            tone={key === "netProfit" || key === "grossProfit" || key === "cashBalance" ? "good" : key === "accountsPayable" ? "alert" : "neutral"}
          />
        ))}
        <MetricCard label="Margem média" value={formatPercent(financial.metrics.marginAverage)} icon={LineChart} />
        <MetricCard label="ROI médio" value={formatPercent(financial.metrics.roiAverage)} icon={TrendingUp} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card id="movimentacoes" className="h-full">
          <CardHeader title="Movimentações" description="Entradas, saídas e legados centralizados no FinancialEntry." actions={<Badge tone="info">{financial.entries.length} registros</Badge>} />
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background/70 text-muted">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                  <th className="px-4 py-3 font-medium">Veículo</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {financial.recentEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/60">
                    <td className="px-4 py-3">{formatDate(entry.competenceDate ?? entry.dueDate ?? entry.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{entry.description}</p>
                      <p className="text-xs text-muted">{entry.category?.name ?? "Sem categoria"} {entry.isAnomalous ? "• legado anômalo" : ""}</p>
                    </td>
                    <td className="px-4 py-3"><Badge tone={entry.isAnomalous ? "warning" : "neutral"}>{entry.sourceType}</Badge></td>
                    <td className="px-4 py-3">{entry.vehicle?.stockCode ?? "Operacional"}</td>
                    <td className="px-4 py-3"><EditableEntryStatus entryId={entry.id} status={entry.status} compact /></td>
                    <td className={`px-4 py-3 text-right font-semibold ${entry.type === "IN" ? "text-emerald-700" : "text-slate-900"}`}>
                      {entry.type === "IN" ? "+" : "-"} {formatCurrency(Number(entry.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card id="novo-lancamento" className="h-full">
          <CardHeader title="Novo lançamento central" description="Entradas e saídas manuais já entram no livro razão financeiro." />
          <CardContent>
            <form action={saveManualFinancialEntryAction} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Tipo</span>
                <Select name="type">
                  <option value="OUT">Saída</option>
                  <option value="IN">Entrada</option>
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Valor</span>
                <Input name="amount" required />
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Descrição</span>
                <Input name="description" required />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Categoria</span>
                <Select name="categoryId">
                  <option value="">Padrão do sistema</option>
                  {financial.categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Veículo</span>
                <Select name="vehicleId">
                  <option value="">Operacional</option>
                  {financial.vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>{vehicle.stockCode} • {[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}</option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Fornecedor</span>
                <Select name="supplierId">
                  <option value="">Não vincular</option>
                  {financial.suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Cliente</span>
                <Input name="customerName" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Competência</span>
                <Input name="competenceDate" type="date" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Vencimento</span>
                <Input name="dueDate" type="date" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Status</span>
                <Select name="status">
                  <option value="">Automático</option>
                  <option value="PENDING">Pendente</option>
                  <option value="PAID">Pago</option>
                  <option value="RECEIVED">Recebido</option>
                  <option value="PARTIAL">Parcial</option>
                  <option value="CANCELLED">Cancelado</option>
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Forma</span>
                <Select name="paymentMethod">
                  <option value="">Selecione</option>
                  {PAYMENT_METHOD_OPTIONS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Observações</span>
                <Textarea name="notes" />
              </label>
              <Button type="submit" variant="primary" className="md:col-span-2">Salvar movimentação</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-stretch gap-6 xl:grid-cols-2">
        <Card id="contas-pagar" className="h-full">
          <CardHeader title="Contas a pagar" description="Saídas pendentes, pagas, parciais ou vencidas." />
          <CardContent className="space-y-3">
            {financial.payables.slice(0, 8).map((payable) => (
              <div key={payable.id} className="grid min-h-[112px] items-center gap-3 rounded-2xl border border-border bg-white/75 p-4 md:grid-cols-[minmax(0,1fr)_150px_140px]">
                <div className="min-w-0">
                  <p className="font-semibold">{payable.transaction.description}</p>
                  <p className="text-sm text-muted">{payable.vehicle?.stockCode ?? "Operacional"} • {payable.supplier?.name ?? "Sem fornecedor"}</p>
                </div>
                <EditableEntryStatus entryId={payable.transactionId} status={payable.status} compact />
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(Number(payable.amount))}</p>
                  <p className="text-xs text-muted">vence {formatDate(payable.dueDate)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card id="contas-receber" className="h-full">
          <CardHeader title="Contas a receber" description="Vendas, sinais, parcelas e saldos a receber." />
          <CardContent className="space-y-3">
            {financial.receivables.slice(0, 8).map((receivable) => (
              <div key={receivable.id} className="grid min-h-[112px] items-center gap-3 rounded-2xl border border-border bg-white/75 p-4 md:grid-cols-[minmax(0,1fr)_150px_140px]">
                <div className="min-w-0">
                  <p className="font-semibold">{receivable.transaction.description}</p>
                  <p className="text-sm text-muted">{receivable.vehicle?.stockCode ?? "Sem veículo"} • {receivable.customerName ?? "Cliente pendente"}</p>
                </div>
                <EditableEntryStatus entryId={receivable.transactionId} status={receivable.status} compact />
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(Number(receivable.amount))}</p>
                  <p className="text-xs text-muted">vence {formatDate(receivable.dueDate)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid items-stretch gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="h-full">
          <CardHeader title="Despesas por categoria" description="Composição dos custos no livro razão." />
          <CardContent className="space-y-4">
            {financial.charts.expensesByCategory.slice(0, 9).map((item) => (
              <SimpleBar key={item.name} label={item.name} value={item.value} max={categoryMax} />
            ))}
          </CardContent>
        </Card>

        <Card id="centros-custo" className="h-full">
          <CardHeader title="Centros de custo por veículo" description="Custo acumulado, pendências, venda, lucro, margem e ROI por lote." />
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background/70 text-muted">
                  <th className="px-4 py-3 font-medium">Veículo</th>
                  <th className="px-4 py-3 font-medium">Custo</th>
                  <th className="px-4 py-3 font-medium">Pendente</th>
                  <th className="px-4 py-3 font-medium">Venda</th>
                  <th className="px-4 py-3 font-medium">Recebido</th>
                  <th className="px-4 py-3 font-medium">Lucro líquido</th>
                  <th className="px-4 py-3 font-medium">ROI</th>
                </tr>
              </thead>
              <tbody>
                {financial.summaries.map((summary) => (
                  <tr key={summary.id} className="border-b border-border/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{summary.vehicle.stockCode ?? "Sem código"}</p>
                      <p className="text-xs text-muted">{[summary.vehicle.brand, summary.vehicle.model].filter(Boolean).join(" ")}</p>
                    </td>
                    <td className="px-4 py-3">{formatCurrency(Number(summary.totalCost))}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(summary.pendingExpenses))}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(summary.actualSalePrice || summary.expectedSalePrice))}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(summary.receivedAmount))}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(Number(summary.netProfit))}</td>
                    <td className="px-4 py-3">{formatPercent(Number(summary.roiPercent))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <div id="margem-lucratividade" className="grid auto-rows-fr gap-6 xl:grid-cols-3">
        <Card className="h-full">
          <CardHeader title="Investimento por status" description="Capital parado por etapa do veículo." />
          <CardContent className="space-y-4">
            {financial.charts.investmentByStatus.map((item) => (
              <SimpleBar key={item.status} label={VEHICLE_STATUS_LABELS[item.status as keyof typeof VEHICLE_STATUS_LABELS] ?? item.status} value={item.value} max={statusMax} />
            ))}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader title="Margem e lucratividade" description="Top veículos por lucro líquido e atenção a margens negativas." />
          <CardContent className="space-y-3">
            {financial.topProfitVehicles.slice(0, 6).map((summary) => (
              <div key={summary.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white/75 p-3">
                <div>
                  <p className="font-semibold">{summary.vehicle.stockCode}</p>
                  <p className="text-xs text-muted">Margem {formatPercent(Number(summary.marginPercent))}</p>
                </div>
                <p className="font-semibold text-primary">{formatCurrency(Number(summary.netProfit))}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card id="relatorios-financeiros" className="h-full">
          <CardHeader title="Relatórios financeiros" description="Base pronta para CSV, PDF e Excel em próxima evolução." />
          <CardContent className="grid gap-3">
            {["Fluxo de caixa", "DRE simplificada", "Contas a pagar", "Contas a receber", "Lucro por veículo", "Despesas por fornecedor", "Comparativo previsto x realizado"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-2xl border border-border bg-white/75 px-4 py-3">
                <span className="font-medium">{item}</span>
                <Badge tone="info">CSV</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid items-stretch gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card id="nova-despesa-veiculo" className="h-full">
          <CardHeader title="Nova despesa por veículo" description="Compatibilidade com o cadastro antigo de gastos, agora sincronizado ao livro razão." />
          <CardContent>
            <form action={saveExpenseAction} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Veículo</span>
                <Select name="vehicleId" required>
                  {legacy.vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>{vehicle.stockCode} • {[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}</option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Descrição</span>
                <Input name="description" required />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Categoria antiga</span>
                <Select name="categoryId">
                  {legacy.categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Fornecedor</span>
                <Select name="supplierId">
                  <option value="">Não vincular</option>
                  {legacy.suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </Select>
              </label>
              {[
                ["date", "Competência", "date"],
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
                  {PAYMENT_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Forma</span>
                <Select name="paymentMethod">
                  <option value="">Selecione</option>
                  {PAYMENT_METHOD_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </Select>
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Observação</span>
                <Textarea name="note" />
              </label>
              <Button type="submit" variant="primary" className="md:col-span-2">Salvar despesa por veículo</Button>
            </form>
          </CardContent>
        </Card>

        <Card id="configuracoes-financeiras" className="h-full">
          <CardHeader title="Configurações financeiras" description="Categorias, subcategorias, contas, parceiros e regras preservadas como estrutura evolutiva." />
          <CardContent className="grid auto-rows-fr gap-3 md:grid-cols-2">
            {financialAreas.map(([title, description], index) => (
              <a
                key={title}
                href={financialAreaTargets[index] ?? "#dashboard-financeiro"}
                className="flex min-h-[132px] flex-col justify-between rounded-2xl border border-border bg-white/75 p-4 transition hover:border-accent/50 hover:bg-white hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-primary">{title}</p>
                  <Settings2 className="h-4 w-4 text-muted" />
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>

      {financial.anomalousLegacyEntries.length > 0 ? (
        <Card>
          <CardHeader title="Legados preservados/anômalos" description="Entradas do CashFlow antigo preservadas, fora dos cálculos principais até validação." />
          <CardContent className="space-y-3">
            {financial.anomalousLegacyEntries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div>
                  <p className="font-semibold text-amber-900">{entry.description}</p>
                  <p className="text-sm text-amber-700">{entry.legacyReference} • {entry.notes}</p>
                </div>
                <p className="font-semibold text-amber-900">{formatCurrency(Number(entry.amount))}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
