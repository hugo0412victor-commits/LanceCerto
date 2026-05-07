export const INITIAL_INSPECTION_ITEMS = [
  { key: "estruturaFrontal", label: "Estrutura frontal" },
  { key: "longarinas", label: "Longarinas e alinhamento" },
  { key: "motorLiga", label: "Motor liga e mantem marcha" },
  { key: "cambioEngata", label: "Cambio engata corretamente" },
  { key: "suspensao", label: "Suspensao sem ruido grave" },
  { key: "freios", label: "Freios e pedal" },
  { key: "rodasPneus", label: "Rodas e pneus" },
  { key: "faroisLanternas", label: "Farois e lanternas" },
  { key: "painelEletrica", label: "Painel e eletrica" },
  { key: "arrefecimento", label: "Arrefecimento e vazamentos" },
  { key: "interior", label: "Interior e acabamento" },
  { key: "chavesDocumentos", label: "Chaves e documentos" }
] as const;

export const INSPECTION_ITEM_STATUS_OPTIONS = [
  { value: "", label: "Selecionar" },
  { value: "OK", label: "OK" },
  { value: "ATTENTION", label: "Atencao" },
  { value: "NOT_OK", label: "Nao confere" },
  { value: "NA", label: "Nao se aplica" }
] as const;

export type InitialInspectionItemKey = (typeof INITIAL_INSPECTION_ITEMS)[number]["key"];

export type InitialInspectionPayload = {
  inspectorName?: string;
  inspectedAt?: string;
  odometer?: string;
  fuelLevel?: string;
  generalNotes?: string;
  missingItems?: string;
  items: Partial<Record<InitialInspectionItemKey, string>>;
};

export function parseInitialInspectionPayload(input: unknown): InitialInspectionPayload {
  if (!input || typeof input !== "object") {
    return { items: {} };
  }

  const value = input as Record<string, unknown>;
  const itemsValue = value.items && typeof value.items === "object" ? (value.items as Record<string, unknown>) : {};

  const items = Object.fromEntries(
    INITIAL_INSPECTION_ITEMS.map((item) => [
      item.key,
      typeof itemsValue[item.key] === "string" ? String(itemsValue[item.key]) : ""
    ])
  ) as Partial<Record<InitialInspectionItemKey, string>>;

  return {
    inspectorName: typeof value.inspectorName === "string" ? value.inspectorName : "",
    inspectedAt: typeof value.inspectedAt === "string" ? value.inspectedAt : "",
    odometer: typeof value.odometer === "string" ? value.odometer : "",
    fuelLevel: typeof value.fuelLevel === "string" ? value.fuelLevel : "",
    generalNotes: typeof value.generalNotes === "string" ? value.generalNotes : "",
    missingItems: typeof value.missingItems === "string" ? value.missingItems : "",
    items
  };
}

export function getInitialInspectionSummary(payload?: InitialInspectionPayload | null) {
  const items = payload?.items ?? {};
  const total = INITIAL_INSPECTION_ITEMS.length;
  const completed = INITIAL_INSPECTION_ITEMS.filter((item) => Boolean(items[item.key])).length;
  const okCount = INITIAL_INSPECTION_ITEMS.filter((item) => items[item.key] === "OK").length;
  const attentionCount = INITIAL_INSPECTION_ITEMS.filter((item) => items[item.key] === "ATTENTION").length;
  const notOkCount = INITIAL_INSPECTION_ITEMS.filter((item) => items[item.key] === "NOT_OK").length;

  return {
    total,
    completed,
    okCount,
    attentionCount,
    notOkCount,
    progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}
