
import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        [
          "flex h-10 w-full min-w-0",
          "rounded-md border border-input",
          "bg-background px-3 py-2",
          "text-base text-foreground",
          "ring-offset-background",
          "placeholder:text-muted-foreground",
          "transition-[background-color,border-color,color,box-shadow,opacity]",
          "duration-180 ease-out",
          "focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-2",
          "aria-invalid:border-destructive",
          "aria-invalid:focus-visible:ring-destructive",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent",
          "file:text-sm file:font-medium file:text-foreground",
          "touch-manipulation",
          "md:text-sm",
        ].join(" "),
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";

export { Input };
