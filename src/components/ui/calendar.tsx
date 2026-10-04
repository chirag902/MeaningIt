"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

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
        /* =====================================================
           LAYOUT
           ===================================================== */

        months:
          "flex flex-col sm:flex-row gap-4 sm:gap-6",

        month:
          "space-y-4 w-full",

        month_caption:
          "relative flex h-9 items-center justify-center px-10",

        caption_label:
          "text-sm font-semibold tracking-tight text-foreground",

        month_grid:
          "w-full border-collapse",

        /* =====================================================
           NAVIGATION
           ===================================================== */

        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "absolute left-0 top-0 h-8 w-8 rounded-lg p-0",
          "text-muted-foreground",
          "transition-colors duration-150",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-40"
        ),

        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "absolute right-0 top-0 h-8 w-8 rounded-lg p-0",
          "text-muted-foreground",
          "transition-colors duration-150",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-40"
        ),

        /* =====================================================
           WEEK / DAY HEADER
           ===================================================== */

        weekdays:
          "flex w-full",

        weekday:
          "flex-1 rounded-md text-center text-[0.72rem] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs",

        /* =====================================================
           CALENDAR ROWS
           ===================================================== */

        week:
          "mt-2 flex w-full",

        /* =====================================================
           DAY CELL
           ===================================================== */

        day:
          "relative flex h-9 flex-1 items-center justify-center p-0 text-sm",

        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 rounded-lg p-0 font-normal",
          "text-foreground",
          "transition-all duration-150",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-1",
          "aria-selected:opacity-100",
          "aria-selected:font-semibold"
        ),

        /* =====================================================
           SELECTED DAY
           ===================================================== */

        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",

        /* =====================================================
           TODAY
           ===================================================== */

        today:
          "bg-accent text-accent-foreground font-semibold ring-1 ring-inset ring-primary/20",

        /* =====================================================
           OUTSIDE DAYS
           ===================================================== */

        outside:
          "text-muted-foreground/50",

        /* =====================================================
           DISABLED DAYS
           ===================================================== */

        disabled:
          "text-muted-foreground/40 opacity-50 cursor-not-allowed",

        /* =====================================================
           RANGE SELECTION
           ===================================================== */

        range_start:
          "rounded-l-lg bg-primary text-primary-foreground",

        range_end:
          "rounded-r-lg bg-primary text-primary-foreground",

        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",

        /* =====================================================
           HIDDEN DAYS
           ===================================================== */

        hidden:
          "invisible",

        /*
         * Consumer overrides remain supported.
         */
        ...classNames,
      }}
      components={{
        Chevron: ({
          orientation,
          className,
          ...iconProps
        }) => {
          if (orientation === "left") {
            return (
              <ChevronLeft
                aria-hidden="true"
                className={cn("h-4 w-4", className)}
                {...iconProps}
              />
            )
          }

          return (
            <ChevronRight
              aria-hidden="true"
              className={cn("h-4 w-4", className)}
              {...iconProps}
            />
          )
        },
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }