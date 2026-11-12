
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  [
    "relative w-full rounded-xl border p-4",
    "text-sm",
    "[&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
    "[&>svg]:size-4 [&>svg]:shrink-0",
    "[&>svg~*]:pl-7",
    "[&>svg+div]:-translate-y-0.5",
    "transition-colors duration-200 ease-out",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "border-border",
          "bg-card text-card-foreground",
          "[&>svg]:text-foreground",
        ].join(" "),

        destructive: [
          "border-destructive/40",
          "bg-destructive/5 text-destructive",
          "dark:border-destructive/50",
          "[&>svg]:text-destructive",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));

Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn(
      "mb-1 font-semibold leading-snug tracking-tight",
      className
    )}
    {...props}
  />
));

AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-sm leading-relaxed text-muted-foreground",
      className
    )}
    {...props}
  />
));

AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
