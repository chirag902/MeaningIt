
"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, max = 100, ...props }, ref) => {
  const safeMax =
    Number.isFinite(max) && max > 0 ? max : 100;

  const safeValue =
    value == null || !Number.isFinite(value)
      ? null
      : Math.min(Math.max(value, 0), safeMax);

  const percentage =
    safeValue === null ? 0 : (safeValue / safeMax) * 100;

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={safeValue}
      max={safeMax}
      className={cn(
        "relative h-2.5 w-full overflow-hidden",
        "rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 rounded-full bg-primary",
          "transition-transform duration-200 ease-out",
          "motion-reduce:transition-none"
        )}
        style={{
          transform: `translateX(-${100 - percentage}%)`,
        }}
      />
    </ProgressPrimitive.Root>
  );
});

Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
