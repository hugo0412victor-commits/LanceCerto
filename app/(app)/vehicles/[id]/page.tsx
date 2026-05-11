import Link from "next/link";
import { notFound } from "next/navigation";
import { updateVehicleStatusAction } from "@/app/actions";
import { FormulaCard } from "@/components/common/formula-card";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { SaleCountdown } from "@/components/vehicles/sale-countdown";
import { VehiclePhotoGallery } from "@/components/vehicles/vehicle-photo-gallery";
import { VehicleStatusBadge } from "@/components/vehicles/status-badge";
import { VEHICLE_STATUS_LABELS } from "@/lib/constants";
import { getVehicleDetail } from "@/lib/data";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import { VehicleStatus } from "@/lib/prisma-enums";
import { calculateExpenseTotals } from "@/lib/vehicle-costs";

function formatFipeShare(value: number, fipeValue: number) {
  if (fipeValue <= 0) {
    return "FIPE pendente";
  }

  return `${formatPercent((value / fipeValue) * 100)} da FIPE`;
}

function getNextStatusSteps(status?: VehicleStatus | null) {
  const statuses = Object.keys(VEHICLE_STATUS_LABELS) as VehicleStatus[];
  const currentIndex = statuses.indexOf(status ?? VehicleStatus.ANALISE_LOTE);
  const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

  return statuses.slice(startIndex, startIndex + 3).map((nextStatus, index) => ({
    status: nextStatus,
    label: VEHICLE_STATUS_LABELS[nextStatus],
    stepNumber: index + 1
  }));
}

function getScoreCriterionLabel(key: string) {
  const labels: Record<string, string> = {
    discountToFipe: "Desconto sobre FIPE",
    projectedMargin: "Margem projetada",
    repairEase: "Facilidade de reparo",
    liquidity: "Liquidez de mercado",
    documentaryRisk: "Seguranca documental",
    estimatedSaleTime: "Velocidade de venda"
  };

  return labels[key] ?? key;
}

function getScoreBreakdownEntries(opportunityScore?: { breakdown?: unknown; weights?: unknown } | null) {
  const breakdown =
    opportunityScore?.breakdown && typeof opportunityScore.breakdown === "object"
      ? (opportunityScore.breakdown as Record<string, unknown>)
      : {};
  const weights =
    opportunityScore?.weights && typeof opportunityScore.weights === "object"
      ? (opportunityScore.weights as Record<string, unknown>)
      : {};

  return Object.keys(breakdown).map((key) => {
    const rawValue = Number(breakdown[key] ?? 0);
    const rawWeight = Number(weights[key] ?? 0);

    return {
      key,
      label: getScoreCriterionLabel(key),
      value: rawValue,
      weight: rawWeight,
      contribution: Math.round((rawValue * rawWeight) / 100)
    };
  });
}

function getGaugePoint(score: number, radius: number, centerX = 130, centerY = 138) {
  const clamped = Math.max(0, Math.min(100, score));
  const angle = Math.PI - (clamped / 100) * Math.PI;

  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY - Math.sin(angle) * radius
  };
}

function getRunningConditionLabel(value?: boolean | null) {
  if (value === true) {
    return "Motor dá partida e engrena";
  }

  if (value === false) {
    return "Não confirmado";
  }

  return "Pendente";
}

function getCopartLotUrl(lotUrl?: string | null, lotCode?: string | null) {
  if (lotUrl) {
    return lotUrl;
  }

  return lotCode ? `https://www.copart.com.br/lot/${lotCode}` : undefined;
}

export default async function VehicleDetailPage({
  params
}: {
  params: { id: string };
}) {
  const vehicle = await getVehicleDetail(params.id);

  if (!vehicle) {
    notFound();
  }

  const latestResearch = vehicle.marketResearches[0];
  const latestSimulation = vehicle.simulations[0];
  const latestRisk = vehicle.aiAnalyses.find((item) => item.analysisType === "LOT_RISK");
  const heroImageUrl = vehicle.photos[0]?.publicUrl ?? vehicle.mainPhotoUrl ?? vehicle.lotSnapshots[0]?.photoUrls?.[0] ?? "/placeholders/vehicle-1.svg";
  const vehicleDisplayName = vehicle.displayName ?? [vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ");
  const copartLotUrl = getCopartLotUrl(vehicle.lotUrl, vehicle.lotCode);
  const latestSnapshotRaw = vehicle.lotSnapshots[0]?.rawJson as
    | { extractedFields?: { runningConditionText?: string; auctionDateText?: string } }
    | undefined;
  const runningConditionLabel = latestSnapshotRaw?.extractedFields?.runningConditionText ?? getRunningConditionLabel(vehicle.runningCondition);
  const saleDateLabel = latestSnapshotRaw?.extractedFields?.auctionDateText ?? formatDateTime(vehicle.auctionDate);
  const scoreValue = Math.max(0, Math.min(100, vehicle.opportunityScore?.score ?? 0));
  const scoreBreakdownEntries = getScoreBreakdownEntries(vehicle.opportunityScore);
  const gaugeNeedleTip = getGaugePoint(scoreValue, 78);
  const gaugeNeedleBase = getGaugePoint(scoreValue, 14);
  const gaugeNeedleLeft = getGaugePoint(Math.max(scoreValue - 2.2, 0), 22);
  const gaugeNeedleRight = getGaugePoint(Math.min(scoreValue + 2.2, 100), 22);
  const nextStatusSteps = getNextStatusSteps(vehicle.status as VehicleStatus);

  const fipeValue = Number(vehicle.fipeValue ?? 0);
  const bidValue = Number(vehicle.bidValue ?? 0);
  const predictedSalePriceValue = Number(vehicle.predictedSalePrice ?? 0);
  const expenseTotals = calculateExpenseTotals(vehicle.expenses);
  const totalCurrentCostValue = expenseTotals.currentCost || Number(vehicle.totalActualCost ?? vehicle.totalPredictedCost ?? 0);
  const totalPredictedCostValue = expenseTotals.predictedCost || Number(vehicle.totalPredictedCost ?? 0);
  const predictedProfitValue = Number(vehicle.predictedProfit ?? 0);
  const predictedMarginValue = Number(vehicle.predictedMargin ?? 0);
  const financialSummary = vehicle.financialSummary;
  const financialEntries = vehicle.financialEntries ?? [];
  const minimumAcceptablePriceValue =
    totalCurrentCostValue > 0 ? totalCurrentCostValue * 1.1 : Number(vehicle.minimumAcceptablePrice ?? 0);

  const summaryCards = [
    {
      label: "FIPE",
      value: formatCurrency(fipeValue),
      detail: fipeValue > 0 ? "Base de referência" : "FIPE pendente"
    },
    {
      label: "Arremate",
      value: formatCurrency(bidValue),
      detail: formatFipeShare(bidValue, fipeValue)
    },
    {
      label: "Venda prevista",
      value: formatCurrency(predictedSalePriceValue),
      detail: formatFipeShare(predictedSalePriceValue, fipeValue)
    },
    {
      label: "Custo atual",
      value: formatCurrency(totalCurrentCostValue),
      detail: formatFipeShare(totalCurrentCostValue, fipeValue)
    },
    {
      label: "Lucro previsto",
      value: formatCurrency(predictedProfitValue),
      detail: formatFipeShare(predictedProfitValue, fipeValue)
    },
    {
      label: "Margem prevista",
      value: formatPercent(predictedMarginValue),
      detail: `ROI previsto ${formatPercent(Number(vehicle.predictedRoi ?? 0))}`
    }
  ];

  const vehicleFacts = [
    ["Estoque", vehicle.stockCode ?? "Pendente"],
    ["Lote", vehicle.lotCode ?? "Pendente"],
    ["Leiloeira", vehicle.auctionHouse?.name ?? "Não informada"],
    ["Data do leilão", saleDateLabel],
    ["Pátio", vehicle.yard ?? "Pendente"],
    ["Cidade/UF", [vehicle.city, vehicle.state].filter(Boolean).join("/") || "Pendente"],
    ["Ano", [vehicle.manufacturingYear, vehicle.modelYear].filter(Boolean).join("/") || "Pendente"],
    ["KM", vehicle.mileage ? `${vehicle.mileage.toLocaleString("pt-BR")} ${vehicle.mileageUnit ?? "km"}` : "Pendente"],
    ["Documento", vehicle.documentType ?? "Pendente"],
    ["Comitente", vehicle.sellerName ?? "Pendente"],
    ["Lote/Vaga", vehicle.yardSlot ?? "Pendente"],
    ["Chave", vehicle.hasKey === true ? "Sim" : vehicle.hasKey === false ? "Não" : "Pendente"],
    ["Blindado", vehicle.armored === true ? "Sim" : vehicle.armored === false ? "Não" : "Pendente"],
    ["Funcionamento", runningConditionLabel],
    ["Condição", vehicle.condition ?? "Pendente"]
  ];

  const areaLinks = [
    {
      href: "/expenses",
      title: "Financeiro",
      description: "Lançamentos, histórico de gastos e custos detalhados."
    },
    {
      href: "/documents",
      title: "Documentos",
      description: "Envio, consulta e organização documental."
    },
    {
      href: "/reports#checklists",
      title: "Relatórios",
      description: "Checklist de vistoria e relatório fotográfico."
    },
    {
      href: "/processes",
      title: "Processos",
      description: "Etapas operacionais e prazos do veículo."
    },
    {
      href: "/market-research",
      title: "Pesquisa de mercado",
      description: "Comparativos FIPE, anúncios e preço recomendado."
    },
    {
      href: "/simulator",
      title: "Simulação",
      description: "Cenários de compra, venda, margem e lance."
    },
    {
      href: "/sales",
      title: "Vendas",
      description: "Anúncios, leads e registro de venda."
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Resumo do veículo"
        title={vehicleDisplayName || "Veículo"}
        description="Visão executiva com dados principais, valores, score, status e resumo financeiro. Os detalhes operacionais ficam nas áreas próprias do sistema."
        actions={
          copartLotUrl ? (
            <a href={copartLotUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="accent">Abrir lote na Copart</Button>
            </a>
          ) : null
        }
      />

      <Card className="overflow-hidden">
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Ficha resumida</p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.05em] text-primary">
                  {vehicleDisplayName || "Veículo em análise"}
                </h2>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                  {vehicle.lotCode ? `Lote ${vehicle.lotCode}` : "Lote pendente"}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {vehicle.notes ?? "Resumo operacional pronto para consulta rápida."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <VehicleStatusBadge status={vehicle.status as never} />
                <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                  Score {scoreValue}
                </span>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
              <SaleCountdown saleDate={vehicle.auctionDate} sold={vehicle.sold} />
              {copartLotUrl ? (
                <a
                  href={copartLotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition hover:bg-accent/15"
                >
                  Abrir lote na Copart
                </a>
              ) : null}
            </div>
          </div>

          <div className="min-w-0">
            <VehiclePhotoGallery photos={vehicle.photos} mainImageUrl={heroImageUrl} vehicleTitle={vehicleDisplayName} />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {summaryCards.map((item) => (
              <div key={item.label} className="rounded-[1.4rem] border border-border bg-background/55 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">{item.label}</p>
                <p className="mt-2 text-xl font-semibold text-primary">{item.value}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid items-stretch gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid h-full gap-6 xl:grid-rows-[1fr_1fr]">
          <Card className="h-full">
            <CardHeader title="Dados do veículo" description="Somente os campos essenciais para leitura rápida." />
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {vehicleFacts.map(([label, value]) => (
                <div key={label} className="flex min-h-16 flex-col justify-between rounded-2xl border border-border bg-white/75 px-4 py-3">
                  <span className="text-xs uppercase tracking-[0.16em] text-muted">{label}</span>
                  <strong className="mt-1 text-sm text-foreground">{value}</strong>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="h-full [&>div]:h-full">
            <FormulaCard
              title="Resumo financeiro"
              description="Cálculos principais; lançamentos e histórico detalhado ficam em Financeiro."
              rows={[
                { label: "Custo atual", value: totalCurrentCostValue },
                { label: "Custo previsto", value: totalPredictedCostValue },
                { label: "Lucro previsto", value: predictedProfitValue },
                { label: "Margem prevista", value: predictedMarginValue, type: "percent" },
                { label: "ROI previsto", value: Number(vehicle.predictedRoi ?? 0), type: "percent" },
                { label: "Preço mínimo aceitável", value: minimumAcceptablePriceValue },
                { label: "Lance máximo recomendado", value: Number(vehicle.maxRecommendedBid ?? 0) }
              ]}
            />
          </div>
        </div>

        <div className="grid h-full">
          <Card className="h-full">
            <CardHeader title="Score de oportunidade" description="Leitura executiva do potencial de compra e revenda." />
            <CardContent>
              <div className="rounded-[1.4rem] border border-primary/12 bg-brand-mesh p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Score de oportunidade</p>
                    <p className="mt-2 font-display text-5xl font-bold tracking-[-0.06em] text-primary">{scoreValue}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">{vehicle.opportunityScore?.classification ?? "Pendente"}</p>
                    <p className="mt-1 text-sm text-muted">Completeness {vehicle.completenessPercent}%</p>
                  </div>
                </div>
                <div className="mt-5 rounded-[1.5rem] border border-white/80 bg-white/88 p-4 shadow-sm">
                  <div className="mx-auto max-w-[340px]">
                    <div className="mb-3 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                      <span className="rounded-full bg-orange-100 px-2.5 py-1 text-orange-600">Ruim</span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-600">Baixo</span>
                      <span className="rounded-full bg-lime-100 px-2.5 py-1 text-lime-700">Bom</span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">Ótimo</span>
                    </div>
                    <svg viewBox="0 0 260 224" className="w-full">
                      <path d="M40 138 A90 90 0 0 1 82 59" fill="none" stroke="#F97316" strokeWidth="24" strokeLinecap="round" />
                      <path d="M82 59 A90 90 0 0 1 130 48" fill="none" stroke="#FACC15" strokeWidth="24" strokeLinecap="round" />
                      <path d="M130 48 A90 90 0 0 1 178 59" fill="none" stroke="#A3E635" strokeWidth="24" strokeLinecap="round" />
                      <path d="M178 59 A90 90 0 0 1 220 138" fill="none" stroke="#4CAF50" strokeWidth="24" strokeLinecap="round" />
                      <path
                        d={`M ${gaugeNeedleBase.x} ${gaugeNeedleBase.y} L ${gaugeNeedleLeft.x} ${gaugeNeedleLeft.y} L ${gaugeNeedleTip.x} ${gaugeNeedleTip.y} L ${gaugeNeedleRight.x} ${gaugeNeedleRight.y} Z`}
                        fill="#7CB342"
                      />
                      <circle cx="130" cy="138" r="14" fill="#ffffff" stroke="#94A3B8" strokeWidth="4" />
                      <circle cx="130" cy="138" r="5" fill="#7CB342" />
                      <text x="34" y="176" fill="#1E293B" fontSize="16" fontWeight="800">0</text>
                      <text x="194" y="176" fill="#1E293B" fontSize="16" fontWeight="800">100</text>
                      <text x="130" y="192" fill="#0D3B5C" fontSize="28" fontWeight="800" textAnchor="middle">
                        {scoreValue}
                      </text>
                      <text x="130" y="211" fill="#475569" fontSize="10" fontWeight="700" textAnchor="middle" letterSpacing="0.12em">
                        SCORE NUMÉRICO
                      </text>
                    </svg>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Detalhes do score</p>
                  {scoreBreakdownEntries.length > 0 ? (
                    scoreBreakdownEntries.map((item) => (
                      <div key={item.key} className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/86 px-3 py-2 shadow-sm">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
                          <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
                            Nota {Math.round(item.value)} - Peso {item.weight}%
                          </p>
                        </div>
                        <span className="ml-3 shrink-0 text-sm font-semibold text-primary">{item.contribution} pts</span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/80 bg-white/86 p-4 text-sm text-muted shadow-sm">
                      O score ainda não tem composição registrada para este lote.
                    </div>
                  )}
                </div>
              </div>

            </CardContent>
          </Card>

        </div>
      </div>

      <div className="grid items-stretch gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="h-full">
          <CardHeader title="Status atual" description="Atualize a etapa e veja os próximos passos." />
          <CardContent className="flex h-full flex-col gap-4">
            <form action={updateVehicleStatusAction} className="grid gap-3 rounded-[1.4rem] border border-border bg-background/55 p-4">
              <input type="hidden" name="vehicleId" value={vehicle.id} />
              <label className="space-y-2 text-sm">
                <span className="font-medium text-foreground">Status atual</span>
                <Select name="status" defaultValue={String(vehicle.status ?? VehicleStatus.ANALISE_LOTE)}>
                  {Object.entries(VEHICLE_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <Button type="submit" variant="primary" className="h-11 w-full">
                Salvar status
              </Button>
            </form>

            <div className="grid gap-2">
              {nextStatusSteps.map((step) => (
                <div key={step.status} className="flex items-center gap-3 rounded-2xl border border-border bg-white/75 px-3 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {step.stepNumber}
                  </span>
                  <span className="min-w-0 text-sm font-semibold text-foreground">{step.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader title="Resumo da análise" description="Leitura curta de risco, mercado e simulação." />
          <CardContent className="flex h-full flex-col gap-3 text-sm">
            <div className="rounded-2xl border border-border bg-white/75 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Risco do lote</p>
              <p className="mt-2 font-medium leading-6">{latestRisk?.summary ?? "Análise de risco ainda pendente."}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Mercado</p>
                <p className="mt-2 font-semibold text-primary">{formatCurrency(Number(latestResearch?.marketAverage ?? vehicle.marketEstimatedValue ?? 0))}</p>
                <p className="mt-1 text-xs text-muted">{latestResearch ? `${latestResearch.listingsCount} anúncios considerados` : "Pesquisa pendente"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Simulação</p>
                <p className="mt-2 font-semibold text-primary">{latestSimulation?.recommendation ?? "Pendente"}</p>
                <p className="mt-1 text-xs text-muted">Margem {formatPercent(Number(latestSimulation?.predictedMargin ?? vehicle.predictedMargin ?? 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Áreas detalhadas" description="A ficha fica curta; use as sessões abaixo para trabalhar cada etapa." />
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {areaLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[1.4rem] border border-border bg-background/55 p-4 transition hover:border-accent/40 hover:bg-white"
            >
              <p className="font-semibold text-primary">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Financeiro do veículo" description="Centro de custo individual com despesas, contas, recebimentos, margem, ROI e histórico do livro razão." />
        <CardContent className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Investido", Number(financialSummary?.totalCost ?? totalCurrentCostValue)],
              ["Pendente a pagar", Number(financialSummary?.pendingExpenses ?? 0)],
              ["Venda prevista", Number(financialSummary?.expectedSalePrice ?? vehicle.predictedSalePrice ?? 0)],
              ["Venda realizada", Number(financialSummary?.actualSalePrice ?? vehicle.actualSalePrice ?? 0)],
              ["Recebido", Number(financialSummary?.receivedAmount ?? 0)],
              ["Saldo a receber", Number(financialSummary?.receivableBalance ?? 0)],
              ["Lucro líquido", Number(financialSummary?.netProfit ?? vehicle.actualProfit ?? 0)],
              ["ROI", Number(financialSummary?.roiPercent ?? vehicle.actualRoi ?? 0)]
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-border bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
                <p className="mt-2 text-lg font-semibold text-primary">
                  {label === "ROI" ? formatPercent(Number(value)) : formatCurrency(Number(value))}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-white/75">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background/70 text-muted">
                  <th className="px-4 py-3 font-medium">Movimentação</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {financialEntries.slice(0, 10).map((entry) => (
                  <tr key={entry.id} className="border-b border-border/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{entry.description}</p>
                      <p className="text-xs text-muted">{entry.category?.name ?? "Sem categoria"} • {formatDateTime(entry.competenceDate ?? entry.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">{entry.sourceType}</td>
                    <td className="px-4 py-3">{entry.status}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${entry.type === "IN" ? "text-emerald-700" : "text-slate-900"}`}>
                      {entry.type === "IN" ? "+" : "-"} {formatCurrency(Number(entry.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
