import { WalletCards } from "lucide-react";

export function EmptyFinancialState({
  title,
  description
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/60 px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-white text-primary shadow-sm">
        <WalletCards className="h-5 w-5" />
      </span>
      <p className="mt-4 font-semibold text-primary">{title}</p>
      {description ? <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{description}</p> : null}
    </div>
  );
}
