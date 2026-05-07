import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";

export function StatCard({
  label,
  value,
  format = "currency",
  helper,
  trend,
  icon: Icon
}: {
  label: string;
  value: number;
  format?: "currency" | "percent" | "number";
  helper?: string;
  trend?: "up" | "down" | "neutral";
  icon?: LucideIcon;
}) {
  const formatted =
    format === "percent"
      ? formatPercent(value)
      : format === "number"
        ? value.toLocaleString("pt-BR")
        : formatCurrency(value);

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon ? (
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <Icon className="h-5 w-5" />
              </span>
            ) : null}
            <p className="text-sm font-medium text-muted">{label}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-background/80">
            {trend === "up" ? (
              <ArrowUpRight className="h-4 w-4 text-success" />
            ) : trend === "down" ? (
              <ArrowDownRight className="h-4 w-4 text-danger" />
            ) : null}
          </div>
        </div>
        <p className="stat-value font-display text-[1.9rem] font-bold tracking-[-0.04em] text-primary">{formatted}</p>
        {helper ? <p className="text-xs uppercase tracking-[0.18em] text-muted">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}
