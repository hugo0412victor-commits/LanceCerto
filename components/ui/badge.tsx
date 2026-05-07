import { cn } from "@/lib/utils";

const toneMap = {
  neutral: "border border-slate-200 bg-slate-100 text-slate-700",
  success: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border border-amber-200 bg-amber-50 text-amber-700",
  danger: "border border-rose-200 bg-rose-50 text-rose-700",
  info: "border border-primary/10 bg-primary/8 text-primary"
} as const;

export function Badge({
  children,
  tone = "neutral",
  className
}: {
  children: React.ReactNode;
  tone?: keyof typeof toneMap;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
        toneMap[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
