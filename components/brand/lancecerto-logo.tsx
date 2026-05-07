import Image from "next/image";
import { cn } from "@/lib/utils";

type LanceCertoLogoProps = {
  className?: string;
  compact?: boolean;
  showTagline?: boolean;
  invert?: boolean;
};

export function LanceCertoLogo({
  className,
  compact = false,
  showTagline = false,
  invert = false
}: LanceCertoLogoProps) {
  const ink = invert ? "#FFFFFF" : "#0D3B5C";
  const amber = "#E09A1A";

  if (!compact) {
    return (
      <div className={cn("flex items-center", className)}>
        <Image
          src="/brand/lancecerto-logo-hd.png"
          alt="LanceCerto"
          width={1900}
          height={859}
          priority={showTagline}
          className={cn(
            "h-auto max-w-full object-contain",
            showTagline ? "w-[300px] sm:w-[360px] lg:w-[420px]" : "w-[260px] sm:w-[320px]"
          )}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-11 w-11 shrink-0" fill="none">
        <path d="M18 16H44" stroke={ink} strokeWidth="8" strokeLinecap="square" />
        <path d="M18 16V42" stroke={ink} strokeWidth="8" strokeLinecap="square" />
        <path d="M78 54V80" stroke={ink} strokeWidth="8" strokeLinecap="square" />
        <path d="M52 80H78" stroke={ink} strokeWidth="8" strokeLinecap="square" />
        <path
          d="M20 54L40 74L81 33"
          stroke={amber}
          strokeWidth="8"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <path
          d="M74 26L81 33L74 40"
          stroke={amber}
          strokeWidth="6"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <rect x="46" y="16" width="12" height="34" rx="2" transform="rotate(45 46 16)" fill={ink} />
        <rect x="60" y="10" width="8" height="23" rx="2" transform="rotate(45 60 10)" fill={ink} />
        <rect x="45" y="46" width="8" height="22" rx="2" transform="rotate(45 45 46)" fill={ink} />
      </svg>
    </div>
  );
}
