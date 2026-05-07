import {
  AdPortal,
  AdStatus,
  AiAnalysisType,
  AiRiskLevel,
  CashFlowStatus,
  CashFlowType,
  DocumentCategory,
  ExpenseCategoryType,
  ImportStatus,
  LeadSource,
  LiquidityLevel,
  MarketSourceType,
  PaymentMethod,
  PaymentStatus,
  PhotoCategory,
  StepExecutionStatus,
  UserRoleCode,
  VehicleStatus
} from "./prisma-enums";

export const USER_ROLE_LABELS: Record<UserRoleCode, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  VIEWER: "Visualizador",
  BUYER: "Comprador",
  FINANCE: "Financeiro",
  OPERATIONS: "Operacional",
  SALES: "Vendedor",
  PARTNER: "Parceiro"
};

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  ANALISE_LOTE: "Analise do lote",
  ARREMATADO: "Lote arrematado",
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pago",
  AGUARDANDO_RETIRADA: "Aguardando retirada",
  RETIRADO: "Retirado",
  VISTORIA_INICIAL: "Vistoria inicial",
  ORCAMENTO_REPAROS: "Orcamento de reparos",
  MECANICA: "Mecanica",
  FUNILARIA: "Funilaria",
  PINTURA: "Pintura",
  ESTETICA: "Estetica",
  DOCUMENTACAO: "Documentacao",
  PRECIFICACAO: "Precificacao",
  FOTOS_ANUNCIO: "Fotos para anuncio",
  ANUNCIADO: "Anunciado",
  EM_NEGOCIACAO: "Em negociacao",
  VENDIDO: "Vendido",
  TRANSFERIDO: "Transferido",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado"
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategoryType, string> = {
  ARREMATE: "Arremate",
  COMISSAO_LEILAO: "Comissao do leilao",
  TAXA_ADMINISTRATIVA: "Taxa administrativa",
  PATIO: "Patio",
  GUINCHO: "Guincho",
  DOCUMENTACAO: "Documentacao",
  DESPACHANTE: "Despachante",
  IPVA: "IPVA",
  MULTAS: "Multas",
  MECANICA: "Mecanica",
  FUNILARIA: "Funilaria",
  PINTURA: "Pintura",
  ESTETICA: "Estetica",
  HIGIENIZACAO: "Higienizacao",
  PECAS: "Pecas",
  ANUNCIOS: "Anuncios",
  COMISSAO_VENDA: "Comissao de venda",
  IMPOSTOS: "Impostos",
  TAXAS_BANCARIAS: "Taxas bancarias",
  JUROS: "Juros",
  OUTROS: "Outros"
};

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  NOTA_VENDA_LEILAO: "Nota de venda do leilao",
  COMPROVANTE_PAGAMENTO: "Comprovante de pagamento",
  GATEPASS: "GatePass",
  BOLETO: "Boleto",
  CRLV: "CRLV",
  ATPV_E: "ATPV-e",
  LAUDO_CAUTELAR: "Laudo cautelar",
  VISTORIA: "Vistoria",
  ORCAMENTO: "Orcamento",
  NF_PECA: "NF peca",
  NF_SERVICO: "NF servico",
  RECIBO: "Recibo",
  CONTRATO_VENDA: "Contrato de venda",
  COMPROVANTE_TRANSFERENCIA: "Comprovante de transferencia",
  DOCUMENTO_PESSOAL: "Documento pessoal",
  OUTROS: "Outros"
};

export const DOCUMENT_CATEGORY_OPTIONS = Object.values(DocumentCategory);
export const PHOTO_CATEGORY_OPTIONS = Object.values(PhotoCategory);
export const PAYMENT_STATUS_OPTIONS = Object.values(PaymentStatus);
export const PAYMENT_METHOD_OPTIONS = Object.values(PaymentMethod);
export const IMPORT_STATUS_OPTIONS = Object.values(ImportStatus);
export const MARKET_SOURCE_OPTIONS = Object.values(MarketSourceType);
export const LEAD_SOURCE_OPTIONS = Object.values(LeadSource);
export const CASH_FLOW_TYPE_OPTIONS = Object.values(CashFlowType);
export const CASH_FLOW_STATUS_OPTIONS = Object.values(CashFlowStatus);
export const AD_PORTAL_OPTIONS = Object.values(AdPortal);
export const AD_STATUS_OPTIONS = Object.values(AdStatus);
export const LIQUIDITY_OPTIONS = Object.values(LiquidityLevel);
export const AI_ANALYSIS_TYPE_OPTIONS = Object.values(AiAnalysisType);
export const AI_RISK_OPTIONS = Object.values(AiRiskLevel);
export const PROCESS_STATUS_OPTIONS = Object.values(StepExecutionStatus);
