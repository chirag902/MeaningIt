
import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        [
          "flex min-h-[80px] w-full min-w-0",
          "rounded-md border border-input",
          "bg-background px-3 py-2",
          "text-base leading-relaxed text-foreground",
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
          "md:text-sm",
        ].join(" "),
        className
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export { Textarea };
