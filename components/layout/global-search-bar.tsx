"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Search, Wand2 } from "lucide-react";
import { buildCopartLotUrl, extractCopartLotNumber, isCopartLotUrl } from "@/lib/lot-importer/copart-url";

function isCopartImportInput(input: string) {
  const value = input.trim();

  if (!value) {
    return false;
  }

  return isCopartLotUrl(value) || /copart\.com\.br/i.test(value) || /^\/lot\//i.test(value);
}

export function GlobalSearchBar({ userCanWrite }: { userCanWrite: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim();
  const copartInputDetected = useMemo(() => isCopartImportInput(trimmedQuery), [trimmedQuery]);
  const copartLotNumber = useMemo(() => extractCopartLotNumber(trimmedQuery), [trimmedQuery]);
  const actionLabel = copartInputDetected ? "Importar lote" : trimmedQuery ? "Buscar" : "Novo lote";
  const helperText = copartInputDetected
    ? copartLotNumber
      ? "Link da Copart detectado. Pressione Enter para importar."
      : "Link da Copart detectado, mas sem número de lote."
    : null;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedQuery) {
      if (userCanWrite) {
        router.push("/vehicles/new");
      }
      return;
    }

    if (copartInputDetected) {
      const importUrl = copartLotNumber ? buildCopartLotUrl(copartLotNumber) : trimmedQuery;
      router.push(`/vehicles?importUrl=${encodeURIComponent(importUrl)}`);
      return;
    }

    router.push(`/vehicles?q=${encodeURIComponent(trimmedQuery)}`);
  }

  return (
    <form onSubmit={submitSearch} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px]">
      <div>
        <div className="flex items-center rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted shadow-sm transition focus-within:border-primary/45 focus-within:ring-4 focus-within:ring-primary/10">
          <Search className="mr-2 h-4 w-4 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar lote, placa, modelo, cliente ou fornecedor"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
          />
        </div>
        {helperText ? <p className="mt-2 px-1 text-xs font-medium text-accent">{helperText}</p> : null}
      </div>

      {trimmedQuery || userCanWrite ? (
        copartInputDetected || trimmedQuery ? (
          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-sm font-semibold text-white shadow-glow transition hover:bg-[#C88914]"
          >
            {copartInputDetected ? <Wand2 className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            {actionLabel}
          </button>
        ) : (
          <Link href={pathname === "/vehicles/new" ? "/vehicles" : "/vehicles/new"} className="w-full">
            <span className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-sm font-semibold text-white shadow-glow transition hover:bg-[#C88914]">
              <Plus className="h-4 w-4" />
              {actionLabel}
            </span>
          </Link>
        )
      ) : null}
    </form>
  );
}
