"use client";

import { useEffect, useMemo, useState } from "react";

type SaleCountdownProps = {
  saleDate?: string | Date | null;
  sold?: boolean | null;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
  timeZoneName: "short"
});

function formatRemaining(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  return `${String(days).padStart(2, "0")}D ${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}min`;
}

export function SaleCountdown({ saleDate, sold }: SaleCountdownProps) {
  const parsedSaleDate = useMemo(() => {
    if (!saleDate) {
      return null;
    }

    const date = saleDate instanceof Date ? saleDate : new Date(saleDate);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [saleDate]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  if (!parsedSaleDate) {
    return (
      <div className="rounded-2xl border border-border bg-white/75 p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Data da venda</p>
        <p className="mt-2 font-semibold text-foreground">Data de venda não informada</p>
      </div>
    );
  }

  const remainingMs = parsedSaleDate.getTime() - now;
  const isClosed = remainingMs <= 0;
  const status = sold ? "Lote vendido" : isClosed ? "Venda encerrada" : formatRemaining(remainingMs);
  const statusClassName = sold || isClosed ? "text-slate-700" : "text-emerald-700";

  return (
    <div className="rounded-2xl border border-border bg-white/75 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">Data da venda</p>
      <p className="mt-2 font-semibold capitalize text-foreground">{dateFormatter.format(parsedSaleDate)}</p>
      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted">Tempo restante</p>
      <p className={`mt-2 text-2xl font-bold ${statusClassName}`}>{status}</p>
    </div>
  );
}
