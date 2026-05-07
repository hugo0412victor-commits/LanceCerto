type ScoreWeights = {
  discountToFipe: number;
  projectedMargin: number;
  repairEase: number;
  liquidity: number;
  documentaryRisk: number;
  estimatedSaleTime: number;
};

type OpportunityScoreInput = {
  discountToFipePercent?: number;
  projectedMarginPercent?: number;
  repairEaseScore?: number;
  liquidityScore?: number;
  documentaryRiskScore?: number;
  estimatedSaleTimeScore?: number;
};

export const defaultScoreWeights: ScoreWeights = {
  discountToFipe: 25,
  projectedMargin: 30,
  repairEase: 15,
  liquidity: 15,
  documentaryRisk: 10,
  estimatedSaleTime: 5
};

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}

function normalizePercentMetric(value = 0, factor = 2) {
  return clamp(value * factor);
}

export function calculateOpportunityScore(
  input: OpportunityScoreInput,
  weights: ScoreWeights = defaultScoreWeights
) {
  const normalized = {
    discountToFipe: normalizePercentMetric(input.discountToFipePercent ?? 0, 2),
    projectedMargin: normalizePercentMetric(input.projectedMarginPercent ?? 0, 4),
    repairEase: clamp(input.repairEaseScore ?? 60),
    liquidity: clamp(input.liquidityScore ?? 55),
    documentaryRisk: clamp(100 - (input.documentaryRiskScore ?? 50)),
    estimatedSaleTime: clamp(input.estimatedSaleTimeScore ?? 50)
  };

  const score = Math.round(
    (normalized.discountToFipe * weights.discountToFipe +
      normalized.projectedMargin * weights.projectedMargin +
      normalized.repairEase * weights.repairEase +
      normalized.liquidity * weights.liquidity +
      normalized.documentaryRisk * weights.documentaryRisk +
      normalized.estimatedSaleTime * weights.estimatedSaleTime) /
      100
  );

  const classification =
    score >= 80
      ? "Excelente oportunidade"
      : score >= 65
        ? "Boa oportunidade"
        : score >= 50
          ? "Comprar com cautela"
          : score >= 35
            ? "Alto risco"
            : "Evitar";

  return {
    score,
    classification,
    breakdown: normalized,
    weights
  };
}
