import { notFound } from "next/navigation";
import { deleteExpenseAction, deleteVehicleAction, saveExpenseAction, saveInitialInspectionAction, saveMarketResearchAction, saveSaleAction, updateVehicleStatusAction } from "@/app/actions";
import { FormulaCard } from "@/components/common/formula-card";
import { PageHeader } from "@/components/common/page-header";
import { FileUploadPanel } from "@/components/uploads/file-upload-panel";
import { Button } from "@/components/ui/button";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { VehicleStatusBadge } from "@/components/vehicles/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS, PAYMENT_STATUS_OPTIONS, PHOTO_CATEGORY_OPTIONS, VEHICLE_STATUS_LABELS } from "@/lib/constants";
import { getReferenceData, getVehicleDetail } from "@/lib/data";
import { formatCurrency, formatDate, formatDateTime, formatPercent } from "@/lib/format";
import { generateLotRiskAnalysis } from "@/lib/ai";
import { INITIAL_INSPECTION_ITEMS, INSPECTION_ITEM_STATUS_OPTIONS, getInitialInspectionSummary, parseInitialInspectionPayload } from "@/lib/inspection";
import { VehicleStatus } from "@/lib/prisma-enums";

function formatDeltaPercent(base?: number | null, value?: number | null) {
  if (!base || !value) {
    return "Pendente";
  }

  const delta = ((value - base) / base) * 100;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1).replace(".", ",")}%`;
}

function getRiskLevelMeta(riskLevel?: string | null) {
  if (riskLevel === "HIGH") {
    return {
      label: "Atenção máxima",
      className: "border-rose-200 bg-rose-50 text-rose-700"
    };
  }

  if (riskLevel === "MEDIUM") {
    return {
      label: "Acompanhamento próximo",
      className: "border-amber-200 bg-amber-50 text-amber-700"
    };
  }

  return {
    label: "Leitura favorável",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700"
  };
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

function getNextStatusSteps(status?: VehicleStatus | null) {
  const statuses = Object.keys(VEHICLE_STATUS_LABELS) as VehicleStatus[];
  const currentIndex = statuses.indexOf(status ?? VehicleStatus.ANALISE_LOTE);
  const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

  return statuses.slice(startIndex, startIndex + 4).map((nextStatus, index) => ({
    status: nextStatus,
    label: VEHICLE_STATUS_LABELS[nextStatus],
    stepNumber: index + 1
  }));
}

function formatFipeShare(value: number, fipeValue: number) {
  if (fipeValue <= 0) {
    return "FIPE pendente";
  }

  return `${formatPercent((value / fipeValue) * 100)} da FIPE`;
}

function getGaugePoint(score: number, radius: number, centerX = 130, centerY = 138) {
  const clamped = Math.max(0, Math.min(100, score));
  const angle = Math.PI - (clamped / 100) * Math.PI;

  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY - Math.sin(angle) * radius
  };
}

export default async function VehicleDetailPage({
  params
}: {
  params: { id: string };
}) {
  const [vehicle, references] = await Promise.all([getVehicleDetail(params.id), getReferenceData()]);

  if (!vehicle) {
    notFound();
  }

  const latestResearch = vehicle.marketResearches[0];
  const latestSimulation = vehicle.simulations[0];
  const latestRisk = vehicle.aiAnalyses.find((item) => item.analysisType === "LOT_RISK");
  const adCopy = vehicle.aiAnalyses.find((item) => item.analysisType === "SALE_COPY");
  const latestAnalysesByType = Array.from(
    vehicle.aiAnalyses.reduce((accumulator, analysis) => {
      if (!accumulator.has(analysis.analysisType)) {
        accumulator.set(analysis.analysisType, analysis);
      }
      return accumulator;
    }, new Map<string, (typeof vehicle.aiAnalyses)[number]>())
  ).map(([, analysis]) => analysis);
  const inspectionProcess = vehicle.processes.find((process) => process.processStep.slug === "vistoria-inicial");
  const inspectionPayload = parseInitialInspectionPayload(
    inspectionProcess?.attachments && typeof inspectionProcess.attachments === "object"
      ? (inspectionProcess.attachments as { inspectionChecklist?: unknown }).inspectionChecklist
      : undefined
  );
  const inspectionSummary = getInitialInspectionSummary(inspectionPayload);
  const heroImageUrl = vehicle.photos[0]?.publicUrl ?? vehicle.mainPhotoUrl ?? vehicle.lotSnapshots[0]?.photoUrls?.[0] ?? "/placeholders/vehicle-1.svg";
  const latestSnapshotRaw = vehicle.lotSnapshots[0]?.rawJson as
    | { extractedFields?: { runningConditionText?: string; auctionDateText?: string } }
    | undefined;
  const runningConditionLabel =
    latestSnapshotRaw?.extractedFields?.runningConditionText ??
    (vehicle.runningCondition === true ? "Motor dá partida e engrena" : vehicle.runningCondition === false ? "Não confirmado" : "Pendente");
  const saleDateLabel = latestSnapshotRaw?.extractedFields?.auctionDateText ?? formatDateTime(vehicle.auctionDate);

  const fallbackRiskAnalysis = generateLotRiskAnalysis({
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version,
    manufacturingYear: vehicle.manufacturingYear,
    modelYear: vehicle.modelYear,
    condition: vehicle.condition,
    documentType: vehicle.documentType,
    mountType: vehicle.mountType,
    mileage: vehicle.mileage,
    hasKey: vehicle.hasKey,
    runningCondition: vehicle.runningCondition,
    notes: vehicle.notes,
    fipeValue: Number(vehicle.fipeValue ?? 0),
    marketEstimatedValue: Number(vehicle.marketEstimatedValue ?? 0),
    bidValue: Number(vehicle.bidValue ?? 0),
    auctionCommission: Number(vehicle.auctionCommission ?? 0),
    administrativeFees: Number(vehicle.administrativeFees ?? 0),
    yardCost: Number(vehicle.yardCost ?? 0),
    towCost: Number(vehicle.towCost ?? 0),
    documentationExpected: Number(vehicle.documentationExpected ?? 0),
    repairsExpected: Number(vehicle.repairsExpected ?? 0),
    predictedSalePrice: Number(vehicle.predictedSalePrice ?? 0)
  });

  const riskAnalysis = (latestRisk?.output as typeof fallbackRiskAnalysis | undefined) ?? fallbackRiskAnalysis;
  const riskMeta = getRiskLevelMeta(latestRisk?.riskLevel ?? riskAnalysis.riskLevel);
  const scoreBreakdownEntries = getScoreBreakdownEntries(vehicle.opportunityScore);
  const scoreValue = Math.max(0, Math.min(100, vehicle.opportunityScore?.score ?? 0));
  const gaugeNeedleTip = getGaugePoint(scoreValue, 78);
  const gaugeNeedleBase = getGaugePoint(scoreValue, 14);
  const gaugeNeedleLeft = getGaugePoint(Math.max(scoreValue - 2.2, 0), 22);
  const gaugeNeedleRight = getGaugePoint(Math.min(scoreValue + 2.2, 100), 22);
  const nextStatusSteps = getNextStatusSteps(vehicle.status as VehicleStatus);
  const fipeValue = Number(vehicle.fipeValue ?? 0);
  const bidValue = Number(vehicle.bidValue ?? 0);
  const predictedSalePriceValue = Number(vehicle.predictedSalePrice ?? 0);
  const totalPredictedCostValue = Number(vehicle.totalPredictedCost ?? 0);
  const predictedProfitValue = Number(vehicle.predictedProfit ?? 0);
  const predictedMarginValue = Number(vehicle.predictedMargin ?? 0);
  const minimumAcceptablePriceValue =
    totalPredictedCostValue > 0 ? totalPredictedCostValue * 1.1 : Number(vehicle.minimumAcceptablePrice ?? 0);
  const financialSummaryCards = [
    {
      label: "FIPE",
      value: formatCurrency(fipeValue),
      detail: fipeValue > 0 ? "Base de referencia" : "FIPE pendente"
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
      label: "Custo previsto",
      value: formatCurrency(totalPredictedCostValue),
      detail: formatFipeShare(totalPredictedCostValue, fipeValue)
    },
    {
      label: "Lucro previsto",
      value: formatCurrency(predictedProfitValue),
      detail: formatFipeShare(predictedProfitValue, fipeValue)
    },
    {
      label: "Margem prevista",
      value: formatPercent(predictedMarginValue),
      detail: `Lucro equivale a ${formatFipeShare(predictedProfitValue, fipeValue)}`
    }
  ];

  const marketSnapshot = {
    fipeValue: Number(latestResearch?.fipeValue ?? vehicle.fipeValue ?? 0),
    marketAverage: Number(latestResearch?.marketAverage ?? vehicle.marketEstimatedValue ?? vehicle.predictedSalePrice ?? 0),
    competitivePrice: Number(latestResearch?.suggestedCompetitivePrice ?? vehicle.predictedSalePrice ?? vehicle.marketEstimatedValue ?? 0),
    aggressivePrice: Number(
      latestResearch?.suggestedAggressivePrice ??
        (vehicle.predictedSalePrice ? Number(vehicle.predictedSalePrice) * 0.97 : vehicle.marketEstimatedValue ?? 0)
    ),
    minimumAcceptablePrice: Number(latestResearch?.minimumAcceptablePrice ?? minimumAcceptablePriceValue),
    listingsCount: latestResearch?.listingsCount ?? 0,
    liquidityLevel: latestResearch?.liquidityLevel ?? "UNKNOWN"
  };
  const hasMarketResearch = Boolean(latestResearch);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Detalhe do veículo"
        title={[vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ") || "Veículo"}
        description="Cada veículo é tratado como um projeto completo com snapshot, custos, processos, pesquisa de mercado e histórico."
      />

      <div className="grid gap-6 min-[1800px]:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card className="min-w-0">
          <CardContent className="grid gap-6 p-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
            <div className="grid gap-4">
              <div className="overflow-hidden rounded-[1.75rem] border border-border bg-white shadow-sm">
              <img
                src={heroImageUrl}
                alt="Foto principal do veículo"
                className="h-[260px] w-full object-cover xl:h-[320px]"
              />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {[
                  ["Lote", vehicle.lotCode ?? "Pendente"],
                  ["Leiloeira", vehicle.auctionHouse?.name ?? "Nao informada"],
                  ["Data do leilao", saleDateLabel],
                  ["Patio", vehicle.yard ?? "Pendente"]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border/80 bg-background/60 px-4 py-3">
                    <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted">{label}</p>
                    <p className="mt-2 text-sm font-semibold text-primary">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Análise do lote</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {[vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ") || "Veículo em análise"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <VehicleStatusBadge status={vehicle.status as never} />
                  <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                    Score {vehicle.opportunityScore?.score ?? 0}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.92fr)]">
                <form action={updateVehicleStatusAction} className="rounded-[1.6rem] border border-border bg-background/55 p-4">
                  <input type="hidden" name="vehicleId" value={vehicle.id} />
                  <div className="grid gap-5">
                    <div>
                      <p className="text-sm font-semibold text-primary">Atualizar status do lote</p>
                      <p className="mt-1 text-xs leading-5 text-muted">Altere a etapa atual sem precisar descer ate o formulario completo.</p>
                    </div>
                    <div className="grid gap-3">
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
                      <Button type="submit" variant="primary" className="h-12 w-full px-5">
                        Salvar status
                      </Button>
                    </div>
                    <div className="space-y-2 border-t border-border/70 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Proximas etapas</p>
                      {nextStatusSteps.length > 0 ? (
                        nextStatusSteps.map((step) => (
                          <div key={step.status} className="flex items-center gap-3 rounded-2xl border border-border/80 bg-white/75 px-3 py-2.5 shadow-sm">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {step.stepNumber}
                            </span>
                            <span className="min-w-0 truncate text-sm font-semibold text-foreground">{step.label}</span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-border/80 bg-white/75 p-4 text-sm text-muted shadow-sm">
                          Este lote nao tem etapas posteriores no fluxo atual.
                        </div>
                      )}
                    </div>
                  </div>
                </form>

                <div className="rounded-[1.6rem] border border-primary/12 bg-brand-mesh p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Score de oportunidade</p>
                      <p className="mt-2 font-display text-4xl font-bold tracking-[-0.06em] text-primary">
                        {vehicle.opportunityScore?.score ?? 0}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary shadow-sm">
                      {vehicle.opportunityScore?.classification ?? "Pendente"}
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className="rounded-[1.8rem] border border-white/80 bg-white/88 p-4 shadow-sm">
                      <div className="mx-auto max-w-[320px]">
                        <div className="mb-3 flex items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em]">
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
                    <div className="mt-3 space-y-2">
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
                          O score ainda nao tem composicao registrada para este lote.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {financialSummaryCards.map((item) => (
                  <div key={item.label} className="overflow-hidden rounded-3xl border border-border bg-white/85 p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">{item.label}</p>
                    <p className="mt-3 text-[0.95rem] font-semibold leading-tight tracking-tight lg:text-[1.02rem]">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                <p className="font-semibold">Pendências atuais</p>
                <p className="mt-2 max-w-2xl leading-6">
                  {vehicle.pendingFields.length > 0 ? vehicle.pendingFields.join(", ") : "Nenhuma pendência automática detectada."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0 min-[1800px]:sticky min-[1800px]:top-6">
        <FormulaCard
          title="Leitura financeira"
          description="Explicação dos cálculos obrigatórios usados no projeto."
          rows={[
            { label: "Custo total previsto", value: totalPredictedCostValue },
            { label: "Lucro previsto", value: Number(vehicle.predictedProfit ?? 0) },
            { label: "Margem prevista", value: Number(vehicle.predictedMargin ?? 0), type: "percent" },
            { label: "ROI previsto", value: Number(vehicle.predictedRoi ?? 0), type: "percent" },
            { label: "Preço mínimo aceitável", value: minimumAcceptablePriceValue },
            { label: "Lance máximo recomendado", value: Number(vehicle.maxRecommendedBid ?? 0) }
          ]}
        />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 overflow-x-auto rounded-3xl border border-border bg-white/70 p-3 text-sm">
        {[
          ["#resumo", "Resumo"],
          ["#dados", "Dados do lote"],
          ["#snapshot", "Snapshot"],
          ["#fotos", "Fotos"],
          ["#documentos", "Documentos"],
          ["#gastos", "Gastos"],
          ["#processos", "Processos"],
          ["#mercado", "Pesquisa de mercado"],
          ["#simulacao", "Simulação"],
          ["#anuncios", "Anúncios"],
          ["#venda", "Venda"],
          ["#historico", "Histórico"]
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-2xl px-3 py-2 font-medium text-muted transition hover:bg-white hover:text-foreground">
            {label}
          </a>
        ))}
      </div>

      <section id="resumo" className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Resumo operacional" description="Indicadores centrais do projeto individual." />
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between rounded-2xl bg-white/75 px-4 py-3">
              <span>Leiloeira</span>
              <strong>{vehicle.auctionHouse?.name ?? "Não informada"}</strong>
            </div>
            <div className="flex justify-between rounded-2xl bg-white/75 px-4 py-3">
              <span>Lote</span>
              <strong>{vehicle.lotCode ?? "Pendente"}</strong>
            </div>
            <div className="flex justify-between rounded-2xl bg-white/75 px-4 py-3">
              <span>Data do leilão</span>
              <strong>{saleDateLabel}</strong>
            </div>
            <div className="flex justify-between rounded-2xl bg-white/75 px-4 py-3">
              <span>Pátio</span>
              <strong>{vehicle.yard ?? "Pendente"}</strong>
            </div>
            <div className="flex justify-between rounded-2xl bg-white/75 px-4 py-3">
              <span>Tipo de chassi</span>
              <strong>{vehicle.chassisType ?? "Pendente"}</strong>
            </div>
            <div className="flex justify-between rounded-2xl bg-white/75 px-4 py-3">
              <span>Condição de func.</span>
              <strong>{runningConditionLabel}</strong>
            </div>
            <div className="flex justify-between rounded-2xl bg-white/75 px-4 py-3">
              <span>Completeness</span>
              <strong>{vehicle.completenessPercent}%</strong>
            </div>
            <div className="flex justify-between rounded-2xl bg-white/75 px-4 py-3">
              <span>Score de oportunidade</span>
              <strong>{vehicle.opportunityScore?.classification ?? "Pendente"}</strong>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Radar comercial do lote" description="Leitura executiva para apoiar decisão de compra, lance e revenda." />
          <CardContent className="space-y-4 text-sm">
            <div className={`rounded-2xl border px-4 py-3 ${riskMeta.className}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{riskMeta.label}</p>
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">{riskAnalysis.recommendation}</span>
              </div>
              <p className="mt-2 leading-6">{riskAnalysis.justification}</p>
            </div>

            <div className="rounded-2xl bg-white/75 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Resumo do lote</p>
              <p className="mt-2 font-medium leading-6">{riskAnalysis.summary}</p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl bg-white/75 p-4">
                <p className="font-semibold">Pontos de atenção</p>
                <p className="mt-2 leading-6">
                  {riskAnalysis.risks.length > 0 ? riskAnalysis.risks.join(" • ") : "Nenhum risco crítico identificado na leitura atual."}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 p-4">
                <p className="font-semibold">Validações recomendadas</p>
                <p className="mt-2 leading-6">
                  {riskAnalysis.questions.length > 0
                    ? riskAnalysis.questions.join(" • ")
                    : "Documentação, funcionamento e margem estão coerentes para seguir com a análise."}
                </p>
              </div>
              <div className="rounded-2xl bg-white/75 p-4">
                <p className="font-semibold">Ajustes para a tese</p>
                <p className="mt-2 leading-6">
                  {riskAnalysis.attentionPoints.length > 0
                    ? riskAnalysis.attentionPoints.join(" • ")
                    : "Sem ajustes urgentes na tese de compra com os dados atuais."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="dados">
        <VehicleForm vehicle={vehicle as unknown as Record<string, unknown>} auctionHouses={references.auctionHouses} />
      </section>

      <section id="snapshot">
        <Card>
          <CardHeader title="Snapshot do lote" description="O link de origem não é dependência permanente. Os dados ficam preservados internamente." />
          <CardContent className="space-y-4">
            {vehicle.lotSnapshots.map((snapshot) => (
              <div key={snapshot.id} className="rounded-3xl border border-border bg-white/75 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Origem</p>
                    <p className="font-medium">{snapshot.sourceUrl}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Capturado em</p>
                    <p className="font-medium">{formatDate(snapshot.capturedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Status da importação</p>
                    <p className="font-medium">{snapshot.importStatus}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Alertas</p>
                    <p className="font-medium">{snapshot.alerts.join(", ") || "Sem alertas"}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section id="fotos">
        <FileUploadPanel
          vehicleId={vehicle.id}
          type="photo"
          title="Galeria de fotos"
          description="Upload manual, categorização e persistência interna das imagens."
          categoryOptions={PHOTO_CATEGORY_OPTIONS}
          items={vehicle.photos.map((photo) => ({
            id: photo.id,
            category: photo.category,
            publicUrl: photo.publicUrl,
            caption: photo.caption
          }))}
        />
      </section>

      <section id="documentos">
        <FileUploadPanel
          vehicleId={vehicle.id}
          type="document"
          title="Documentos do veículo"
          description="Arquivos organizados por categoria, com upload, visualização e vinculação ao lote."
          categoryOptions={DOCUMENT_CATEGORY_OPTIONS}
          items={vehicle.documents.map((document) => ({
            id: document.id,
            category: document.category,
            publicUrl: document.publicUrl,
            fileName: document.fileName,
            note: document.note
          }))}
        />
      </section>

      <section id="gastos" className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader title="Novo gasto" description="Controle previsto x realizado por categoria e fornecedor." />
          <CardContent>
            <form action={saveExpenseAction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="vehicleId" value={vehicle.id} />
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Descrição</span>
                <Input name="description" required />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Categoria</span>
                <Select name="categoryId" required>
                  {references.expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Fornecedor</span>
                <Select name="supplierId">
                  <option value="">Não vincular</option>
                  {references.suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Data</span>
                <Input name="date" type="date" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Vencimento</span>
                <Input name="dueDate" type="date" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Valor previsto</span>
                <Input name="predictedAmount" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Valor realizado</span>
                <Input name="actualAmount" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Status de pagamento</span>
                <Select name="paymentStatus">
                  {PAYMENT_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Forma de pagamento</span>
                <Select name="paymentMethod">
                  <option value="">Selecione</option>
                  {PAYMENT_METHOD_OPTIONS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Observação</span>
                <Textarea name="note" />
              </label>
              <button type="submit" className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white md:col-span-2">
                Salvar gasto
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Histórico de gastos" description="Lançamentos vinculados ao veículo e impacto na margem." />
          <CardContent className="space-y-3">
            {vehicle.expenses.map((expense) => (
              <div key={expense.id} className="rounded-3xl border border-border bg-white/75 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{expense.description}</p>
                    <p className="text-sm text-muted">
                      {expense.category.name}
                      {expense.supplier ? ` • ${expense.supplier.name}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(Number(expense.actualAmount ?? expense.predictedAmount ?? 0))}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">{expense.paymentStatus}</p>
                  </div>
                </div>
                <form action={deleteExpenseAction} className="mt-3">
                  <input type="hidden" name="id" value={expense.id} />
                  <input type="hidden" name="vehicleId" value={vehicle.id} />
                  <button type="submit" className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                    Excluir gasto
                  </button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section id="processos">
        <Card>
          <CardHeader title="Processos" description="Etapas operacionais vinculadas ao projeto do veículo." />
          <CardContent className="space-y-3">
            {vehicle.processes.map((process) => (
              <div key={process.id} className="rounded-3xl border border-border bg-white/75 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{process.processStep.name}</p>
                    <p className="text-sm text-muted">{process.notes ?? "Sem observações"}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{process.status}</p>
                    <p className="text-muted">Prazo {formatDate(process.dueDate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section id="vistoria-inicial" className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <CardHeader title="Resumo da vistoria inicial" description="Checklist operacional para a etapa logo apos a retirada do veiculo." />
          <CardContent className="space-y-3">
            {[
              ["Itens preenchidos", `${inspectionSummary.completed}/${inspectionSummary.total}`],
              ["Progresso", `${inspectionSummary.progressPercent}%`],
              ["OK", String(inspectionSummary.okCount)],
              ["Atencao", String(inspectionSummary.attentionCount)],
              ["Nao confere", String(inspectionSummary.notOkCount)]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl border border-border bg-background/60 px-4 py-3">
                <span className="text-sm text-muted">{label}</span>
                <span className="font-semibold text-primary">{value}</span>
              </div>
            ))}
            <div className="rounded-2xl border border-border bg-background/60 px-4 py-4 text-sm text-muted">
              Preencha a vistoria na ficha do carro. Assim o checklist fica salvo junto do lote e pode servir de base para orcamento, mecanica e documentacao.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Checklist de vistoria inicial" description="Marque o status de cada item e registre observacoes da retirada." />
          <CardContent>
            <form action={saveInitialInspectionAction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="vehicleId" value={vehicle.id} />
              <label className="space-y-2 text-sm">
                <span className="font-medium">Responsavel pela vistoria</span>
                <Input name="inspectorName" defaultValue={inspectionPayload.inspectorName ?? ""} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Data da vistoria</span>
                <Input name="inspectedAt" type="date" defaultValue={inspectionPayload.inspectedAt ?? ""} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Quilometragem observada</span>
                <Input name="odometer" defaultValue={inspectionPayload.odometer ?? ""} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Nivel de combustivel</span>
                <Input name="fuelLevel" defaultValue={inspectionPayload.fuelLevel ?? ""} placeholder="Ex.: 1/4 de tanque" />
              </label>
              {INITIAL_INSPECTION_ITEMS.map((item) => (
                <label key={item.key} className="space-y-2 text-sm">
                  <span className="font-medium">{item.label}</span>
                  <Select name={`inspection_${item.key}`} defaultValue={inspectionPayload.items[item.key] ?? ""}>
                    {INSPECTION_ITEM_STATUS_OPTIONS.map((option) => (
                      <option key={option.value || "empty"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </label>
              ))}
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Itens faltantes ou ausentes</span>
                <Textarea name="missingItems" defaultValue={inspectionPayload.missingItems ?? ""} />
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Observacoes gerais</span>
                <Textarea name="generalNotes" defaultValue={inspectionPayload.generalNotes ?? ""} />
              </label>
              <button type="submit" className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-panel transition hover:bg-[#0A314C] md:col-span-2">
                Salvar checklist de vistoria
              </button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section id="mercado" className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader title="Nova pesquisa de mercado" description="Modo manual assistido para quando APIs ou scraping não estiverem disponíveis." />
          <CardContent>
            <form action={saveMarketResearchAction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="vehicleId" value={vehicle.id} />
              <label className="space-y-2 text-sm">
                <span className="font-medium">Fonte</span>
                <Select name="source">
                  {references.marketSources.map((source) => (
                    <option key={source.id} value={source.code}>
                      {source.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Link do anúncio</span>
                <Input name="listingUrl" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Preço</span>
                <Input name="price" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Ano</span>
                <Input name="year" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Versão</span>
                <Input name="version" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">KM</span>
                <Input name="mileage" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Cidade</span>
                <Input name="city" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Estado</span>
                <Input name="state" />
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Observações</span>
                <Textarea name="notes" />
              </label>
              <button type="submit" className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white md:col-span-2">
                Registrar pesquisa
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Comparativo FIPE x mercado"
            description={
              hasMarketResearch
                ? "Média de mercado, liquidez e faixas de preço registradas para este lote."
                : "Painel inicial com estimativas internas até a pesquisa de mercado completa ser registrada."
            }
          />
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">FIPE</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(marketSnapshot.fipeValue)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Média de mercado</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(marketSnapshot.marketAverage)}</p>
                <p className="mt-2 text-xs text-muted">Vs FIPE: {formatDeltaPercent(marketSnapshot.fipeValue, marketSnapshot.marketAverage)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Preço competitivo</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(marketSnapshot.competitivePrice)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Preço agressivo</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(marketSnapshot.aggressivePrice)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Preço mínimo aceitável</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(marketSnapshot.minimumAcceptablePrice)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Liquidez</p>
                <p className="mt-2 text-xl font-semibold">{marketSnapshot.liquidityLevel}</p>
                <p className="mt-2 text-xs text-muted">
                  {hasMarketResearch ? `${marketSnapshot.listingsCount} anúncios considerados.` : "Estimativa inicial com base nos dados internos do lote."}
                </p>
              </div>
            </div>

            {latestResearch ? (
              <div className="space-y-3">
                {latestResearch.listings.map((listing) => (
                  <div key={listing.id} className="rounded-3xl border border-border bg-white/75 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{listing.source}</p>
                        <p className="text-sm text-muted">{listing.listingUrl ?? "Entrada manual"}</p>
                      </div>
                      <p className="font-semibold">{formatCurrency(Number(listing.price ?? 0))}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-white/75 p-4 text-sm text-muted">
                Pesquisa externa ainda não registrada. Este comparativo está usando FIPE, precificação prevista e margem do próprio lote para orientar a análise inicial.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section id="simulacao">
        <Card>
          <CardHeader title="Simulação vinculada" description="Histórico rápido das simulações associadas ao veículo." />
          <CardContent className="space-y-3">
            {vehicle.simulations.map((simulation) => (
              <div key={simulation.id} className="rounded-3xl border border-border bg-white/75 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Custo previsto</p>
                    <p className="font-semibold">{formatCurrency(Number(simulation.totalPredictedCost ?? 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Lucro previsto</p>
                    <p className="font-semibold">{formatCurrency(Number(simulation.predictedProfit ?? 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Margem</p>
                    <p className="font-semibold">{formatPercent(Number(simulation.predictedMargin ?? 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Recomendação</p>
                    <p className="font-semibold">{simulation.recommendation ?? "Pendente"}</p>
                  </div>
                </div>
              </div>
            ))}
            {!latestSimulation ? <p className="text-sm text-muted">Nenhuma simulação vinculada ainda.</p> : null}
          </CardContent>
        </Card>
      </section>

      <section id="anuncios">
        <Card>
          <CardHeader title="Controle de anúncios" description="Estrutura pronta para integração futura com portais de venda." />
          <CardContent className="space-y-3">
            {adCopy ? (
              <div className="rounded-3xl border border-border bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Sugestões de copy</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">OLX</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {String((adCopy.output as { olxDescription?: string } | undefined)?.olxDescription ?? "Copy não disponível.")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Webmotors</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {String((adCopy.output as { webmotorsDescription?: string } | undefined)?.webmotorsDescription ?? "Copy não disponível.")}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            {vehicle.advertisements.map((ad) => (
              <div key={ad.id} className="rounded-3xl border border-border bg-white/75 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{ad.portal}</p>
                    <p className="text-sm text-muted">{ad.listingUrl ?? "Sem link publicado"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(Number(ad.listedPrice ?? 0))}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">
                      {ad.status} • {ad.receivedLeads} leads
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section id="venda">
        <Card>
          <CardHeader title="Registro de venda" description="Fechamento comercial com lucro líquido, margem real e ROI." />
          <CardContent>
            <form action={saveSaleAction} className="grid gap-4 md:grid-cols-3">
              <input type="hidden" name="vehicleId" value={vehicle.id} />
              <label className="space-y-2 text-sm">
                <span className="font-medium">Data da venda</span>
                <Input name="soldAt" type="date" defaultValue={vehicle.sale?.soldAt ? new Date(vehicle.sale.soldAt).toISOString().slice(0, 10) : ""} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Valor anunciado</span>
                <Input name="listedPrice" defaultValue={String(vehicle.sale?.listedPrice ?? vehicle.predictedSalePrice ?? "")} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Valor vendido</span>
                <Input name="soldPrice" defaultValue={String(vehicle.sale?.soldPrice ?? "")} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Desconto concedido</span>
                <Input name="discountGranted" defaultValue={String(vehicle.sale?.discountGranted ?? "")} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Comprador</span>
                <Input name="buyerName" defaultValue={vehicle.sale?.buyerName ?? ""} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Canal de venda</span>
                <Input name="saleChannel" defaultValue={vehicle.sale?.saleChannel ?? ""} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Comissão de venda</span>
                <Input name="salesCommission" defaultValue={String(vehicle.sale?.salesCommission ?? "")} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Impostos e taxas</span>
                <Input name="taxes" defaultValue={String(vehicle.sale?.taxes ?? "")} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Forma de pagamento</span>
                <Select name="paymentMethod" defaultValue={String(vehicle.sale?.paymentMethod ?? "")}>
                  <option value="">Selecione</option>
                  {PAYMENT_METHOD_OPTIONS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Data de transferência</span>
                <Input name="transferDate" type="date" defaultValue={vehicle.sale?.transferDate ? new Date(vehicle.sale.transferDate).toISOString().slice(0, 10) : ""} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Status da transferência</span>
                <Input name="transferStatus" defaultValue={vehicle.sale?.transferStatus ?? ""} />
              </label>
              <label className="space-y-2 text-sm md:col-span-3">
                <span className="font-medium">Observações</span>
                <Textarea name="notes" defaultValue={vehicle.sale?.notes ?? ""} />
              </label>
              <button type="submit" className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white md:col-span-3">
                Salvar venda
              </button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section id="historico">
        <Card>
          <CardHeader title="Histórico analítico" description="Registro de snapshots, IA e evolução do veículo." />
          <CardContent className="space-y-3">
            {latestAnalysesByType.map((analysis) => (
              <div key={analysis.id} className="rounded-3xl border border-border bg-white/75 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{analysis.analysisType}</p>
                    <p className="text-sm text-muted">{analysis.summary ?? "Sem resumo"}</p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">{formatDate(analysis.createdAt)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader title="Ações administrativas" description="Exclusão controlada do projeto do veículo." />
          <CardContent>
            <form action={deleteVehicleAction}>
              <input type="hidden" name="id" value={vehicle.id} />
              <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
                Excluir veículo
              </button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
