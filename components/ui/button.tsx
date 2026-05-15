import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-2xl border border-transparent px-4 py-2.5 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-panel hover:bg-[#0A314C]",
        accent: "bg-accent text-accent-foreground shadow-glow hover:bg-[#C88914]",
        secondary: "border-primary/18 bg-white text-primary hover:border-primary/35 hover:bg-primary/5",
        destructive: "bg-rose-600 text-white shadow-panel hover:bg-rose-700",
        ghost: "text-foreground hover:bg-slate-100"
      }
    },
    defaultVariants: {
      variant: "primary"
    }
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
