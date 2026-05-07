import { LOT_ANALYSIS_DEFAULTS, calculateVehicleFinancials, classifyOpportunityByMargin } from "./calculations";

type VehicleLike = {
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  manufacturingYear?: number | null;
  modelYear?: number | null;
  condition?: string | null;
  documentType?: string | null;
  mountType?: string | null;
  mileage?: number | null;
  hasKey?: boolean | null;
  runningCondition?: boolean | null;
  notes?: string | null;
  fipeValue?: number | null;
  marketEstimatedValue?: number | null;
  bidValue?: number | null;
  auctionCommission?: number | null;
  administrativeFees?: number | null;
  yardCost?: number | null;
  towCost?: number | null;
  documentationExpected?: number | null;
  repairsExpected?: number | null;
  predictedSalePrice?: number | null;
};

export function generateLotRiskAnalysis(vehicle: VehicleLike) {
  const financials = calculateVehicleFinancials({
    fipeValue: vehicle.fipeValue,
    marketValue: vehicle.marketEstimatedValue,
    bidValue: vehicle.bidValue,
    auctionCommission: vehicle.auctionCommission,
    administrativeFees: vehicle.administrativeFees,
    yardCost: vehicle.yardCost,
    towCost: vehicle.towCost,
    documentationCost: vehicle.documentationExpected,
    repairCost: vehicle.repairsExpected,
    predictedSalePrice: vehicle.predictedSalePrice,
    desiredMarginPercent: LOT_ANALYSIS_DEFAULTS.desiredMarginPercent
  });

  const risks: string[] = [];
  const questions: string[] = [];
  const attentionPoints: string[] = [];

  if (!vehicle.documentType) {
    risks.push("Documentacao nao confirmada no cadastro.");
    questions.push("O lote possui CRLV, ATPV-e ou alguma restricao adicional?");
  }

  if (!vehicle.hasKey) {
    risks.push("Veiculo sem chave informada.");
    attentionPoints.push("Considerar custo e prazo para chave/codificacao.");
  }

  if (vehicle.runningCondition === false) {
    risks.push("Funcionamento nao confirmado.");
    questions.push("O motor liga? Ha travamento estrutural ou risco de cambio?");
  }

  if ((vehicle.repairsExpected ?? 0) > (vehicle.marketEstimatedValue ?? vehicle.fipeValue ?? 0) * 0.18) {
    risks.push("Reparo previsto elevado em relacao ao potencial de revenda.");
  }

  if ((financials.predictedMargin ?? 0) < 8) {
    attentionPoints.push("Margem projetada apertada. Rever lance e venda prevista.");
  }

  const summary = [
    vehicle.brand,
    vehicle.model,
    vehicle.version,
    vehicle.modelYear ? `modelo ${vehicle.modelYear}` : undefined
  ]
    .filter(Boolean)
    .join(" ");

  const riskLevel =
    risks.length >= 3 || (financials.predictedMargin ?? 0) < 5
      ? "HIGH"
      : risks.length >= 1 || (financials.predictedMargin ?? 0) < 12
        ? "MEDIUM"
        : "LOW";

  return {
    summary: summary || "Lote em analise com dados parciais",
    risks,
    attentionPoints,
    questions,
    recommendation: classifyOpportunityByMargin(financials.predictedMargin),
    justification:
      riskLevel === "HIGH"
        ? "Ha concentracao de risco operacional/documental ou margem insuficiente."
        : riskLevel === "MEDIUM"
          ? "O lote parece viavel, mas exige validacoes antes do arremate."
          : "Indicadores iniciais sugerem risco controlado para a tese de compra.",
    riskLevel
  };
}

export function generateAdCopy(input: {
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  year?: number | null;
  mileage?: number | null;
  color?: string | null;
  fuel?: string | null;
  transmission?: string | null;
  optionalItems?: string[];
  price?: number | null;
  notes?: string | null;
  differentials?: string[];
  condition?: string | null;
}) {
  const title = [input.brand, input.model, input.version, input.year].filter(Boolean).join(" ");
  const highlightList = [...(input.differentials ?? []), ...(input.optionalItems ?? [])].slice(0, 6);
  const baseFacts = [
    input.color ? `cor ${input.color}` : undefined,
    input.fuel ? `combustivel ${input.fuel}` : undefined,
    input.transmission ? `cambio ${input.transmission}` : undefined,
    input.mileage ? `${input.mileage.toLocaleString("pt-BR")} km` : undefined
  ]
    .filter(Boolean)
    .join(", ");

  const conditionText = input.condition ? `Condicao declarada: ${input.condition}.` : "";
  const priceText = input.price ? `Valor pedido: R$ ${input.price.toLocaleString("pt-BR")}.` : "";
  const differentialsText = highlightList.length ? `Destaques: ${highlightList.join(", ")}.` : "";

  return {
    title: title || "Veiculo seminovo em destaque",
    olxDescription: `${title || "Veiculo"} disponivel para venda. ${baseFacts}. ${conditionText} ${differentialsText} ${priceText} ${input.notes ?? ""}`.trim(),
    webmotorsDescription: `${title || "Veiculo"} com apresentacao profissional e informacoes claras. ${baseFacts}. ${conditionText} ${differentialsText} ${priceText}`.trim(),
    instagramDescription: `${title || "Veiculo"} pronto para oportunidade de compra. ${baseFacts}. Consulte condicoes e disponibilidade.`,
    whatsappMessage: `Ola! Seguem os dados do ${title || "veiculo"}: ${baseFacts}. ${priceText} Se quiser, envio fotos, historico e documentos disponiveis.`,
    highlightList,
    reviewAlert:
      "Revise quilometragem, estrutura, historico de leilao e detalhes documentais antes da publicacao final."
  };
}
