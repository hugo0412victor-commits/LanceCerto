import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 rounded-[2rem] border border-border/70 bg-white/72 px-6 py-5 backdrop-blur md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div>
        {eyebrow ? <p className="text-xs uppercase tracking-[0.28em] text-accent">{eyebrow}</p> : null}
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.04em] text-primary">{title}</h1>
        {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
