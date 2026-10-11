import {
  Award,
  BookOpen,
  BookUser,
  Camera,
  Flame,
  Languages,
  Medal,
  MessageSquareQuote,
  Milestone,
  Sparkles,
  Star,
  Target,
  Trophy,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

import type { GamificationStats } from "@/hooks/use-gamification";

/**
 * ---------------------------------------------------------------------------
 * Badge System
 * ---------------------------------------------------------------------------
 *
 * This file contains the static definition of MeaningIt's achievement system.
 *
 * IMPORTANT:
 * - Badge definitions are immutable configuration.
 * - Unlock state is derived from GamificationStats.
 * - This file must NOT modify localStorage or application state.
 * - Keep unlock predicates deterministic and side-effect free.
 *
 * Adding a new badge should normally require only adding one object to
 * `badges` below.
 */

export type Badge = {
  /** Stable identifier. Never change after release. */
  readonly id: string;

  /** Human-readable badge title. */
  readonly name: string;

  /** Short explanation shown in the profile / tooltip. */
  readonly description: string;

  /** Icon displayed by the UI. */
  readonly icon: ComponentType<LucideProps>;

  /** Determines whether the badge has been earned. */
  readonly isUnlocked: (stats: GamificationStats) => boolean;
};

/**
 * ---------------------------------------------------------------------------
 * Defensive helpers
 * ---------------------------------------------------------------------------
 *
 * These helpers make badge predicates resilient if persisted gamification
 * data is ever malformed, partially migrated, or manually modified.
 */

function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function safeSetSize(value: unknown): number {
  return value instanceof Set ? value.size : 0;
}

/**
 * ---------------------------------------------------------------------------
 * Badge definitions
 * ---------------------------------------------------------------------------
 *
 * Badge progression is intentionally staggered:
 *
 * Text translations:
 *   1 → 10 → 50 → 100 → 250 → 500
 *
 * Image translations:
 *   1 → 10 → 50 → 100
 *
 * AI Tutor:
 *   1 → 10 → 50 → 100
 *
 * Languages:
 *   3 → 5 → 10 → 15
 *
 * Streak:
 *   3 → 7 → 14 → 30 → 60 → 100
 *
 * Levels:
 *   5 → 10 → 20 → 25 → 50
 *
 * The system intentionally rewards multiple types of behavior instead of
 * allowing a user to unlock everything through text translations alone.
 */
export const badges: readonly Badge[] = [
  // =========================================================================
  // TEXT TRANSLATION
  // =========================================================================

  {
    id: "first_translation",
    name: "First Step",
    description: "Complete your first text translation.",
    icon: Medal,
    isUnlocked: (stats) => safeCount(stats.translations?.text) >= 1,
  },

  {
    id: "text_translator_10",
    name: "Word Weaver",
    description: "Complete 10 text translations.",
    icon: Award,
    isUnlocked: (stats) => safeCount(stats.translations?.text) >= 10,
  },

  {
    id: "text_translator_50",
    name: "Lexicographer",
    description: "Complete 50 text translations.",
    icon: BookUser,
    isUnlocked: (stats) => safeCount(stats.translations?.text) >= 50,
  },

  {
    id: "text_translator_100",
    name: "Translation Master",
    description: "Complete 100 text translations.",
    icon: Trophy,
    isUnlocked: (stats) => safeCount(stats.translations?.text) >= 100,
  },

  {
    id: "text_translator_250",
    name: "Language Artisan",
    description: "Complete 250 text translations.",
    icon: Sparkles,
    isUnlocked: (stats) => safeCount(stats.translations?.text) >= 250,
  },

  {
    id: "text_translator_500",
    name: "Translation Legend",
    description: "Complete 500 text translations.",
    icon: Star,
    isUnlocked: (stats) => safeCount(stats.translations?.text) >= 500,
  },

  // =========================================================================
  // IMAGE TRANSLATION
  // =========================================================================

  {
    id: "first_image_translation",
    name: "Eagle Eye",
    description: "Complete your first image translation.",
    icon: Camera,
    isUnlocked: (stats) => safeCount(stats.translations?.image) >= 1,
  },

  {
    id: "image_translator_10",
    name: "Visual Explorer",
    description: "Complete 10 image translations.",
    icon: Camera,
    isUnlocked: (stats) => safeCount(stats.translations?.image) >= 10,
  },

  {
    id: "image_translator_50",
    name: "Visual Translator",
    description: "Complete 50 image translations.",
    icon: Sparkles,
    isUnlocked: (stats) => safeCount(stats.translations?.image) >= 50,
  },

  {
    id: "image_translator_100",
    name: "Vision Master",
    description: "Complete 100 image translations.",
    icon: Trophy,
    isUnlocked: (stats) => safeCount(stats.translations?.image) >= 100,
  },

  // =========================================================================
  // AI TUTOR
  // =========================================================================

  {
    id: "first_chatbot_message",
    name: "Conversation Starter",
    description: "Send your first message to the AI Tutor.",
    icon: MessageSquareQuote,
    isUnlocked: (stats) => safeCount(stats.tutorMessages) >= 1,
  },

  {
    id: "tutor_messages_10",
    name: "Curious Mind",
    description: "Send 10 messages to the AI Tutor.",
    icon: BookOpen,
    isUnlocked: (stats) => safeCount(stats.tutorMessages) >= 10,
  },

  {
    id: "tutor_messages_50",
    name: "Language Learner",
    description: "Send 50 messages to the AI Tutor.",
    icon: MessageSquareQuote,
    isUnlocked: (stats) => safeCount(stats.tutorMessages) >= 50,
  },

  {
    id: "tutor_messages_100",
    name: "Tutor Regular",
    description: "Send 100 messages to the AI Tutor.",
    icon: Milestone,
    isUnlocked: (stats) => safeCount(stats.tutorMessages) >= 100,
  },

  // =========================================================================
  // LANGUAGE EXPLORATION
  // =========================================================================

  {
    id: "polyglot_novice",
    name: "Language Explorer",
    description: "Use 3 different languages.",
    icon: Languages,
    isUnlocked: (stats) => safeSetSize(stats.languagesUsed) >= 3,
  },

  {
    id: "polyglot_intermediate",
    name: "Multilingual",
    description: "Use 5 different languages.",
    icon: Languages,
    isUnlocked: (stats) => safeSetSize(stats.languagesUsed) >= 5,
  },

  {
    id: "polyglot_pro",
    name: "Polyglot Pro",
    description: "Use 10 different languages.",
    icon: Languages,
    isUnlocked: (stats) => safeSetSize(stats.languagesUsed) >= 10,
  },

  {
    id: "polyglot_master",
    name: "Global Citizen",
    description: "Use 15 different languages.",
    icon: Languages,
    isUnlocked: (stats) => safeSetSize(stats.languagesUsed) >= 15,
  },

  // =========================================================================
  // STREAKS
  // =========================================================================

  {
    id: "streak_3_days",
    name: "On a Roll",
    description: "Maintain a 3-day translation streak.",
    icon: Flame,
    isUnlocked: (stats) => safeCount(stats.streak) >= 3,
  },

  {
    id: "streak_7_days",
    name: "Committed",
    description: "Maintain a 7-day translation streak.",
    icon: Flame,
    isUnlocked: (stats) => safeCount(stats.streak) >= 7,
  },

  {
    id: "streak_14_days",
    name: "Two-Week Streak",
    description: "Maintain a 14-day translation streak.",
    icon: Flame,
    isUnlocked: (stats) => safeCount(stats.streak) >= 14,
  },

  {
    id: "streak_30_days",
    name: "Monthly Master",
    description: "Maintain a 30-day translation streak.",
    icon: Target,
    isUnlocked: (stats) => safeCount(stats.streak) >= 30,
  },

  {
    id: "streak_60_days",
    name: "Unstoppable",
    description: "Maintain a 60-day translation streak.",
    icon: Zap,
    isUnlocked: (stats) => safeCount(stats.streak) >= 60,
  },

  {
    id: "streak_100_days",
    name: "Century Streak",
    description: "Maintain a 100-day translation streak.",
    icon: Trophy,
    isUnlocked: (stats) => safeCount(stats.streak) >= 100,
  },

  // =========================================================================
  // LEVEL PROGRESSION
  // =========================================================================

  {
    id: "level_up_5",
    name: "Rising Star",
    description: "Reach level 5.",
    icon: TrendingUp,
    isUnlocked: (stats) => safeCount(stats.level) >= 5,
  },

  {
    id: "level_up_10",
    name: "Level 10",
    description: "Reach level 10.",
    icon: TrendingUp,
    isUnlocked: (stats) => safeCount(stats.level) >= 10,
  },

  {
    id: "level_up_20",
    name: "Veteran Translator",
    description: "Reach level 20.",
    icon: Award,
    isUnlocked: (stats) => safeCount(stats.level) >= 20,
  },

  {
    id: "level_up_25",
    name: "Elite Translator",
    description: "Reach level 25.",
    icon: Milestone,
    isUnlocked: (stats) => safeCount(stats.level) >= 25,
  },

  {
    id: "level_up_50",
    name: "MeaningIt Legend",
    description: "Reach level 50.",
    icon: Trophy,
    isUnlocked: (stats) => safeCount(stats.level) >= 50,
  },
];

/**
 * ---------------------------------------------------------------------------
 * Badge lookup helpers
 * ---------------------------------------------------------------------------
 *
 * These helpers are optional but useful as the application grows.
 * They keep badge lookup logic centralized instead of scattering `.find()`
 * and `.filter()` calls throughout components.
 */

/**
 * Find a badge by its stable ID.
 */
export function getBadgeById(id: string): Badge | undefined {
  return badges.find((badge) => badge.id === id);
}

/**
 * Return all badges currently unlocked by a user.
 */
export function getUnlockedBadges(stats: GamificationStats): Badge[] {
  return badges.filter((badge) => badge.isUnlocked(stats));
}

/**
 * Return all badges still locked for a user.
 */
export function getLockedBadges(stats: GamificationStats): Badge[] {
  return badges.filter((badge) => !badge.isUnlocked(stats));
}

/**
 * Check whether a specific badge is unlocked.
 */
export function isBadgeUnlocked(
  badgeId: string,
  stats: GamificationStats,
): boolean {
  const badge = getBadgeById(badgeId);

  return badge?.isUnlocked(stats) ?? false;
}

/**
 * Return the total number of currently unlocked badges.
 */
export function getUnlockedBadgeCount(stats: GamificationStats): number {
  return badges.reduce(
    (count, badge) => count + (badge.isUnlocked(stats) ? 1 : 0),
    0,
  );
}

/**
 * Return the completion percentage of the badge collection.
 */
export function getBadgeCompletionPercentage(
  stats: GamificationStats,
): number {
  if (badges.length === 0) {
    return 0;
  }

  const unlockedCount = getUnlockedBadgeCount(stats);

  return Math.round((unlockedCount / badges.length) * 100);
}

/**
 * ---------------------------------------------------------------------------
 * Internal icon
 * ---------------------------------------------------------------------------
 *
 * Kept local so the public Badge API remains unchanged.
 */

