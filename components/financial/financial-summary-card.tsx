import { cn } from "@/lib/utils";

export function FinancialSummaryCard({
  label,
  value,
  icon: Icon,
  tone = "neutral"
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "good" | "alert";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "alert"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-border bg-white/82 text-primary";

  return (
    <div className={cn("flex min-h-[132px] flex-col justify-between rounded-[1.2rem] border p-4 shadow-sm", toneClass)}>
      <div className="flex min-h-10 items-start justify-between gap-3">
        <p className="max-w-[12rem] text-xs font-semibold uppercase leading-5 tracking-[0.14em] opacity-75">{label}</p>
        <Icon className="h-4 w-4 shrink-0" />
      </div>
      <p className="mt-3 break-words text-2xl font-semibold leading-8 tracking-normal">{value}</p>
    </div>
  );
}
