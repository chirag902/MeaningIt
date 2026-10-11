'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BookUser,
  Camera,
  Flame,
  Languages,
  Medal,
  MessageSquareQuote,
  TrendingUp,
} from 'lucide-react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type GamificationStats = {
  level: number;
  xp: number;
  streak: number;
  lastUsedDate: string | null;

  translations: {
    text: number;
    image: number;
  };

  tutorMessages: number;

  languagesUsed: Set<string>;

  unlockedBadgeIds: string[];
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  isUnlocked: (stats: GamificationStats) => boolean;
};

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const XP_PER_LEVEL = 100;

const XP_FOR_STREAK = 10;

const XP_PER_TEXT_TRANSLATION = 5;
const XP_PER_IMAGE_TRANSLATION = 8;
const XP_PER_TUTOR_MESSAGE = 3;

const GAMIFICATION_STORAGE_KEY =
  'meaningit_gamification_stats';

const GAMIFICATION_STORAGE_VERSION = 2;

const MAX_LEVEL = 100_000;
const MAX_XP = MAX_LEVEL * XP_PER_LEVEL;

const MAX_STREAK = 100_000;

const MAX_TRANSLATIONS = 1_000_000;
const MAX_TUTOR_MESSAGES = 1_000_000;

const MAX_LANGUAGES = 500;

const MAX_BADGE_IDS = 500;

// -----------------------------------------------------------------------------
// Badges
// -----------------------------------------------------------------------------

export const badges: Badge[] = [
  {
    id: 'first_translation',
    name: 'First Step',
    description: 'Completed your first text translation.',
    icon: Medal,
    isUnlocked: (stats) =>
      stats.translations.text >= 1,
  },

  {
    id: 'text_translator_10',
    name: 'Word Weaver',
    description: 'Completed 10 text translations.',
    icon: Award,
    isUnlocked: (stats) =>
      stats.translations.text >= 10,
  },

  {
    id: 'text_translator_50',
    name: 'Lexicographer',
    description: 'Completed 50 text translations.',
    icon: BookUser,
    isUnlocked: (stats) =>
      stats.translations.text >= 50,
  },

  {
    id: 'first_image_translation',
    name: 'Eagle Eye',
    description: 'Completed your first image translation.',
    icon: Camera,
    isUnlocked: (stats) =>
      stats.translations.image >= 1,
  },

  {
    id: 'first_chatbot_message',
    name: 'Conversation Starter',
    description: 'Sent your first message to the AI Tutor.',
    icon: MessageSquareQuote,
    isUnlocked: (stats) =>
      stats.tutorMessages >= 1,
  },

  {
    id: 'polyglot_novice',
    name: 'Language Explorer',
    description: 'Translated into 3 different languages.',
    icon: Languages,
    isUnlocked: (stats) =>
      stats.languagesUsed.size >= 3,
  },

  {
    id: 'polyglot_pro',
    name: 'Polyglot Pro',
    description: 'Translated into 10 different languages.',
    icon: Languages,
    isUnlocked: (stats) =>
      stats.languagesUsed.size >= 10,
  },

  {
    id: 'streak_3_days',
    name: 'On a Roll',
    description: 'Maintained a 3-day streak.',
    icon: Flame,
    isUnlocked: (stats) =>
      stats.streak >= 3,
  },

  {
    id: 'streak_7_days',
    name: 'Committed',
    description: 'Maintained a 7-day streak.',
    icon: Flame,
    isUnlocked: (stats) =>
      stats.streak >= 7,
  },

  {
    id: 'level_up_5',
    name: 'Level 5!',
    description: 'Reached level 5.',
    icon: TrendingUp,
    isUnlocked: (stats) =>
      stats.level >= 5,
  },

  {
    id: 'level_up_10',
    name: 'Level 10!',
    description: 'Reached level 10.',
    icon: TrendingUp,
    isUnlocked: (stats) =>
      stats.level >= 10,
  },
];

// -----------------------------------------------------------------------------
// Default state
// -----------------------------------------------------------------------------

function createDefaultStats(): GamificationStats {
  return {
    level: 1,
    xp: 0,
    streak: 0,
    lastUsedDate: null,

    translations: {
      text: 0,
      image: 0,
    },

    tutorMessages: 0,

    languagesUsed: new Set<string>(),

    unlockedBadgeIds: [],
  };
}

// -----------------------------------------------------------------------------
// Number helpers
// -----------------------------------------------------------------------------

function clampInteger(
  value: unknown,
  min: number,
  max: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return min;
  }

  return Math.min(
    max,
    Math.max(min, Math.floor(value)),
  );
}

// -----------------------------------------------------------------------------
// Date helpers
// -----------------------------------------------------------------------------

/**
 * Uses the user's local calendar day rather than UTC.
 *
 * This is important because using `toISOString()` directly for streak
 * calculations can cause streaks to change around midnight depending
 * on the user's timezone.
 */
function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    date.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateKey(
  value: string | null,
): Date | null {
  if (!value) {
    return null;
  }

  /**
   * New format: YYYY-MM-DD
   */
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    const [
      yearString,
      monthString,
      dayString,
    ] = value.split('-');

    const year = Number(yearString);
    const month = Number(monthString);
    const day = Number(dayString);

    const date = new Date(
      year,
      month - 1,
      day,
    );

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  /**
   * Backward compatibility with your previous implementation,
   * which stored `Date.toISOString()`.
   */
  const parsed = new Date(value);

  if (
    Number.isNaN(parsed.getTime())
  ) {
    return null;
  }

  return parsed;
}

function isSameDay(
  first: Date,
  second: Date,
): boolean {
  return (
    first.getFullYear() ===
      second.getFullYear() &&
    first.getMonth() ===
      second.getMonth() &&
    first.getDate() ===
      second.getDate()
  );
}

function isYesterday(
  today: Date,
  other: Date,
): boolean {
  const yesterday = new Date(today);

  yesterday.setDate(
    today.getDate() - 1,
  );

  return isSameDay(
    yesterday,
    other,
  );
}

// -----------------------------------------------------------------------------
// Stats normalization / persistence
// -----------------------------------------------------------------------------

type PersistedGamificationStats = {
  version?: number;
  level?: unknown;
  xp?: unknown;
  streak?: unknown;
  lastUsedDate?: unknown;

  translations?: {
    text?: unknown;
    image?: unknown;
  };

  tutorMessages?: unknown;

  languagesUsed?: unknown;

  unlockedBadgeIds?: unknown;
};

function normalizeStats(
  raw: unknown,
): GamificationStats {
  const defaults =
    createDefaultStats();

  if (
    typeof raw !== 'object' ||
    raw === null
  ) {
    return defaults;
  }

  const saved =
    raw as PersistedGamificationStats;

  const languages = new Set<string>();

  if (
    Array.isArray(
      saved.languagesUsed,
    )
  ) {
    for (
      const language of saved.languagesUsed
    ) {
      if (
        typeof language !== 'string'
      ) {
        continue;
      }

      const normalized =
        language.trim();

      if (!normalized) {
        continue;
      }

      languages.add(
        normalized.slice(0, 100),
      );

      if (
        languages.size >=
        MAX_LANGUAGES
      ) {
        break;
      }
    }
  }

  const unlockedBadgeIds =
    Array.isArray(
      saved.unlockedBadgeIds,
    )
      ? saved.unlockedBadgeIds
          .filter(
            (
              id,
            ): id is string =>
              typeof id === 'string' &&
              id.trim().length > 0,
          )
          .filter(
            (
              id,
              index,
              array,
            ) =>
              array.indexOf(id) ===
              index,
          )
          .filter((id) =>
            badges.some(
              (badge) =>
                badge.id === id,
            ),
          )
          .slice(0, MAX_BADGE_IDS)
      : [];

  const textTranslations =
    clampInteger(
      saved.translations
        ?.text,
      0,
      MAX_TRANSLATIONS,
    );

  const imageTranslations =
    clampInteger(
      saved.translations
        ?.image,
      0,
      MAX_TRANSLATIONS,
    );

  const tutorMessages =
    clampInteger(
      saved.tutorMessages,
      0,
      MAX_TUTOR_MESSAGES,
    );

  const xp =
    clampInteger(
      saved.xp,
      0,
      MAX_XP,
    );

  const calculatedLevel =
    Math.floor(
      xp / XP_PER_LEVEL,
    ) + 1;

  const level =
    clampInteger(
      saved.level,
      1,
      MAX_LEVEL,
    );

  /**
   * XP is the source of truth for level.
   *
   * This prevents corrupted localStorage from producing:
   * level 50 with only 20 XP, etc.
   */
  const normalizedLevel =
    Math.min(
      MAX_LEVEL,
      Math.max(
        1,
        Math.min(
          level,
          calculatedLevel,
        ),
      ),
    );

  const streak =
    clampInteger(
      saved.streak,
      0,
      MAX_STREAK,
    );

  const lastUsedDate =
    typeof saved.lastUsedDate ===
    'string' &&
    parseDateKey(
      saved.lastUsedDate,
    )
      ? saved.lastUsedDate
      : null;

  return {
    level: normalizedLevel,
    xp,
    streak,
    lastUsedDate,

    translations: {
      text: textTranslations,
      image: imageTranslations,
    },

    tutorMessages,

    languagesUsed: languages,

    unlockedBadgeIds,
  };
}

function serializeStats(
  stats: GamificationStats,
): string {
  return JSON.stringify({
    version:
      GAMIFICATION_STORAGE_VERSION,

    level: stats.level,
    xp: stats.xp,
    streak: stats.streak,
    lastUsedDate:
      stats.lastUsedDate,

    translations: {
      text:
        stats.translations.text,
      image:
        stats.translations.image,
    },

    tutorMessages:
      stats.tutorMessages,

    languagesUsed:
      Array.from(
        stats.languagesUsed,
      ),

    unlockedBadgeIds:
      stats.unlockedBadgeIds,
  });
}

function loadStatsFromStorage(): GamificationStats {
  try {
    const raw =
      window.localStorage.getItem(
        GAMIFICATION_STORAGE_KEY,
      );

    if (!raw) {
      return createDefaultStats();
    }

    const parsed: unknown =
      JSON.parse(raw);

    return normalizeStats(parsed);
  } catch (error: unknown) {
    console.error(
      '[Gamification] Failed to load saved stats:',
      error,
    );

    return createDefaultStats();
  }
}

function saveStatsToStorage(
  stats: GamificationStats,
): void {
  try {
    window.localStorage.setItem(
      GAMIFICATION_STORAGE_KEY,
      serializeStats(stats),
    );
  } catch (error: unknown) {
    /**
     * localStorage can fail because of:
     * - private browsing restrictions
     * - storage quotas
     * - browser policies
     */
    console.error(
      '[Gamification] Failed to persist stats:',
      error,
    );
  }
}

// -----------------------------------------------------------------------------
// Badge helpers
// -----------------------------------------------------------------------------

function getNewlyUnlockedBadges(
  stats: GamificationStats,
): Badge[] {
  return badges.filter(
    (badge) =>
      !stats.unlockedBadgeIds.includes(
        badge.id,
      ) &&
      badge.isUnlocked(stats),
  );
}

function unlockEligibleBadges(
  stats: GamificationStats,
): GamificationStats {
  const eligible =
    getNewlyUnlockedBadges(stats);

  if (eligible.length === 0) {
    return stats;
  }

  const unlockedIds =
    new Set(
      stats.unlockedBadgeIds,
    );

  for (
    const badge of eligible
  ) {
    unlockedIds.add(
      badge.id,
    );
  }

  return {
    ...stats,
    unlockedBadgeIds:
      Array.from(unlockedIds),
  };
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export const useGamification =
  () => {
    const { toast } =
      useToast();

    const [
      stats,
      setStats,
    ] =
      React.useState<GamificationStats>(
        createDefaultStats,
      );

    const [
      isLoaded,
      setIsLoaded,
    ] =
      React.useState(false);

    const previousStatsRef =
      React.useRef<GamificationStats>(
        createDefaultStats(),
      );

    const isLoadedRef =
      React.useRef(false);

    // -------------------------------------------------------------------------
    // Load saved state
    // -------------------------------------------------------------------------

    React.useEffect(() => {
      const loadedStats =
        loadStatsFromStorage();

      /**
       * Re-evaluate badges on load.
       *
       * This also repairs older localStorage versions where a badge may
       * not have been recorded even though the user already qualifies.
       */
      const normalizedStats =
        unlockEligibleBadges(
          loadedStats,
        );

      previousStatsRef.current =
        normalizedStats;

      setStats(
        normalizedStats,
      );

      isLoadedRef.current =
        true;

      setIsLoaded(true);
    }, []);

    // -------------------------------------------------------------------------
    // Persist state
    // -------------------------------------------------------------------------

    React.useEffect(() => {
      if (!isLoaded) {
        return;
      }

      saveStatsToStorage(stats);
    }, [stats, isLoaded]);

    // -------------------------------------------------------------------------
    // Cross-tab synchronization
    // -------------------------------------------------------------------------

    React.useEffect(() => {
      if (!isLoaded) {
        return;
      }

      const handleStorage =
        (
          event: StorageEvent,
        ) => {
          if (
            event.key !==
              GAMIFICATION_STORAGE_KEY ||
            !event.newValue
          ) {
            return;
          }

          try {
            const parsed: unknown =
              JSON.parse(
                event.newValue,
              );

            const externalStats =
              unlockEligibleBadges(
                normalizeStats(
                  parsed,
                ),
              );

            previousStatsRef.current =
              externalStats;

            setStats(
              externalStats,
            );
          } catch (error: unknown) {
            console.error(
              '[Gamification] Failed to sync external stats:',
              error,
            );
          }
        };

      window.addEventListener(
        'storage',
        handleStorage,
      );

      return () => {
        window.removeEventListener(
          'storage',
          handleStorage,
        );
      };
    }, [isLoaded]);

    // -------------------------------------------------------------------------
    // Achievement notifications
    // -------------------------------------------------------------------------

    React.useEffect(() => {
      if (!isLoaded) {
        return;
      }

      const previousStats =
        previousStatsRef.current;

      // -----------------------------------------------------------------------
      // Level-up notification
      // -----------------------------------------------------------------------

      if (
        stats.level >
        previousStats.level
      ) {
        const levelDifference =
          stats.level -
          previousStats.level;

        toast({
          title:
            levelDifference === 1
              ? `Level Up! You've reached Level ${stats.level}!`
              : `Amazing! You reached Level ${stats.level}!`,
          description:
            'Keep learning and translating to earn more XP.',
        });
      }

      // -----------------------------------------------------------------------
      // Streak notification
      // -----------------------------------------------------------------------

      if (
        stats.streak >
        previousStats.streak
      ) {
        if (stats.streak === 1) {
          toast({
            title:
              '🔥 Streak Started!',
            description:
              'You earned your first daily activity bonus.',
          });
        } else {
          toast({
            title:
              `🔥 ${stats.streak}-Day Streak!`,
            description:
              `You earned ${XP_FOR_STREAK} bonus XP for keeping your streak alive.`,
          });
        }
      }

      // -----------------------------------------------------------------------
      // Badge notification
      // -----------------------------------------------------------------------

      const newBadgeIds =
        stats.unlockedBadgeIds.filter(
          (id) =>
            !previousStats.unlockedBadgeIds.includes(
              id,
            ),
        );

      if (
        newBadgeIds.length > 0
      ) {
        const newBadges =
          badges.filter(
            (badge) =>
              newBadgeIds.includes(
                badge.id,
              ),
          );

        for (
          const badge of newBadges
        ) {
          const BadgeIcon =
            badge.icon;

          toast({
            title:
              'Badge Unlocked!',

            description: (
              <div className="flex items-center gap-2">
                <BadgeIcon
                  className="h-5 w-5 text-amber-500"
                  aria-hidden="true"
                />

                <span className="font-semibold">
                  {badge.name}
                </span>
              </div>
            ),
          });
        }
      }

      previousStatsRef.current =
        stats;
    }, [stats, toast, isLoaded]);

    // -------------------------------------------------------------------------
    // Core stats updater
    // -------------------------------------------------------------------------

    const updateStats =
      React.useCallback(
        (
          updateFn: (
            currentStats: GamificationStats,
          ) => Partial<GamificationStats>,
          xpGained: number,
        ) => {
          /**
           * Don't allow an interaction to overwrite persisted data while
           * the initial localStorage hydration is still in progress.
           */
          if (!isLoadedRef.current) {
            return;
          }

          setStats(
            (currentStats) => {
              const now =
                new Date();

              const todayKey =
                getLocalDateKey(
                  now,
                );

              const lastUsed =
                parseDateKey(
                  currentStats.lastUsedDate,
                );

              let nextStreak =
                currentStats.streak;

              let streakBonusXp =
                0;

              /**
               * Award streak activity only once per calendar day.
               */
              if (
                !lastUsed ||
                !isSameDay(
                  now,
                  lastUsed,
                )
              ) {
                if (
                  lastUsed &&
                  isYesterday(
                    now,
                    lastUsed,
                  )
                ) {
                  nextStreak =
                    Math.min(
                      MAX_STREAK,
                      currentStats.streak +
                        1,
                    );

                  streakBonusXp =
                    XP_FOR_STREAK;
                } else {
                  nextStreak = 1;
                }
              }

              /**
               * Clone every mutable structure.
               *
               * This is important because mutating:
               *
               * currentStats.languagesUsed.add(...)
               *
               * directly can cause subtle React state bugs.
               */
              let nextStats: GamificationStats =
                {
                  ...currentStats,

                  streak:
                    nextStreak,

                  lastUsedDate:
                    todayKey,

                  languagesUsed:
                    new Set(
                      currentStats.languagesUsed,
                    ),

                  unlockedBadgeIds:
                    [
                      ...currentStats.unlockedBadgeIds,
                    ],

                  translations: {
                    ...currentStats.translations,
                  },
                };

              const updates =
                updateFn(
                  nextStats,
                );

              nextStats = {
                ...nextStats,
                ...updates,
              };

              /**
               * Keep all counters safe and bounded.
               */
              nextStats.translations =
                {
                  text:
                    clampInteger(
                      nextStats
                        .translations
                        .text,
                      0,
                      MAX_TRANSLATIONS,
                    ),

                  image:
                    clampInteger(
                      nextStats
                        .translations
                        .image,
                      0,
                      MAX_TRANSLATIONS,
                    ),
                };

              nextStats.tutorMessages =
                clampInteger(
                  nextStats.tutorMessages,
                  0,
                  MAX_TUTOR_MESSAGES,
                );

              nextStats.streak =
                clampInteger(
                  nextStats.streak,
                  0,
                  MAX_STREAK,
                );

              nextStats.xp =
                clampInteger(
                  nextStats.xp,
                  0,
                  MAX_XP,
                );

              // -----------------------------------------------------------------
              // XP
              // -----------------------------------------------------------------

              const safeXp =
                clampInteger(
                  xpGained,
                  0,
                  MAX_XP,
                );

              const totalXpGained =
                Math.min(
                  MAX_XP -
                    nextStats.xp,
                  safeXp +
                    streakBonusXp,
                );

              if (
                totalXpGained > 0
              ) {
                nextStats.xp +=
                  totalXpGained;
              }

              /**
               * XP is the authoritative source for level.
               */
              nextStats.level =
                Math.min(
                  MAX_LEVEL,
                  Math.floor(
                    nextStats.xp /
                      XP_PER_LEVEL,
                  ) + 1,
                );

              // -----------------------------------------------------------------
              // Badges
              // -----------------------------------------------------------------

              nextStats =
                unlockEligibleBadges(
                  nextStats,
                );

              return nextStats;
            },
          );
        },
        [],
      );

    // -------------------------------------------------------------------------
    // Text translation
    // -------------------------------------------------------------------------

    const logTextTranslation =
      React.useCallback(
        (targetLang: string) => {
          const normalizedLanguage =
            targetLang
              ?.trim()
              .slice(0, 100);

          if (
            !normalizedLanguage
          ) {
            return;
          }

          updateStats(
            (previousStats) => {
              const languagesUsed =
                new Set(
                  previousStats.languagesUsed,
                );

              if (
                languagesUsed.size <
                MAX_LANGUAGES
              ) {
                languagesUsed.add(
                  normalizedLanguage,
                );
              }

              return {
                translations: {
                  ...previousStats.translations,

                  text:
                    Math.min(
                      MAX_TRANSLATIONS,
                      previousStats
                        .translations
                        .text + 1,
                    ),
                },

                languagesUsed,
              };
            },

            XP_PER_TEXT_TRANSLATION,
          );
        },
        [updateStats],
      );

    // -------------------------------------------------------------------------
    // Image translation
    // -------------------------------------------------------------------------

    const logImageTranslation =
      React.useCallback(
        () => {
          updateStats(
            (previousStats) => ({
              translations: {
                ...previousStats.translations,

                image:
                  Math.min(
                    MAX_TRANSLATIONS,
                    previousStats
                      .translations
                      .image + 1,
                  ),
              },
            }),

            XP_PER_IMAGE_TRANSLATION,
          );
        },
        [updateStats],
      );

    // -------------------------------------------------------------------------
    // AI Tutor
    // -------------------------------------------------------------------------

    const logTutorMessage =
      React.useCallback(
        () => {
          updateStats(
            (previousStats) => ({
              tutorMessages:
                Math.min(
                  MAX_TUTOR_MESSAGES,
                  previousStats
                    .tutorMessages + 1,
                ),
            }),

            XP_PER_TUTOR_MESSAGE,
          );
        },
        [updateStats],
      );

    // -------------------------------------------------------------------------
    // Progress
    // -------------------------------------------------------------------------

    const xpForNextLevel =
      stats.level *
      XP_PER_LEVEL;

    const xpAtCurrentLevel =
      (stats.level - 1) *
      XP_PER_LEVEL;

    const currentLevelXp =
      Math.max(
        0,
        stats.xp -
          xpAtCurrentLevel,
      );

    const progressPercentage =
      Math.min(
        100,
        Math.max(
          0,
          (currentLevelXp /
            XP_PER_LEVEL) *
            100,
        ),
      );

    // -------------------------------------------------------------------------
    // Badge lists
    // -------------------------------------------------------------------------

    const unlockedBadges =
      React.useMemo(
        () =>
          badges.filter(
            (badge) =>
              stats.unlockedBadgeIds.includes(
                badge.id,
              ),
          ),
        [stats.unlockedBadgeIds],
      );

    const lockedBadges =
      React.useMemo(
        () =>
          badges.filter(
            (badge) =>
              !stats.unlockedBadgeIds.includes(
                badge.id,
              ),
          ),
        [stats.unlockedBadgeIds],
      );

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    return {
      stats,

      isLoaded,

      logTextTranslation,

      logImageTranslation,

      logTutorMessage,

      progress: {
        xpForNextLevel,
        currentLevelXp,
        progressPercentage,
      },

      unlockedBadges,

      lockedBadges,
    };
  };