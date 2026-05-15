"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";
import { deleteVehicleAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function DeleteVehicleButton({
  vehicleId,
  vehicleName
}: {
  vehicleId: string;
  vehicleName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", vehicleId);

      const result = await deleteVehicleAction(formData);

      if (!result.ok) {
        setError(result.error ?? "Nao foi possivel excluir o lote.");
        return;
      }

      router.push("/vehicles?deleted=1");
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)} className="gap-2">
        <Trash2 className="h-4 w-4" />
        Excluir lote
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-600">Excluir lote</p>
                <h2 className="mt-2 text-xl font-bold text-primary">{vehicleName}</h2>
              </div>
              <button
                type="button"
                aria-label="Fechar confirmacao"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-muted">
              Tem certeza que deseja excluir este lote? Esta acao nao podera ser desfeita.
            </p>

            {error ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={handleConfirm} disabled={isPending} className="gap-2">
                <Trash2 className="h-4 w-4" />
                {isPending ? "Excluindo..." : "Confirmar exclusao"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
