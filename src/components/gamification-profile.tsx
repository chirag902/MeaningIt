"use client";

import * as React from "react";
import {
  Flame,
  Languages,
  Lock,
  Star,
  TrendingUp,
} from "lucide-react";

import {
  badges,
  useGamification,
  XP_PER_LEVEL,
} from "@/hooks/use-gamification";

import { Badge } from "./ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Progress } from "./ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

const STAT_CARD_CLASS =
  "border-border/50 bg-card/60 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";

const BADGE_CARD_CLASS =
  "group flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-all duration-200";

export const GamificationProfile = React.memo(
  function GamificationProfile() {
    const {
      stats,
      progress,
      unlockedBadges,
      lockedBadges,
    } = useGamification();

    const isMaxLevel =
      progress.progressPercentage >= 100 ||
      progress.currentLevelXp >= XP_PER_LEVEL;

    const progressPercentage = Math.min(
      100,
      Math.max(0, progress.progressPercentage),
    );

    const languagesUsedCount = stats.languagesUsed.size;

    const unlockedBadgeCount = unlockedBadges.length;
    const totalBadgeCount = badges.length;

    return (
      <TooltipProvider delayDuration={200}>
        <div className="space-y-6">
          {/* Level & XP */}
          <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-primary/10 via-card/80 to-accent/10 shadow-lg backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10"
                    aria-hidden="true"
                  >
                    <TrendingUp className="h-8 w-8 text-primary" />

                    <span className="absolute -bottom-2 -right-2 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-background bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow-sm">
                      {stats.level}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <CardTitle className="text-xl sm:text-2xl">
                      Level {stats.level}
                    </CardTitle>

                    <CardDescription className="mt-1">
                      {isMaxLevel
                        ? "Maximum level reached"
                        : "Keep translating to reach the next level"}
                    </CardDescription>
                  </div>
                </div>

                <Badge
                  variant="secondary"
                  className="w-fit px-4 py-1.5 text-base font-bold"
                >
                  {stats.xp.toLocaleString()} XP
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-center text-xs font-semibold text-muted-foreground sm:text-sm">
                  Lvl {stats.level}
                </span>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex-1 cursor-help">
                      <Progress
                        value={progressPercentage}
                        aria-label={
                          isMaxLevel
                            ? "Maximum level reached"
                            : `${progress.currentLevelXp} of ${XP_PER_LEVEL} XP toward the next level`
                        }
                        className="h-2.5"
                      />
                    </div>
                  </TooltipTrigger>

                  <TooltipContent side="top">
                    {isMaxLevel ? (
                      <p>Maximum level reached</p>
                    ) : (
                      <p>
                        {progress.currentLevelXp.toLocaleString()} /{" "}
                        {XP_PER_LEVEL.toLocaleString()} XP to next level
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>

                <span className="w-12 shrink-0 text-center text-xs font-semibold text-muted-foreground sm:text-sm">
                  {isMaxLevel ? "MAX" : `Lvl ${stats.level + 1}`}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {isMaxLevel
                    ? "You've reached the highest level."
                    : `${Math.max(
                        0,
                        XP_PER_LEVEL - progress.currentLevelXp,
                      ).toLocaleString()} XP remaining`}
                </span>

                {!isMaxLevel && (
                  <span className="font-semibold">
                    {Math.round(progressPercentage)}%
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <section
            aria-label="Translation achievements"
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            <Card className={STAT_CARD_CLASS}>
              <CardHeader className="items-center pb-2 text-center">
                <Flame
                  className="h-8 w-8 text-orange-500"
                  aria-hidden="true"
                />

                <CardTitle className="mt-2 text-2xl font-bold">
                  {stats.streak.toLocaleString()}
                </CardTitle>

                <CardDescription>Day Streak</CardDescription>
              </CardHeader>
            </Card>

            <Card className={STAT_CARD_CLASS}>
              <CardHeader className="items-center pb-2 text-center">
                <Languages
                  className="h-8 w-8 text-primary"
                  aria-hidden="true"
                />

                <CardTitle className="mt-2 text-2xl font-bold">
                  {languagesUsedCount.toLocaleString()}
                </CardTitle>

                <CardDescription>Languages Used</CardDescription>
              </CardHeader>
            </Card>

            <Card className={STAT_CARD_CLASS}>
              <CardHeader className="items-center pb-2 text-center">
                <Star
                  className="h-8 w-8 text-amber-500"
                  aria-hidden="true"
                />

                <CardTitle className="mt-2 text-2xl font-bold">
                  {unlockedBadgeCount}/{totalBadgeCount}
                </CardTitle>

                <CardDescription>Badges Unlocked</CardDescription>
              </CardHeader>
            </Card>
          </section>

          {/* Badge Collection */}
          <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Badge Collection</CardTitle>
                  <CardDescription className="mt-1">
                    Track your translation achievements.
                  </CardDescription>
                </div>

                <Badge
                  variant="outline"
                  className="shrink-0"
                >
                  {unlockedBadgeCount}/{totalBadgeCount}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Unlocked badges */}
              <section aria-labelledby="unlocked-badges-heading">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3
                    id="unlocked-badges-heading"
                    className="font-semibold text-primary"
                  >
                    Unlocked
                  </h3>

                  <span className="text-xs text-muted-foreground">
                    {unlockedBadgeCount} earned
                  </span>
                </div>

                {unlockedBadges.length > 0 ? (
                  <div className="flex flex-wrap gap-3 sm:gap-4">
                    {unlockedBadges.map((badge) => {
                      const BadgeIcon = badge.icon;

                      return (
                        <Tooltip key={badge.id}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={`${badge.name}: ${badge.description}`}
                              className={`${BADGE_CARD_CLASS} border-amber-500/30 bg-amber-500/10 hover:border-amber-500/50 hover:bg-amber-500/15 hover:shadow-sm`}
                            >
                              <BadgeIcon
                                className="h-9 w-9 text-amber-500 transition-transform duration-200 group-hover:scale-105"
                                aria-hidden="true"
                              />

                              <span className="line-clamp-2 text-xs font-semibold leading-tight">
                                {badge.name}
                              </span>
                            </button>
                          </TooltipTrigger>

                          <TooltipContent
                            side="top"
                            className="max-w-xs text-center"
                          >
                            <p>{badge.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
                    <Star
                      className="mx-auto mb-2 h-7 w-7 text-muted-foreground"
                      aria-hidden="true"
                    />

                    <p className="text-sm font-medium">
                      No badges unlocked yet.
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Start translating to earn your first achievement.
                    </p>
                  </div>
                )}
              </section>

              {/* Locked badges */}
              {lockedBadges.length > 0 && (
                <>
                  <div
                    className="h-px w-full bg-border"
                    role="separator"
                  />

                  <section aria-labelledby="locked-badges-heading">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3
                        id="locked-badges-heading"
                        className="font-semibold text-muted-foreground"
                      >
                        Locked
                      </h3>

                      <span className="text-xs text-muted-foreground">
                        {lockedBadges.length} remaining
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3 sm:gap-4">
                      {lockedBadges.map((badge) => {
                        const BadgeIcon = badge.icon;

                        return (
                          <Tooltip key={badge.id}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Locked badge: ${badge.name}. ${badge.description}`}
                                className={`${BADGE_CARD_CLASS} border-border/60 bg-muted/40 opacity-60 grayscale transition-all hover:opacity-80 hover:grayscale-[0.7]`}
                              >
                                <div className="relative">
                                  <BadgeIcon
                                    className="h-9 w-9 text-muted-foreground"
                                    aria-hidden="true"
                                  />

                                  <Lock
                                    className="absolute -bottom-1 -right-2 h-4 w-4 rounded-full bg-background p-0.5 text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                </div>

                                <span className="line-clamp-2 text-xs font-semibold leading-tight">
                                  {badge.name}
                                </span>
                              </button>
                            </TooltipTrigger>

                            <TooltipContent
                              side="top"
                              className="max-w-xs text-center"
                            >
                              <p>{badge.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </section>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    );
  },
);

GamificationProfile.displayName = "GamificationProfile";