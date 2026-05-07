"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Link2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type FeedbackTone = "success" | "warning" | "error";

type ImportFeedback = {
  tone: FeedbackTone;
  items: string[];
};

export function LotImportCard({ defaultUrl }: { defaultUrl?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null);

  async function handleImport() {
    if (!url.trim()) {
      setFeedback({
        tone: "error",
        items: ["Cole o link do lote para iniciar a importacao."]
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/lots/import", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ url })
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        vehicleId?: string;
        status?: "SUCCESS" | "PARTIAL" | "FAILED";
        alerts?: string[];
        message?: string;
        error?: string;
        code?: string;
      };

      setLoading(false);

      if (!response.ok || !payload.ok || !payload.vehicleId) {
        const fallbackByCode: Record<string, string> = {
          INVALID_URL: "O link informado nao parece ser uma URL valida de lote.",
          ACCESS_BLOCKED: "O site de origem bloqueou a captura automatica. Tente novamente mais tarde ou siga com cadastro manual.",
          DATA_NOT_FOUND: "Nao encontramos dados aproveitaveis nesse link de lote.",
          CONNECTION_FAILED: "Falha de conexao com o site externo no momento.",
          IMPORT_FAILED: "Nao foi possivel concluir a importacao automatica deste lote."
        };

        setFeedback({
          tone: "error",
          items: [payload.error ?? fallbackByCode[payload.code ?? ""] ?? "Falha na importacao. O fluxo pode seguir com cadastro manual."]
        });
        return;
      }

      setFeedback({
        tone: payload.status === "SUCCESS" ? "success" : "warning",
        items: [payload.message ?? "Importacao concluida.", ...(payload.alerts ?? [])]
      });

      startTransition(() => {
        router.push(`/vehicles/${payload.vehicleId}`);
        router.refresh();
      });
    } catch {
      setLoading(false);
      setFeedback({
        tone: "error",
        items: ["Falha de conexao ao chamar a rota de importacao. Verifique se o sistema continua rodando localmente."]
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
      <CardHeader
        title="Importação por link"
        description="A captura roda no backend para evitar CORS, salva o snapshot do lote e orienta claramente quando o site de origem bloquear ou expor dados parciais."
      />
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-[1.6rem] border border-border bg-background/55 p-4 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Snapshot interno", text: "Os dados ficam salvos no PostgreSQL, sem depender do link continuar no ar." },
            { icon: Sparkles, title: "Importação assistida", text: "Fallback server-side com tratamento para bloqueio do site externo e dados ausentes." },
            { icon: Link2, title: "Fluxo rápido", text: "Cole a URL do lote, revise os campos e siga com o cadastro operacional." }
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 font-semibold text-primary">{title}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.copart.com.br/lot/1090276"
          />
          <Button type="button" variant="accent" onClick={handleImport} disabled={loading} className="gap-2 whitespace-nowrap px-5 md:w-auto">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
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
      </CardContent>
    </Card>
  );
}
