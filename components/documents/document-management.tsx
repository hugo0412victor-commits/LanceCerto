"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, Eye, FileUp, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_CATEGORY_LABELS, DOCUMENT_CATEGORY_OPTIONS } from "@/lib/constants";

type DocumentVehicle = {
  id: string;
  stockCode?: string | null;
  lotCode?: string | null;
  sourceProvider?: string | null;
  displayName?: string | null;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  auctionHouseName?: string | null;
};

export type ManagedDocument = {
  id: string;
  vehicleId: string;
  category: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  publicUrl: string;
  note?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  vehicle: DocumentVehicle;
  uploadedBy?: {
    id: string;
    name?: string | null;
  } | null;
};

type FeedbackTone = "success" | "error" | "info";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

function vehicleName(vehicle: DocumentVehicle) {
  return vehicle.displayName || [vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ") || vehicle.stockCode || "Lote sem titulo";
}

function vehicleSearchText(vehicle: DocumentVehicle) {
  return [vehicleName(vehicle), vehicle.stockCode, vehicle.lotCode, vehicle.sourceProvider, vehicle.auctionHouseName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function categoryLabel(category: string) {
  return DOCUMENT_CATEGORY_LABELS[category as keyof typeof DOCUMENT_CATEGORY_LABELS] ?? category;
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function canPreview(document: ManagedDocument) {
  return document.mimeType.startsWith("image/") || document.mimeType === "application/pdf";
}

function documentFileUrl(documentId: string, download = false) {
  return `/api/documents/${documentId}/file${download ? "?download=1" : ""}`;
}

function UploadDialog({
  vehicles,
  initialVehicleId,
  onClose,
  onSuccess
}: {
  vehicles: DocumentVehicle[];
  initialVehicleId?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? vehicles[0]?.id ?? "");
  const [category, setCategory] = useState("NOTA_VENDA_LEILAO");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("type", "document");
    formData.set("vehicleId", vehicleId);
    formData.set("category", category);
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Falha ao enviar documento.");
        return;
      }

      onSuccess("Documento enviado com sucesso.");
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Novo documento</p>
            <h2 className="mt-2 text-xl font-bold text-primary">Enviar documento</h2>
          </div>
          <button
            type="button"
            aria-label="Fechar upload"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <input type="hidden" name="type" value="document" />
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Arquivo</span>
            <Input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Lote / veiculo</span>
              <Select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} required>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicleName(vehicle)}{vehicle.lotCode ? ` - lote ${vehicle.lotCode}` : ""}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Categoria</span>
              <Select value={category} onChange={(event) => setCategory(event.target.value)} required>
                {DOCUMENT_CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {categoryLabel(option)}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Observacao</span>
            <Textarea name="note" placeholder="Detalhes do documento, protocolo ou contexto do upload" />
          </label>

          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent" disabled={isPending} className="gap-2">
              <FileUp className="h-4 w-4" />
              {isPending ? "Enviando..." : "Enviar documento"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DocumentRow({
  document,
  onDeleted
}: {
  document: ManagedDocument;
  onDeleted: (message: string, tone?: FeedbackTone) => void;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const response = await fetch("/api/uploads", {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ id: document.id, type: "document" })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        onDeleted(payload.error ?? "Nao foi possivel excluir o documento.", "error");
        return;
      }

      setConfirmOpen(false);
      onDeleted("Documento excluido com sucesso.", "success");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white/80 p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_0.7fr_0.55fr_0.55fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="truncate font-semibold text-primary">{document.fileName}</p>
          <p className="mt-1 text-xs text-muted">{document.note || "Sem observacao."}</p>
        </div>
        <div>
          <Badge tone="info">{categoryLabel(document.category)}</Badge>
        </div>
        <div className="text-sm text-muted">{formatBytes(document.fileSize)}</div>
        <div className="text-sm text-muted">{dateFormatter.format(new Date(document.createdAt))}</div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {canPreview(document) ? (
            <a href={documentFileUrl(document.id)} target="_blank" rel="noopener noreferrer" className="inline-flex">
              <Button type="button" variant="ghost" className="h-9 gap-1 px-3">
                <Eye className="h-4 w-4" />
                Visualizar
              </Button>
            </a>
          ) : null}
          <a href={documentFileUrl(document.id, true)} className="inline-flex">
            <Button type="button" variant="secondary" className="h-9 gap-1 px-3">
              <Download className="h-4 w-4" />
              Baixar
            </Button>
          </a>
          <Button type="button" variant="destructive" onClick={() => setConfirmOpen(true)} className="h-9 gap-1 px-3">
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>

      {confirmOpen ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">Tem certeza que deseja excluir este documento?</p>
          <p className="mt-1">Esta acao nao podera ser desfeita.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Excluindo..." : "Confirmar exclusao"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DocumentManagement({
  documents,
  vehicles,
  title = "Documentos enviados",
  compact = false,
  fixedVehicleId
}: {
  documents: ManagedDocument[];
  vehicles: DocumentVehicle[];
  title?: string;
  compact?: boolean;
  fixedVehicleId?: string;
}) {
  const [query, setQuery] = useState("");
  const [vehicleId, setVehicleId] = useState(fixedVehicleId ?? "all");
  const [category, setCategory] = useState("all");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [uploadVehicleId, setUploadVehicleId] = useState<string | undefined>(fixedVehicleId);
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null);
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());

  const sourceOptions = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.sourceProvider).filter(Boolean) as string[])].sort(),
    [vehicles]
  );

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return documents.filter((document) => {
      const uploadedAt = new Date(document.createdAt);
      const searchText = [document.fileName, document.note, categoryLabel(document.category), vehicleSearchText(document.vehicle)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!normalizedQuery || searchText.includes(normalizedQuery)) &&
        (vehicleId === "all" || document.vehicleId === vehicleId) &&
        (category === "all" || document.category === category) &&
        (source === "all" || document.vehicle.sourceProvider === source) &&
        (status === "all" || status === "PENDENTE") &&
        (!from || uploadedAt >= from) &&
        (!to || uploadedAt <= to)
      );
    });
  }, [category, dateFrom, dateTo, documents, query, source, status, vehicleId]);

  const groups = useMemo(() => {
    const grouped = new Map<string, { vehicle: DocumentVehicle; documents: ManagedDocument[] }>();

    for (const document of filteredDocuments) {
      const current = grouped.get(document.vehicleId) ?? {
        vehicle: document.vehicle,
        documents: []
      };
      current.documents.push(document);
      grouped.set(document.vehicleId, current);
    }

    return [...grouped.values()].sort((a, b) => vehicleName(a.vehicle).localeCompare(vehicleName(b.vehicle), "pt-BR"));
  }, [filteredDocuments]);

  function toggleGroup(groupVehicleId: string) {
    setClosedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupVehicleId)) {
        next.delete(groupVehicleId);
      } else {
        next.add(groupVehicleId);
      }
      return next;
    });
  }

  const feedbackClassName =
    feedback?.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : feedback?.tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-primary/15 bg-primary/5 text-primary";

  return (
    <>
      <Card>
        <CardHeader
          title={title}
          description="Filtre, envie, visualize, baixe e remova documentos vinculados aos lotes."
          actions={
            <Button type="button" variant="accent" onClick={() => setUploadVehicleId(fixedVehicleId ?? vehicles[0]?.id)} className="gap-2">
              <FileUp className="h-4 w-4" />
              Enviar documento
            </Button>
          }
        />
        <CardContent className="space-y-4">
          {!compact ? (
            <div className="grid gap-3 rounded-[1.4rem] border border-border bg-background/55 p-4 md:grid-cols-2 xl:grid-cols-6">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar arquivo, observacao ou lote" className="xl:col-span-2" />
              <Select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} disabled={Boolean(fixedVehicleId)}>
                <option value="all">Todos os lotes</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicleName(vehicle)}
                  </option>
                ))}
              </Select>
              <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">Todas categorias</option>
                {DOCUMENT_CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {categoryLabel(option)}
                  </option>
                ))}
              </Select>
              <Select value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="all">Todas fontes</option>
                {sourceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">Todos status</option>
                <option value="PENDENTE">Pendente</option>
              </Select>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
          ) : null}

          {feedback ? <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${feedbackClassName}`}>{feedback.message}</div> : null}

          <div className="space-y-4">
            {groups.map((group) => {
              const closed = closedGroups.has(group.vehicle.id);

              return (
                <div key={group.vehicle.id} className="rounded-[1.6rem] border border-border bg-background/35 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button type="button" onClick={() => toggleGroup(group.vehicle.id)} className="flex min-w-0 items-start gap-3 text-left">
                      <span className={`mt-1 transition ${closed ? "-rotate-90" : ""}`}>
                        <ChevronDown className="h-4 w-4 text-muted" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-primary">{vehicleName(group.vehicle)}</span>
                        <span className="mt-1 block text-xs text-muted">
                          {group.vehicle.lotCode ? `Lote ${group.vehicle.lotCode}` : "Lote pendente"}
                          {group.vehicle.sourceProvider ? ` - ${group.vehicle.sourceProvider}` : ""}
                        </span>
                      </span>
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">{group.documents.length} documentos</Badge>
                      <Button type="button" variant="secondary" onClick={() => setUploadVehicleId(group.vehicle.id)} className="h-9 gap-2 px-3">
                        <FileUp className="h-4 w-4" />
                        Enviar
                      </Button>
                    </div>
                  </div>

                  {!closed ? (
                    <div className="mt-4 space-y-3">
                      {group.documents.map((document) => (
                        <DocumentRow
                          key={document.id}
                          document={document}
                          onDeleted={(message, tone = "success") => setFeedback({ message, tone })}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {groups.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-primary/25 bg-background/55 p-6 text-center">
                <p className="font-semibold text-primary">Nenhum documento encontrado.</p>
                <p className="mt-2 text-sm text-muted">
                  Envie o primeiro documento para organizar os arquivos dos seus lotes.
                </p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {uploadVehicleId ? (
        <UploadDialog
          vehicles={vehicles}
          initialVehicleId={uploadVehicleId}
          onClose={() => setUploadVehicleId(undefined)}
          onSuccess={(message) => setFeedback({ message, tone: "success" })}
        />
      ) : null}
    </>
  );
}
