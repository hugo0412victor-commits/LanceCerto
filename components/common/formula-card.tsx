import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";

export function FormulaCard({
  title,
  description,
  rows
}: {
  title: string;
  description: string;
  rows: Array<{ label: string; value: number; type?: "currency" | "percent" | "number" }>;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardContent className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-2xl border border-border/80 bg-background/60 px-4 py-2.5">
            <span className="text-[0.92rem] text-muted">{row.label}</span>
            <span className="font-semibold text-primary">
              {row.type === "percent"
                ? formatPercent(row.value)
                : row.type === "number"
                  ? row.value.toLocaleString("pt-BR")
                  : formatCurrency(row.value)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
