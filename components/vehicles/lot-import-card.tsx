"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, ExternalLink, ImagePlus, LoaderCircle, Save, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type FeedbackTone = "success" | "warning" | "error";

type ImportedPhoto = {
  imageUrl: string;
  thumbnailUrl?: string;
  imageType?: string;
  sequenceNumber?: number;
  source: string;
};

type VehicleImportData = {
  lotUrl: string;
  lotCode?: string;
  provider?: string;
  displayName?: string;
  brand?: string;
  model?: string;
  version?: string;
  manufacturingYear?: number;
  modelYear?: number;
  armored?: boolean;
  documentType?: string;
  documentTypeCode?: string;
  sellerName?: string;
  mountType?: string;
  damageDescription?: string;
  condition?: string;
  category?: string;
  mileage?: number;
  mileageUnit?: string;
  fuel?: string;
  hasKey?: boolean;
  runningCondition?: boolean;
  runningConditionText?: string;
  chassis?: string;
  chassisType?: string;
  plateOrFinal?: string;
  fipeValue?: number;
  currentBid?: number;
  bidIncrement?: number;
  buyNowPrice?: number;
  highestBid?: number;
  myBid?: number;
  currency?: string;
  auctionYard?: string;
  vehicleYard?: string;
  yardNumber?: string;
  yardSpace?: string;
  yardSlot?: string;
  physicalYardNumber?: string;
  yardCode?: string;
  yard?: string;
  auctionDate?: string | Date;
  auctionDateText?: string;
  saleDateTimestamp?: string;
  sold?: boolean;
  saleStatus?: string;
  documentsUrl?: string;
  specificConditionsUrl?: string;
  mainImageUrl?: string;
  originalNotes?: string;
  originalPhotoUrls?: string[];
  photos?: ImportedPhoto[];
};

type ImportPreview = {
  status?: "SUCCESS" | "PARTIAL" | "FAILED";
  provider: string;
  vehicleData: VehicleImportData;
  rawJson: Record<string, unknown>;
  alerts: string[];
  pendingFields: string[];
  existingVehicle?: {
    id: string;
    displayName?: string | null;
    brand?: string | null;
    model?: string | null;
    version?: string | null;
    lotCode?: string | null;
  } | null;
};

type ImportFeedback = {
  tone: FeedbackTone;
  items: string[];
};

const textFields = {
  vehicle: [
    ["lotCode", "Código do lote"],
    ["brand", "Marca"],
    ["model", "Modelo"],
    ["version", "Versão"],
    ["manufacturingYear", "Ano fabricação"],
    ["modelYear", "Ano modelo"],
    ["chassis", "Chassi parcial"],
    ["chassisType", "Tipo de chassi"],
    ["documentType", "Tipo de documento"],
    ["sellerName", "Comitente"]
  ],
  characteristics: [
    ["category", "Categoria"],
    ["mileage", "Quilometragem"],
    ["mileageUnit", "Unidade"],
    ["fuel", "Combustível"],
    ["hasKey", "Chave"],
    ["armored", "Blindado"],
    ["runningConditionText", "Condição de funcionamento"],
    ["mountType", "Tipo de monta"],
    ["condition", "Condição/dano"],
    ["originalNotes", "Complemento"]
  ],
  bid: [
    ["currentBid", "Lance atual"],
    ["bidIncrement", "Incremento"],
    ["currency", "Moeda"],
    ["buyNowPrice", "Comprar agora"],
    ["highestBid", "Maior lance"]
  ],
  sale: [
    ["auctionYard", "Pátio do leilão"],
    ["vehicleYard", "Pátio do veículo"],
    ["yardSlot", "Lote/Vaga"],
    ["auctionDateText", "Data da venda"],
    ["sold", "Vendido"],
    ["saleStatus", "Status da venda"]
  ],
  documents: [
    ["documentsUrl", "Link de documentos"],
    ["specificConditionsUrl", "Condições específicas"]
  ]
} as const;

function fieldValue(value: unknown) {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  return value === undefined || value === null ? "" : String(value);
}

function applyFieldValue(current: VehicleImportData, key: keyof VehicleImportData, value: string): VehicleImportData {
  const numericFields = new Set(["manufacturingYear", "modelYear", "mileage", "fipeValue", "currentBid", "bidIncrement", "buyNowPrice", "highestBid", "myBid"]);
  const booleanFields = new Set(["hasKey", "armored", "sold", "runningCondition"]);

  if (numericFields.has(String(key))) {
    return {
      ...current,
      [key]: value.trim() ? Number(value.replace(",", ".")) : undefined
    };
  }

  if (booleanFields.has(String(key))) {
    const normalized = value.trim().toLowerCase();
    return {
      ...current,
      [key]: normalized === "sim" || normalized === "true" || normalized === "1" ? true : normalized === "não" || normalized === "nao" || normalized === "false" || normalized === "0" ? false : undefined
    };
  }

  return {
    ...current,
    [key]: value
  };
}

function PreviewBlock({
  title,
  fields,
  data,
  editing,
  onChange
}: {
  title: string;
  fields: readonly (readonly [keyof VehicleImportData, string])[];
  data: VehicleImportData;
  editing: boolean;
  onChange: (key: keyof VehicleImportData, value: string) => void;
}) {
  return (
    <div className="rounded-[1.4rem] border border-border bg-white p-4">
      <p className="text-sm font-semibold text-primary">{title}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {fields.map(([key, label]) => (
          <label key={String(key)} className="space-y-1 text-xs">
            <span className="font-medium text-muted">{label}</span>
            {editing ? (
              key === "originalNotes" ? (
                <Textarea value={fieldValue(data[key])} onChange={(event) => onChange(key, event.target.value)} className="min-h-20" />
              ) : (
                <Input value={fieldValue(data[key])} onChange={(event) => onChange(key, event.target.value)} />
              )
            ) : (
              <span className="block rounded-xl border border-border bg-background/60 px-3 py-2 text-sm font-medium text-foreground">
                {fieldValue(data[key]) || "Pendente"}
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

export function LotImportCard({ defaultUrl }: { defaultUrl?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<"new" | "update" | "keep">("new");

  const photos = useMemo(() => preview?.vehicleData.photos ?? [], [preview]);
  const previewForSave = useMemo(
    () =>
      preview
        ? {
            ...preview,
            vehicleData: {
              ...preview.vehicleData,
              originalPhotoUrls: photos.map((photo) => photo.imageUrl),
              mainImageUrl: photos[0]?.imageUrl ?? preview.vehicleData.mainImageUrl
            }
          }
        : null,
    [photos, preview]
  );

  function updateVehicleData(key: keyof VehicleImportData, value: string) {
    setPreview((current) =>
      current
        ? {
            ...current,
            vehicleData: applyFieldValue(current.vehicleData, key, value)
          }
        : current
    );
  }

  async function handlePreview() {
    if (!url.trim()) {
      setFeedback({
        tone: "error",
        items: ["Cole o link do lote para iniciar a importação."]
      });
      return;
    }

    setLoading(true);
    setFeedback(null);
    setPreview(null);

    try {
      const response = await fetch("/api/lots/import", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ url, action: "preview" })
      });
      const payload = (await response.json()) as ImportPreview & { ok?: boolean; error?: string; code?: string };

      setLoading(false);

      if (!response.ok || !payload.ok) {
        setFeedback({
          tone: "error",
          items: [payload.error ?? "Não foi possível importar o lote agora. Você pode preencher manualmente."]
        });
        setEditing(true);
        return;
      }

      setPreview(payload);
      setDuplicateAction(payload.existingVehicle ? "update" : "new");
      setFeedback({
        tone: payload.status === "SUCCESS" ? "success" : "warning",
        items: ["Prévia pronta para revisão.", ...(payload.alerts ?? [])]
      });
    } catch {
      setLoading(false);
      setFeedback({
        tone: "error",
        items: ["Falha de conexão ao chamar a rota de importação. Confira os logs do backend."]
      });
    }
  }

  async function handleSave() {
    if (!previewForSave) return;

    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/lots/import", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          action: "save",
          importData: previewForSave,
          duplicateAction
        })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        vehicleId?: string;
        status?: "SUCCESS" | "PARTIAL" | "FAILED";
        alerts?: string[];
        message?: string;
        error?: string;
      };

      setSaving(false);

      if (!response.ok || !payload.ok || !payload.vehicleId) {
        setFeedback({
          tone: "error",
          items: [payload.error ?? "Não foi possível salvar o veículo importado."]
        });
        return;
      }

      setFeedback({
        tone: payload.status === "SUCCESS" ? "success" : "warning",
        items: [payload.message ?? "Veículo salvo com sucesso.", ...(payload.alerts ?? [])]
      });

      startTransition(() => {
        router.push(`/vehicles/${payload.vehicleId}`);
        router.refresh();
      });
    } catch {
      setSaving(false);
      setFeedback({
        tone: "error",
        items: ["Falha de conexão ao salvar o veículo importado."]
      });
    }
  }

  const feedbackClassName =
    feedback?.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : feedback?.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : feedback?.tone === "error"
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-border bg-white/75 text-slate-700";

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Importação por link" description="Cole um link da Copart, revise a prévia e salve o veículo com o snapshot e a galeria internos." />
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.copart.com.br/lot/1107348" />
          <Button type="button" variant="accent" onClick={handlePreview} disabled={loading} className="gap-2 whitespace-nowrap px-5 md:w-auto">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Importar lote
          </Button>
        </div>

        {feedback ? (
          <div className={`rounded-[1.4rem] border p-4 text-sm ${feedbackClassName}`}>
            {feedback.items.map((item) => (
              <p key={item}>- {item}</p>
            ))}
          </div>
        ) : null}

        {preview ? (
          <div className="space-y-4">
            {preview.existingVehicle ? (
              <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Já existe um veículo Copart com este lote.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    ["update", "Atualizar dados"],
                    ["keep", "Manter existente"],
                    ["new", "Importar como novo"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDuplicateAction(value as "new" | "update" | "keep")}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold ${duplicateAction === value ? "border-amber-500 bg-white" : "border-amber-200 bg-amber-100/40"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-primary">{preview.vehicleData.displayName || "Prévia do lote"}</p>
                <p className="text-xs text-muted">
                  {preview.provider.toUpperCase()} · {preview.pendingFields.length} pendências · {photos.length} fotos
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing((value) => !value)} className="gap-2">
                  <Edit3 className="h-4 w-4" />
                  {editing ? "Concluir edição" : "Editar antes de salvar"}
                </Button>
                <Button type="button" variant="primary" onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar veículo
                </Button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <PreviewBlock title="Dados do Veículo" fields={textFields.vehicle} data={preview.vehicleData} editing={editing} onChange={updateVehicleData} />
              <PreviewBlock title="Características" fields={textFields.characteristics} data={preview.vehicleData} editing={editing} onChange={updateVehicleData} />
              <PreviewBlock title="Lance" fields={textFields.bid} data={preview.vehicleData} editing={editing} onChange={updateVehicleData} />
              <PreviewBlock title="Venda" fields={textFields.sale} data={preview.vehicleData} editing={editing} onChange={updateVehicleData} />
              <PreviewBlock title="Documentos" fields={textFields.documents} data={preview.vehicleData} editing={editing} onChange={updateVehicleData} />
              <div className="rounded-[1.4rem] border border-border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-primary">Fotos</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                    <ImagePlus className="h-3.5 w-3.5" />
                    {photos.length} encontradas
                  </span>
                </div>
                {photos.length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                    {photos.slice(0, 12).map((photo, index) => (
                      <a key={`${photo.imageUrl}-${index}`} href={photo.imageUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-border bg-background">
                        <img src={photo.thumbnailUrl ?? photo.imageUrl} alt={`Foto ${index + 1} do lote`} className="h-24 w-full object-cover transition group-hover:scale-105" />
                        <span className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-muted">
                          #{photo.sequenceNumber ?? index + 1}
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl border border-border bg-background/60 p-3 text-sm text-muted">
                    Nenhuma foto foi encontrada automaticamente. Depois de salvar, adicione fotos por upload ou URL na área de fotos.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-border bg-background/55 p-4 text-sm text-muted">
            <span>Se a leitura automática falhar, siga pelo cadastro manual assistido.</span>
            <Button type="button" variant="ghost" onClick={() => router.push("/vehicles/new")}>
              Preencher manualmente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
