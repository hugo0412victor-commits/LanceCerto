export const UserRoleCode = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  VIEWER: "VIEWER",
  BUYER: "BUYER",
  FINANCE: "FINANCE",
  OPERATIONS: "OPERATIONS",
  SALES: "SALES",
  PARTNER: "PARTNER"
} as const;

export type UserRoleCode = (typeof UserRoleCode)[keyof typeof UserRoleCode];

export const VehicleStatus = {
  ANALISE_LOTE: "ANALISE_LOTE",
  ARREMATADO: "ARREMATADO",
  AGUARDANDO_PAGAMENTO: "AGUARDANDO_PAGAMENTO",
  PAGO: "PAGO",
  AGUARDANDO_RETIRADA: "AGUARDANDO_RETIRADA",
  RETIRADO: "RETIRADO",
  VISTORIA_INICIAL: "VISTORIA_INICIAL",
  ORCAMENTO_REPAROS: "ORCAMENTO_REPAROS",
  MECANICA: "MECANICA",
  FUNILARIA: "FUNILARIA",
  PINTURA: "PINTURA",
  ESTETICA: "ESTETICA",
  DOCUMENTACAO: "DOCUMENTACAO",
  PRECIFICACAO: "PRECIFICACAO",
  FOTOS_ANUNCIO: "FOTOS_ANUNCIO",
  ANUNCIADO: "ANUNCIADO",
  EM_NEGOCIACAO: "EM_NEGOCIACAO",
  VENDIDO: "VENDIDO",
  TRANSFERIDO: "TRANSFERIDO",
  FINALIZADO: "FINALIZADO",
  CANCELADO: "CANCELADO"
} as const;

export type VehicleStatus = (typeof VehicleStatus)[keyof typeof VehicleStatus];

export const ImportStatus = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED"
} as const;

export type ImportStatus = (typeof ImportStatus)[keyof typeof ImportStatus];

export const DocumentCategory = {
  NOTA_VENDA_LEILAO: "NOTA_VENDA_LEILAO",
  COMPROVANTE_PAGAMENTO: "COMPROVANTE_PAGAMENTO",
  GATEPASS: "GATEPASS",
  BOLETO: "BOLETO",
  CRLV: "CRLV",
  ATPV_E: "ATPV_E",
  LAUDO_CAUTELAR: "LAUDO_CAUTELAR",
  VISTORIA: "VISTORIA",
  ORCAMENTO: "ORCAMENTO",
  NF_PECA: "NF_PECA",
  NF_SERVICO: "NF_SERVICO",
  RECIBO: "RECIBO",
  CONTRATO_VENDA: "CONTRATO_VENDA",
  COMPROVANTE_TRANSFERENCIA: "COMPROVANTE_TRANSFERENCIA",
  DOCUMENTO_PESSOAL: "DOCUMENTO_PESSOAL",
  OUTROS: "OUTROS"
} as const;

export type DocumentCategory = (typeof DocumentCategory)[keyof typeof DocumentCategory];

export const PhotoCategory = {
  ORIGINAIS_LEILAO: "ORIGINAIS_LEILAO",
  RETIRADA: "RETIRADA",
  ANTES_REPARO: "ANTES_REPARO",
  DURANTE_REPARO: "DURANTE_REPARO",
  APOS_REPARO: "APOS_REPARO",
  ANUNCIO: "ANUNCIO",
  OUTRAS: "OUTRAS"
} as const;

export type PhotoCategory = (typeof PhotoCategory)[keyof typeof PhotoCategory];

export const ExpenseCategoryType = {
  ARREMATE: "ARREMATE",
  COMISSAO_LEILAO: "COMISSAO_LEILAO",
  TAXA_ADMINISTRATIVA: "TAXA_ADMINISTRATIVA",
  PATIO: "PATIO",
  GUINCHO: "GUINCHO",
  DOCUMENTACAO: "DOCUMENTACAO",
  DESPACHANTE: "DESPACHANTE",
  IPVA: "IPVA",
  MULTAS: "MULTAS",
  MECANICA: "MECANICA",
  FUNILARIA: "FUNILARIA",
  PINTURA: "PINTURA",
  ESTETICA: "ESTETICA",
  HIGIENIZACAO: "HIGIENIZACAO",
  PECAS: "PECAS",
  ANUNCIOS: "ANUNCIOS",
  COMISSAO_VENDA: "COMISSAO_VENDA",
  IMPOSTOS: "IMPOSTOS",
  TAXAS_BANCARIAS: "TAXAS_BANCARIAS",
  JUROS: "JUROS",
  OUTROS: "OUTROS"
} as const;

export type ExpenseCategoryType =
  (typeof ExpenseCategoryType)[keyof typeof ExpenseCategoryType];

export const PaymentStatus = {
  PENDING: "PENDING",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  CANCELLED: "CANCELLED"
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentMethod = {
  PIX: "PIX",
  TRANSFER: "TRANSFER",
  CARD: "CARD",
  CASH: "CASH",
  BOLETO: "BOLETO",
  OTHER: "OTHER"
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const StepExecutionStatus = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  DONE: "DONE"
} as const;

export type StepExecutionStatus =
  (typeof StepExecutionStatus)[keyof typeof StepExecutionStatus];

export const MarketSourceType = {
  FIPE: "FIPE",
  WEBMOTORS: "WEBMOTORS",
  MOBIAUTO: "MOBIAUTO",
  OLX: "OLX",
  MANUAL: "MANUAL",
  OTHER: "OTHER"
} as const;

export type MarketSourceType =
  (typeof MarketSourceType)[keyof typeof MarketSourceType];

export const AdPortal = {
  OLX: "OLX",
  WEBMOTORS: "WEBMOTORS",
  MOBIAUTO: "MOBIAUTO",
  INSTAGRAM: "INSTAGRAM",
  FACEBOOK_MARKETPLACE: "FACEBOOK_MARKETPLACE",
  OTHER: "OTHER"
} as const;

export type AdPortal = (typeof AdPortal)[keyof typeof AdPortal];

export const AdStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  PAUSED: "PAUSED",
  SOLD: "SOLD",
  ARCHIVED: "ARCHIVED"
} as const;

export type AdStatus = (typeof AdStatus)[keyof typeof AdStatus];

export const LeadSource = {
  WHATSAPP: "WHATSAPP",
  INSTAGRAM: "INSTAGRAM",
  OLX: "OLX",
  WEBMOTORS: "WEBMOTORS",
  MOBIAUTO: "MOBIAUTO",
  INDICACAO: "INDICACAO",
  MANUAL: "MANUAL",
  OTHER: "OTHER"
} as const;

export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const CashFlowType = {
  IN: "IN",
  OUT: "OUT"
} as const;

export type CashFlowType = (typeof CashFlowType)[keyof typeof CashFlowType];

export const CashFlowStatus = {
  PROJECTED: "PROJECTED",
  REALIZED: "REALIZED",
  CANCELLED: "CANCELLED"
} as const;

export type CashFlowStatus = (typeof CashFlowStatus)[keyof typeof CashFlowStatus];

export const LiquidityLevel = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  UNKNOWN: "UNKNOWN"
} as const;

export type LiquidityLevel = (typeof LiquidityLevel)[keyof typeof LiquidityLevel];

export const AiAnalysisType = {
  LOT_RISK: "LOT_RISK",
  SALE_COPY: "SALE_COPY",
  WHATSAPP_MESSAGE: "WHATSAPP_MESSAGE"
} as const;

export type AiAnalysisType = (typeof AiAnalysisType)[keyof typeof AiAnalysisType];

export const AiRiskLevel = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH"
} as const;

export type AiRiskLevel = (typeof AiRiskLevel)[keyof typeof AiRiskLevel];
