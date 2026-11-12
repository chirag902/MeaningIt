
"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      [
        "peer relative inline-flex h-5 w-5 shrink-0",
        "items-center justify-center",
        "rounded-[5px] border border-input",
        "bg-background text-primary-foreground",
        "ring-offset-background",
        "transition-[background-color,border-color,box-shadow,opacity]",
        "duration-200 ease-out",
        "focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-primary",
        "data-[state=checked]:bg-primary",
        "data-[state=checked]:text-primary-foreground",
        "data-[state=indeterminate]:border-primary",
        "data-[state=indeterminate]:bg-primary",
        "touch-manipulation",
      ].join(" "),
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className="flex items-center justify-center text-current"
    >
      <Check
        className="h-3.5 w-3.5"
        strokeWidth={2.5}
        aria-hidden="true"
      />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
