import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  markClassName,
  textClassName,
  taglineClassName,
  showTagline = false,
  stacked = false,
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  taglineClassName?: string;
  showTagline?: boolean;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5",
        stacked && "flex-col gap-3 text-center",
        className
      )}
    >
      <span
        className={cn("relative flex size-10 shrink-0 items-center justify-center", markClassName)}
      >
        <Image
          src="/truckguard-icon.png"
          alt="TruckGuard"
          fill
          sizes="(max-width: 96px) 100vw, 96px"
          className="object-contain"
          priority
        />
      </span>
      <span className="flex flex-col">
        <span
          className={cn(
            "font-heading text-lg leading-tight font-semibold tracking-wide uppercase",
            textClassName
          )}
        >
          TruckGuard
        </span>
        {showTagline && (
          <span
            className={cn(
              "font-ui text-xs font-medium tracking-wider text-muted-foreground uppercase whitespace-nowrap",
              taglineClassName
            )}
          >
            Software de gestión de flota
          </span>
        )}
      </span>
    </div>
  );
}
