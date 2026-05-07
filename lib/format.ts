import { format } from "date-fns";

export function formatCurrency(value?: number | string | null) {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(amount ?? 0);
}

export function formatCompactCurrency(value?: number | string | null) {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(amount ?? 0);
}

export function formatPercent(value?: number | string | null) {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format((amount ?? 0) / 100);
}

export function formatDate(value?: Date | string | null) {
  if (!value) {
    return "Pendente";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "Pendente";
  }

  return format(date, "dd/MM/yyyy");
}

export function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "Pendente";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "Pendente";
  }

  return format(date, "dd/MM/yyyy HH:mm");
}
