import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getReportsOverview } from "@/lib/data";
import { formatCurrency, formatPercent } from "@/lib/format";

const exportTargets = [
  ["vehicles", "Veículos"],
  ["financial-ledger", "Livro razÃ£o"],
  ["expenses", "Despesas legadas"],
  ["simulations", "Simulações"],
  ["market-research", "Pesquisa de mercado"]
] as const;

export default async function ReportsPage() {
  const report = await getReportsOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestão"
        title="Relatórios gerenciais"
        description="Visão financeira, operacional e comercial com exportação em CSV, Excel e PDF."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total investido" value={report.metrics.totalInvested} />
        <StatCard label="Lucro previsto" value={report.metrics.lucroPrevisto} />
        <StatCard label="Lucro realizado" value={report.metrics.lucroReal} />
        <StatCard label="Capital parado" value={report.metrics.capitalParado} />
      </div>

      <Card>
        <CardHeader title="Exportações" description="Baixe rapidamente os principais conjuntos do sistema." />
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {exportTargets.map(([resource, label]) => (
            <div key={resource} className="rounded-[1.6rem] border border-border bg-background/55 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-primary">{label}</p>
                <Badge tone="info">Exportar</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {["csv", "xlsx", "pdf"].map((format) => (
                  <Link key={format} href={`/api/exports/${resource}?format=${format}`}>
                    <Button variant="secondary" className="gap-2">
                      <Download className="h-4 w-4" />
                      {format.toUpperCase()}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section id="checklists">
        <Card>
          <CardHeader title="Checklist de vistoria" description="Resumo dos checklists por veículo, concentrado na seção de relatórios." />
          <CardContent className="space-y-3">
            {report.checklistRows.map((row) => (
              <div key={row.vehicle} className="rounded-[1.6rem] border border-border bg-background/55 p-4">
                <div className="grid gap-3 md:grid-cols-5">
                  <div className="md:col-span-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Veículo</p>
                    <p className="font-semibold">{row.vehicle}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Progresso</p>
                    <p className="font-semibold">
                      {row.completed}/{row.total} - {formatPercent(row.progressPercent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Atenção</p>
                    <p className="font-semibold">{row.attentionCount + row.notOkCount} itens</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Status</p>
                    <p className="font-semibold">{row.hasChecklist ? "Registrado" : "Pendente"}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Margem por leiloeira" description="Média prevista a partir da carteira atual." />
          <CardContent className="space-y-3">
            {report.marginByAuctionHouse.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-2xl bg-background/55 px-4 py-3">
                <span className="font-medium">{item.name}</span>
                <span className="font-semibold text-primary">{item.value.toFixed(1)}%</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Relatório comercial" description="Preço anunciado, vendido e desconto concedido." />
          <CardContent className="space-y-3">
            {report.commercialRows.map((row) => (
              <div key={`${row.vehicle}-${row.canal}`} className="rounded-[1.6rem] border border-border bg-background/55 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Veículo</p>
                    <p className="font-semibold">{row.vehicle}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Anunciado</p>
                    <p className="font-semibold">{formatCurrency(row.anunciado)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Vendido</p>
                    <p className="font-semibold">{formatCurrency(row.vendido)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Canal</p>
                    <p className="font-semibold">{row.canal}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Ranking de leiloeiras" description="Performance interna por margem e percentual de bons negócios." />
          <CardContent className="space-y-3">
            {report.auctionHouseRanking.map((item) => (
              <div key={item.name} className="rounded-[1.6rem] border border-border bg-background/55 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Leiloeira</p>
                    <p className="font-semibold">{item.name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Veículos</p>
                    <p className="font-semibold">{item.vehicles}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Margem prevista</p>
                    <p className="font-semibold">{item.avgPredictedMargin.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Bons negócios</p>
                    <p className="font-semibold">{item.goodDealsRate.toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Ranking de fornecedores" description="Ordenação por avaliação, prazo médio e impacto financeiro." />
          <CardContent className="space-y-3">
            {report.supplierRanking.map((item) => (
              <div key={item.name} className="rounded-[1.6rem] border border-border bg-background/55 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Fornecedor</p>
                    <p className="font-semibold">{item.name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Avaliação</p>
                    <p className="font-semibold">{item.rating}/5</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Prazo médio</p>
                    <p className="font-semibold">{item.averageLeadTime} dias</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Total pago</p>
                    <p className="font-semibold">{formatCurrency(item.totalPaid)}</p>
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
