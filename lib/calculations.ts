type CalculationInput = {
  fipeValue?: number | null;
  marketValue?: number | null;
  bidValue?: number | null;
  auctionCommission?: number | null;
  administrativeFees?: number | null;
  yardCost?: number | null;
  towCost?: number | null;
  documentationCost?: number | null;
  repairCost?: number | null;
  additionalPredictedCosts?: number | null;
  additionalActualCosts?: number | null;
  predictedSalePrice?: number | null;
  actualSalePrice?: number | null;
  desiredMarginPercent?: number | null;
};

type LotAnalysisViabilityInput = {
  fipeValue?: number | null;
  marketValue?: number | null;
  bidValue?: number | null;
  auctionCommission?: number | null;
  administrativeFees?: number | null;
  documentationCost?: number | null;
  predictedSalePrice?: number | null;
};

export const LOT_ANALYSIS_DEFAULTS = {
  auctioneerCommissionPercent: 5,
  desiredMarginPercent: 20,
  dsalCost: 0,
  originExpensesCost: 250,
  saleDiscountOnFipePercent: 20
} as const;

const toNumber = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function sumValues(...values: Array<number | null | undefined>) {
  return values.reduce<number>((total, current) => total + toNumber(current), 0);
}

export function calculateVehicleFinancials(input: CalculationInput) {
  const bid = toNumber(input.bidValue);
  const commission = toNumber(input.auctionCommission);
  const fees = toNumber(input.administrativeFees);
  const yard = toNumber(input.yardCost);
  const tow = toNumber(input.towCost);
  const docs = toNumber(input.documentationCost);
  const repairs = toNumber(input.repairCost);
  const extraPredicted = toNumber(input.additionalPredictedCosts);
  const extraActual = toNumber(input.additionalActualCosts);
  const predictedSale = toNumber(input.predictedSalePrice);
  const actualSale = toNumber(input.actualSalePrice);
  const fipe = toNumber(input.fipeValue);
  const market = toNumber(input.marketValue);
  const desiredMargin = toNumber(input.desiredMarginPercent);

  const baseCost = sumValues(bid, commission, fees, yard, tow, docs);
  const totalPredictedCost = sumValues(baseCost, repairs, extraPredicted);
  const totalActualCost = sumValues(baseCost, repairs, extraActual);
  const predictedProfit = predictedSale - totalPredictedCost;
  const actualProfit = actualSale - totalActualCost;
  const predictedMargin = predictedSale > 0 ? (predictedProfit / predictedSale) * 100 : 0;
  const actualMargin = actualSale > 0 ? (actualProfit / actualSale) * 100 : 0;
  const predictedRoi = totalPredictedCost > 0 ? (predictedProfit / totalPredictedCost) * 100 : 0;
  const actualRoi = totalActualCost > 0 ? (actualProfit / totalActualCost) * 100 : 0;
  const discountOnFipe = fipe > 0 && predictedSale > 0 ? ((fipe - predictedSale) / fipe) * 100 : 0;
  const priceMinimum = totalPredictedCost * 1.1;
  const priceIdeal = totalPredictedCost * (1 + Math.max(desiredMargin, 12) / 100);
  const priceAggressive = market > 0 ? Math.min(market * 0.97, priceIdeal * 0.985) : priceIdeal * 0.985;
  const recommendedMaxBid = calculateRecommendedBid({
    predictedSalePrice: predictedSale || market || fipe,
    desiredMarginPercent: desiredMargin || LOT_ANALYSIS_DEFAULTS.desiredMarginPercent,
    extraCosts: sumValues(commission, fees, yard, tow, docs, repairs, extraPredicted)
  }).moderate;

  return {
    baseCost,
    totalPredictedCost,
    totalActualCost,
    predictedProfit,
    actualProfit,
    predictedMargin,
    actualMargin,
    predictedRoi,
    actualRoi,
    discountOnFipe,
    priceMinimum,
    priceIdeal,
    priceAggressive,
    recommendedMaxBid,
    differencePredictedVsActual: actualProfit - predictedProfit
  };
}

export function deriveLotAnalysisViability(input: LotAnalysisViabilityInput) {
  const fipeValue = toNumber(input.fipeValue);
  const marketValue = toNumber(input.marketValue);
  const informedBid = input.bidValue ?? undefined;
  const informedCommission = input.auctionCommission ?? undefined;
  const informedFees = input.administrativeFees ?? undefined;
  const informedDocs = input.documentationCost ?? undefined;
  const informedSalePrice = input.predictedSalePrice ?? undefined;

  const predictedSalePrice =
    informedSalePrice ??
    (fipeValue > 0
      ? roundMoney(fipeValue * (1 - LOT_ANALYSIS_DEFAULTS.saleDiscountOnFipePercent / 100))
      : marketValue > 0
        ? roundMoney(marketValue)
        : undefined);

  const administrativeFees = informedFees ?? LOT_ANALYSIS_DEFAULTS.originExpensesCost;
  const documentationCost =
    informedDocs ?? (LOT_ANALYSIS_DEFAULTS.dsalCost > 0 ? LOT_ANALYSIS_DEFAULTS.dsalCost : undefined);

  let bidValue = informedBid;
  if (bidValue === undefined && predictedSalePrice !== undefined) {
    const maxTotalCost = predictedSalePrice * (1 - LOT_ANALYSIS_DEFAULTS.desiredMarginPercent / 100);
    const fixedCosts = administrativeFees + (documentationCost ?? 0);
    const commissionFactor = 1 + LOT_ANALYSIS_DEFAULTS.auctioneerCommissionPercent / 100;
    bidValue = roundMoney(Math.max((maxTotalCost - fixedCosts) / commissionFactor, 0));
  }

  const auctionCommission =
    informedCommission ??
    (bidValue !== undefined
      ? roundMoney(bidValue * (LOT_ANALYSIS_DEFAULTS.auctioneerCommissionPercent / 100))
      : undefined);

  const assumptionsApplied = {
    predictedSalePrice: informedSalePrice === undefined && predictedSalePrice !== undefined,
    administrativeFees: informedFees === undefined,
    documentationCost: informedDocs === undefined,
    bidValue: informedBid === undefined && bidValue !== undefined,
    auctionCommission: informedCommission === undefined && auctionCommission !== undefined
  };

  return {
    bidValue,
    auctionCommission,
    administrativeFees,
    documentationCost,
    predictedSalePrice,
    assumptionsApplied,
    assumptionsSummary: [
      assumptionsApplied.predictedSalePrice
        ? `Venda estimada com deságio de ${LOT_ANALYSIS_DEFAULTS.saleDiscountOnFipePercent}% sobre a FIPE`
        : null,
      assumptionsApplied.auctionCommission
        ? `Corretagem do leiloeiro estimada em ${LOT_ANALYSIS_DEFAULTS.auctioneerCommissionPercent}%`
        : null,
      assumptionsApplied.documentationCost && documentationCost
        ? `DSAL estimado em R$ ${documentationCost.toLocaleString("pt-BR")}`
        : null,
      assumptionsApplied.administrativeFees
        ? `Despesas de origem estimadas em R$ ${LOT_ANALYSIS_DEFAULTS.originExpensesCost.toLocaleString("pt-BR")}`
        : null,
      assumptionsApplied.bidValue
        ? `Lance viável calculado para preservar pelo menos ${LOT_ANALYSIS_DEFAULTS.desiredMarginPercent}% de margem`
        : null
    ].filter(Boolean) as string[]
  };
}

export function calculateRecommendedBid({
  predictedSalePrice,
  desiredMarginPercent,
  extraCosts,
  riskFactor = 1
}: {
  predictedSalePrice?: number | null;
  desiredMarginPercent?: number | null;
  extraCosts?: number | null;
  riskFactor?: number | null;
}) {
  const salePrice = toNumber(predictedSalePrice);
  const margin = Math.max(toNumber(desiredMarginPercent), 1) / 100;
  const extra = toNumber(extraCosts);
  const risk = toNumber(riskFactor) || 1;
  const maximumCost = salePrice * (1 - margin);
  const moderate = Math.max(maximumCost - extra, 0);

  return {
    conservative: Math.max(moderate * (0.92 / risk), 0),
    moderate: Math.max(moderate * (1 / risk), 0),
    aggressive: Math.max(moderate * (1.06 / risk), 0)
  };
}

export function classifyOpportunityByMargin(marginPercent: number) {
  if (marginPercent >= LOT_ANALYSIS_DEFAULTS.desiredMarginPercent) {
    return "Excelente oportunidade";
  }

  if (marginPercent >= LOT_ANALYSIS_DEFAULTS.desiredMarginPercent - 5) {
    return "Boa oportunidade";
  }

  if (marginPercent >= 5) {
    return "Atencao";
  }

  return "Evitar";
}

export function calculateTurnoverDays(bidDate?: Date | null, soldAt?: Date | null) {
  if (!bidDate || !soldAt) {
    return undefined;
  }

  const diff = soldAt.getTime() - bidDate.getTime();
  return Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 0);
}
