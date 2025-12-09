
'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import type { LucideIcon } from 'lucide-react';
import { Award, Flame, Star, Languages, Camera, Medal, MessageSquareQuote, TrendingUp, BookUser } from 'lucide-react';

// ---- Types & Constants ----

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


export const XP_PER_LEVEL = 100;
const XP_FOR_STREAK = 10;
const XP_PER_TEXT_TRANSLATION = 5;
const XP_PER_IMAGE_TRANSLATION = 8;
const XP_PER_TUTOR_MESSAGE = 3;


export const badges: Badge[] = [
    {
      id: 'first_translation',
      name: 'First Step',
      description: 'Completed your first text translation.',
      icon: Medal,
      isUnlocked: (stats) => stats.translations.text >= 1,
    },
    {
      id: 'text_translator_10',
      name: 'Word Weaver',
      description: 'Completed 10 text translations.',
      icon: Award,
      isUnlocked: (stats) => stats.translations.text >= 10,
    },
    {
      id: 'text_translator_50',
      name: 'Lexicographer',
      description: 'Completed 50 text translations.',
      icon: BookUser,
      isUnlocked: (stats) => stats.translations.text >= 50,
    },
    {
      id: 'first_image_translation',
      name: 'Eagle Eye',
      description: 'Completed your first image translation.',
      icon: Camera,
      isUnlocked: (stats) => stats.translations.image >= 1,
    },
    {
      id: 'first_chatbot_message',
      name: 'Conversation Starter',
      description: 'Sent your first message to the AI Tutor.',
      icon: MessageSquareQuote,
      isUnlocked: (stats) => stats.tutorMessages >= 1,
    },
    {
      id: 'polyglot_novice',
      name: 'Language Explorer',
      description: 'Translated into 3 different languages.',
      icon: Languages,
      isUnlocked: (stats) => stats.languagesUsed.size >= 3,
    },
    {
      id: 'polyglot_pro',
      name: 'Polyglot Pro',
      description: 'Translated into 10 different languages.',
      icon: Languages,
      isUnlocked: (stats) => stats.languagesUsed.size >= 10,
    },
    {
      id: 'streak_3_days',
      name: 'On a Roll',
      description: 'Maintained a 3-day streak.',
      icon: Flame,
      isUnlocked: (stats) => stats.streak >= 3,
    },
    {
      id: 'streak_7_days',
      name: 'Committed',
      description: 'Maintained a 7-day streak.',
      icon: Flame,
      isUnlocked: (stats) => stats.streak >= 7,
    },
    {
      id: 'level_up_5',
      name: 'Level 5!',
      description: 'Reached level 5.',
      icon: TrendingUp,
      isUnlocked: (stats) => stats.level >= 5,
    },
      {
      id: 'level_up_10',
      name: 'Level 10!',
      description: 'Reached level 10.',
      icon: TrendingUp,
      isUnlocked: (stats) => stats.level >= 10,
    },
  ];

// ---- Date helpers ----

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(today: Date, other: Date): boolean {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  return isSameDay(yesterday, other);
}


// ---- Hook ----
const GAMIFICATION_STORAGE_KEY = 'meaningit_gamification_stats';

export const useGamification = () => {
  const { toast } = useToast();

  const [stats, setStats] = React.useState<GamificationStats>({
    level: 1,
    xp: 0,
    streak: 0,
    lastUsedDate: null,
    translations: { text: 0, image: 0 },
    tutorMessages: 0,
    languagesUsed: new Set<string>(),
    unlockedBadgeIds: [],
  });
  const [isLoaded, setIsLoaded] = React.useState(false);
  const prevStatsRef = React.useRef<GamificationStats>(stats);


  // Load from localStorage on mount
  React.useEffect(() => {
    try {
      const savedStatsRaw = localStorage.getItem(GAMIFICATION_STORAGE_KEY);
      if (savedStatsRaw) {
        const savedStats = JSON.parse(savedStatsRaw);
        // Revive the Set from the stored array
        savedStats.languagesUsed = new Set(savedStats.languagesUsed || []);
        setStats(savedStats);
        prevStatsRef.current = savedStats;
      }
    } catch (error) {
      console.error('Failed to load gamification stats:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever stats change
  React.useEffect(() => {
    if (!isLoaded) return; // Don't save on initial load
    try {
      // Convert Set to array for JSON serialization
      const storableStats = {
        ...stats,
        languagesUsed: Array.from(stats.languagesUsed),
      };
      localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(storableStats));
    } catch (error) {
      console.error('Failed to save gamification stats:', error);
    }
  }, [stats, isLoaded]);

  // Watch for level-ups and newly unlocked badges
  React.useEffect(() => {
    if (!isLoaded) return;

    const prevStats = prevStatsRef.current;

    // 1. Level up toast
    if (stats.level > prevStats.level) {
      toast({
        title: `Level Up! You've reached Level ${stats.level}!`,
        description: 'Keep up the great work!',
      });
    }
    
    // 2. Streak Toast
    if (stats.streak > 0 && stats.streak > prevStats.streak) {
         toast({
            title: `Streak Continued: ${stats.streak} Days!`,
            description: `You earned ${XP_FOR_STREAK} bonus XP!`,
         });
    }

    // 3. Badge Unlocked Toast
    const newBadgeIds = stats.unlockedBadgeIds.filter(
      (id) => !prevStats.unlockedBadgeIds.includes(id)
    );

    if (newBadgeIds.length > 0) {
      const newBadges = badges.filter((b) => newBadgeIds.includes(b.id));
      newBadges.forEach((badge) => {
        const BadgeIcon = badge.icon;
        toast({
          title: 'Badge Unlocked!',
          description: (
              <div className="flex items-center gap-2">
                  <BadgeIcon className="h-5 w-5 text-amber-500" />
                  <span className="font-semibold">{badge.name}</span>
              </div>
          ),
        });
      });
    }


    // Update ref for next render
    prevStatsRef.current = stats;
  }, [stats, toast, isLoaded]);

  // Core stats update helper
  const updateStats = React.useCallback(
    (
      updateFn: (currentStats: GamificationStats) => Partial<GamificationStats>,
      xpGained: number
    ) => {
      setStats((currentStats) => {
        let newStats: GamificationStats = {
          ...currentStats,
          languagesUsed: new Set(currentStats.languagesUsed),
          unlockedBadgeIds: [...currentStats.unlockedBadgeIds],
          translations: { ...currentStats.translations },
        };

        const today = new Date();
        const lastUsed = newStats.lastUsedDate ? new Date(newStats.lastUsedDate) : null;
        let streakBonusXp = 0;

        if (!lastUsed || !isSameDay(today, lastUsed)) {
          if (lastUsed && isYesterday(today, lastUsed)) {
            newStats.streak++;
            streakBonusXp = XP_FOR_STREAK;
          } else if (lastUsed) {
            newStats.streak = 1;
          } else {
             newStats.streak = 1;
          }
          newStats.lastUsedDate = today.toISOString();
        }

        const updates = updateFn(newStats);
        newStats = { ...newStats, ...updates };

        const totalXpGained = xpGained + streakBonusXp;
        if (totalXpGained > 0) {
          newStats.xp += totalXpGained;
          newStats.level = Math.floor(newStats.xp / XP_PER_LEVEL) + 1;
        }
        
        const newlyUnlockedBadges = badges.filter(
          (badge) =>
            !newStats.unlockedBadgeIds.includes(badge.id) && badge.isUnlocked(newStats)
        );

        if (newlyUnlockedBadges.length > 0) {
          newStats.unlockedBadgeIds.push(...newlyUnlockedBadges.map((b) => b.id));
        }

        return newStats;
      });
    },
    []
  );


  const logTextTranslation = React.useCallback(
    (targetLang: string) => {
      updateStats(
        (prev) => ({
          translations: {
            ...prev.translations,
            text: prev.translations.text + 1,
          },
          languagesUsed: prev.languagesUsed.add(targetLang),
        }),
        XP_PER_TEXT_TRANSLATION
      );
    },
    [updateStats]
  );

  const logImageTranslation = React.useCallback(() => {
    updateStats(
      (prev) => ({
        translations: {
          ...prev.translations,
          image: prev.translations.image + 1,
        },
      }),
      XP_PER_IMAGE_TRANSLATION
    );
  }, [updateStats]);

  const logTutorMessage = React.useCallback(() => {
    updateStats(
      (prev) => ({
        tutorMessages: prev.tutorMessages + 1,
      }),
      XP_PER_TUTOR_MESSAGE
    );
  }, [updateStats]);

  const xpForNextLevel = stats.level * XP_PER_LEVEL;
  const currentLevelXp = stats.xp - (stats.level - 1) * XP_PER_LEVEL;
  const progressPercentage = (currentLevelXp / XP_PER_LEVEL) * 100;

  const unlockedBadges = React.useMemo(() => badges.filter((b) => stats.unlockedBadgeIds.includes(b.id)), [stats.unlockedBadgeIds]);
  const lockedBadges = React.useMemo(() => badges.filter((b) => !stats.unlockedBadgeIds.includes(b.id)), [stats.unlockedBadgeIds]);

  return {
    stats,
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
