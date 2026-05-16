import { Activity, Banknote, CarFront, ChartSpline, FileWarning, Gavel, HandCoins, TrendingUp } from "lucide-react";
import { AuctionSourcesMarquee } from "@/components/auction-sources-marquee";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { getDashboardData } from "@/lib/data";

export default async function DashboardPage() {
  const { metrics, charts, expectedCashIn } = await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Visão geral"
        title="Dashboard executivo"
        description="Leitura financeira e operacional da carteira para decisões mais rápidas, seguras e rentáveis."
      />

      <Card className="overflow-hidden bg-brand-mesh">
        <CardContent className="grid gap-5 p-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <Badge tone="warning">Radar de performance</Badge>
            <h2 className="mt-4 max-w-2xl font-display text-3xl font-bold tracking-[-0.05em] text-primary">
              Controle seu capital com visão clara de retorno, giro e oportunidades de margem.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              O LanceCerto centraliza investimento, lucro previsto, operação dos lotes e andamento dos veículos para que sua gestão seja precisa do arremate à venda.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Leituras ativas", `${metrics.vehiclesCount}`, "Veículos monitorados em carteira"],
              ["Lucro previsto", formatCurrency(metrics.lucroPrevisto), "Resultado potencial consolidado"],
              ["Receita prevista", formatCurrency(metrics.retornoPrevisto), "Entrada estimada de caixa"],
              ["Capital alocado", formatCurrency(metrics.totalInvested), "Base investida na operação"]
            ].map(([label, value, helper]) => (
              <div key={label} className="rounded-[1.6rem] border border-white/80 bg-white/85 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">{label}</p>
                <p className="mt-3 font-display text-2xl font-bold tracking-[-0.04em] text-primary">{value}</p>
                <p className="mt-2 text-sm text-muted">{helper}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Investimento total" value={metrics.totalInvested} trend="up" helper="Capital já alocado" icon={Banknote} />
        <StatCard label="Capital em carteira" value={metrics.capitalParado} helper="Veículos ainda não vendidos" icon={HandCoins} />
        <StatCard label="Receita prevista" value={metrics.retornoPrevisto} trend="up" icon={TrendingUp} />
        <StatCard label="Lucro estimado" value={metrics.lucroPrevisto} trend="up" icon={ChartSpline} />
        <StatCard label="Lucro realizado" value={metrics.lucroReal} trend="up" icon={Activity} />
        <StatCard label="Margem média prevista" value={metrics.margemMediaPrevista} format="percent" icon={Gavel} />
        <StatCard label="Margem média real" value={metrics.margemMediaReal} format="percent" icon={FileWarning} />
        <StatCard label="Tempo médio de giro" value={metrics.averageTurnover} format="number" helper="Dias entre arremate e venda" icon={CarFront} />
      </div>

      <AuctionSourcesMarquee />

      <DashboardCharts
        profitByVehicle={charts.profitByVehicle}
        expensesByCategory={charts.expensesByCategory}
        capitalEvolution={charts.capitalEvolution}
        statusFunnel={charts.statusFunnel}
      />

      <Card>
        <CardHeader title="Previsão de entrada de caixa" description="Veículos ainda em carteira com expectativa de receita." />
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {expectedCashIn.map((item) => (
            <div key={`${item.vehicle}-${item.status}`} className="rounded-[1.6rem] border border-border bg-background/55 p-4">
              <p className="text-sm font-semibold text-foreground">{item.vehicle || "Veículo sem identificação"}</p>
              <p className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-primary">{formatCurrency(item.value)}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted">{item.status}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
