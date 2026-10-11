"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type VoiceVisualizerProps = {
  /**
   * Whether the visualizer should animate.
   *
   * Defaults to true.
   */
  active?: boolean;

  /**
   * Number of visualization bars.
   *
   * Defaults to 5.
   */
  barCount?: number;

  /**
   * Additional classes for the outer container.
   */
  className?: string;

  /**
   * Additional classes applied to every bar.
   */
  barClassName?: string;

  /**
   * Animation speed.
   *
   * `slow` is useful for passive listening states.
   * `normal` is the default.
   * `fast` works well when recording is active.
   */
  speed?: "slow" | "normal" | "fast";

  /**
   * Whether the visualizer should announce its state to assistive
   * technologies.
   *
   * Defaults to false because the animation is normally decorative.
   */
  announce?: boolean;
};

const BAR_HEIGHTS = [
  "h-2",
  "h-4",
  "h-5",
  "h-3",
  "h-6",
  "h-4",
  "h-5",
  "h-3",
] as const;

const SPEED_CLASSES = {
  slow: "animate-wave-slow",
  normal: "animate-wave",
  fast: "animate-wave-fast",
} as const;

const DELAY_CLASSES = [
  "[animation-delay:0ms]",
  "[animation-delay:100ms]",
  "[animation-delay:200ms]",
  "[animation-delay:300ms]",
  "[animation-delay:400ms]",
  "[animation-delay:300ms]",
  "[animation-delay:200ms]",
  "[animation-delay:100ms]",
] as const;

const MAX_BAR_COUNT = BAR_HEIGHTS.length;
const MIN_BAR_COUNT = 3;

function clampBarCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 5;
  }

  return Math.min(
    MAX_BAR_COUNT,
    Math.max(MIN_BAR_COUNT, Math.round(value)),
  );
}

export const VoiceVisualizer = React.memo(function VoiceVisualizer({
  active = true,
  barCount = 5,
  className,
  barClassName,
  speed = "normal",
  announce = false,
}: VoiceVisualizerProps) {
  const visibleBarCount = clampBarCount(barCount);

  const bars = React.useMemo(
    () =>
      Array.from({ length: visibleBarCount }, (_, index) => ({
        id: index,
        heightClass: BAR_HEIGHTS[index],
        delayClass: DELAY_CLASSES[index],
      })),
    [visibleBarCount],
  );

  return (
    <div
      className={cn(
        "flex h-6 w-20 items-center justify-center gap-1",
        className,
      )}
      role={announce ? "status" : undefined}
      aria-live={announce ? "polite" : undefined}
      aria-label={announce ? (active ? "Voice activity" : "Voice inactive") : undefined}
      aria-hidden={announce ? undefined : true}
    >
      {bars.map((bar) => (
        <span
          key={bar.id}
          className={cn(
            "w-1 shrink-0 rounded-full bg-accent",
            bar.heightClass,
            active
              ? cn(
                  SPEED_CLASSES[speed],
                  bar.delayClass,
                )
              : "scale-y-[0.65] opacity-40",
            "motion-reduce:animate-none motion-reduce:opacity-70",
            "transition-all duration-200",
            barClassName,
          )}
        />
      ))}
    </div>
  );
});

VoiceVisualizer.displayName = "VoiceVisualizer";