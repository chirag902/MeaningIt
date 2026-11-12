
"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 sm:p-4", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row sm:gap-6",
        month: "w-full space-y-4",

        month_caption:
          "relative flex h-9 items-center justify-center px-10",

        caption_label:
          "text-sm font-semibold tracking-tight text-foreground",

        month_grid: "w-full border-collapse",

        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "absolute left-0 top-0 h-9 w-9 rounded-lg",
          "text-muted-foreground",
          "transition-colors duration-200 ease-out",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-40"
        ),

        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "absolute right-0 top-0 h-9 w-9 rounded-lg",
          "text-muted-foreground",
          "transition-colors duration-200 ease-out",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-40"
        ),

        weekdays: "flex w-full",

        weekday:
          "flex-1 rounded-md py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground",

        week: "mt-1 flex w-full",

        day:
          "relative flex h-9 flex-1 items-center justify-center p-0 text-sm",

        day_button: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-9 w-9 rounded-lg p-0 font-normal",
          "text-foreground",
          "transition-colors duration-200 ease-out",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-1",
          "aria-selected:font-semibold"
        ),

        selected:
          "bg-primary text-primary-foreground font-semibold hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",

        today:
          "bg-accent text-accent-foreground font-semibold",

        outside:
          "text-muted-foreground/50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",

        disabled:
          "cursor-not-allowed text-muted-foreground/40 opacity-50",

        range_start:
          "rounded-l-lg bg-primary text-primary-foreground",

        range_end:
          "rounded-r-lg bg-primary text-primary-foreground",

        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",

        hidden: "invisible",

        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...iconProps }) => {
          const Icon =
            orientation === "left" ? ChevronLeft : ChevronRight;

          return (
            <Icon
              aria-hidden="true"
              className={cn("h-4 w-4", className)}
              {...iconProps}
            />
          );
        },
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
