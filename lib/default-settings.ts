export const defaultSettings = [
  {
    group: "branding",
    key: "system_name",
    label: "Nome do sistema",
    value: "AutoArremate Gestao",
    description: "Nome exibido na interface e relatorios."
  },
  {
    group: "branding",
    key: "company_name",
    label: "Nome da empresa",
    value: "Empresa Demo",
    description: "Empresa principal utilizada no ambiente local."
  },
  {
    group: "finance",
    key: "minimum_margin",
    label: "Margem minima desejada",
    value: 10,
    description: "Percentual minimo para classificar um lote como viavel."
  },
  {
    group: "finance",
    key: "ideal_margin",
    label: "Margem ideal",
    value: 15,
    description: "Percentual alvo para precificacao padrao."
  },
  {
    group: "finance",
    key: "quick_sale_discount",
    label: "Percentual de venda rapida",
    value: 3,
    description: "Desconto padrao aplicado ao preco agressivo."
  },
  {
    group: "score",
    key: "opportunity_score_weights",
    label: "Pesos do score",
    value: {
      discountToFipe: 25,
      projectedMargin: 30,
      repairEase: 15,
      liquidity: 15,
      documentaryRisk: 10,
      estimatedSaleTime: 5
    },
    description: "Pesos editaveis para score de oportunidade."
  }
] as const;
