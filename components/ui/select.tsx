import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/45 focus:ring-4 focus:ring-primary/10",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
