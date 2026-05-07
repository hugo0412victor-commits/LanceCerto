"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants";

type UploadItem = {
  id: string;
  category: string;
  publicUrl: string;
  fileName?: string;
  caption?: string | null;
  note?: string | null;
  mimeType?: string;
  createdAt?: string | Date;
};

export function FileUploadPanel({
  vehicleId,
  type,
  title,
  description,
  categoryOptions,
  items
}: {
  vehicleId: string;
  type: "document" | "photo";
  title: string;
  description: string;
  categoryOptions: string[];
  items: UploadItem[];
}) {
  const router = useRouter();
  const [category, setCategory] = useState(categoryOptions[0] ?? "");
  const [caption, setCaption] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function formatCategoryLabel(option: string) {
    return DOCUMENT_CATEGORY_LABELS[option as keyof typeof DOCUMENT_CATEGORY_LABELS] ?? option;
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const response = await fetch("/api/uploads", {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ id, type })
      });

      if (!response.ok) {
        setMessage("Falha ao excluir arquivo.");
        return;
      }

      setMessage("Arquivo excluido com sucesso.");
      router.refresh();
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);

    startTransition(async () => {
      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData
      });

      const raw = await response.text();
      const payload = (raw ? JSON.parse(raw) : {}) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Falha no upload.");
        return;
      }

      setMessage("Upload concluido com sucesso.");
      setCaption("");
      formElement.reset();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardContent className="space-y-5">
        <form className="grid gap-3 rounded-3xl border border-border bg-white/70 p-4 md:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={handleSubmit}>
          <input type="hidden" name="vehicleId" value={vehicleId} />
          <input type="hidden" name="type" value={type} />
          <Select name="category" value={category} onChange={(event) => setCategory(event.target.value)}>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {formatCategoryLabel(option)}
              </option>
            ))}
          </Select>
          <Input
            name={type === "photo" ? "caption" : "note"}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder={type === "photo" ? "Legenda ou contexto da imagem" : "Observacao do documento"}
          />
          <Input name="file" type="file" required />
          <Button type="submit" disabled={pending}>
            {pending ? "Enviando..." : "Enviar"}
          </Button>
        </form>
        {message ? <p className="text-sm text-muted">{message}</p> : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-3xl border border-border bg-white/80 p-4 transition hover:-translate-y-0.5"
            >
              <a href={item.publicUrl} target="_blank" rel="noreferrer" className="block">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">{formatCategoryLabel(item.category)}</p>
                <p className="mt-2 text-sm font-semibold">
                  {item.fileName ?? item.caption ?? "Arquivo interno"}
                </p>
                <p className="mt-2 text-sm text-muted">{item.note ?? item.caption ?? "Sem observacao adicional."}</p>
              </a>
              <button
                type="button"
                className="mt-4 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                onClick={() => handleDelete(item.id)}
              >
                Excluir
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
