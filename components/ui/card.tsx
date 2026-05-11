import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("surface-card rounded-[2rem]", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-6 py-5">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-primary">{title}</h2>
        {description ? <p className="text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function CardContent({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}
