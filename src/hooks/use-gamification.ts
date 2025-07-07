'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { badges, type Badge } from '@/lib/badges';
import { useToast } from './use-toast';

const XP_PER_TEXT_TRANSLATION = 10;
const XP_PER_IMAGE_TRANSLATION = 25;
const XP_PER_TUTOR_MESSAGE = 5;
const XP_FOR_STREAK = 50;
export const XP_PER_LEVEL = 100;

export interface GamificationStats {
  xp: number;
  level: number;
  streak: number;
  lastUsedDate: string | null;
  unlockedBadgeIds: string[];
  translations: {
    text: number;
    image: number;
  };
  tutorMessages: number;
  languagesUsed: Set<string>;
}

const isSameDay = (date1: Date, date2: Date) => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

const isYesterday = (date1: Date, date2: Date) => {
    const yesterday = new Date(date1);
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameDay(yesterday, date2);
}

const getInitialStats = (): GamificationStats => ({
  xp: 0,
  level: 1,
  streak: 0,
  lastUsedDate: null,
  unlockedBadgeIds: [],
  translations: { text: 0, image: 0 },
  tutorMessages: 0,
  languagesUsed: new Set(),
});

export const useGamification = () => {
  const [stats, setStats] = useState<GamificationStats>(getInitialStats());
  const { toast } = useToast();

  useEffect(() => {
    try {
      const savedStatsRaw = localStorage.getItem('gamificationStats');
      if (savedStatsRaw) {
        const savedStats = JSON.parse(savedStatsRaw);
        setStats({
          ...getInitialStats(),
          ...savedStats,
          languagesUsed: new Set(savedStats.languagesUsed || []),
        });
      }
    } catch (error) {
      console.error("Failed to load gamification stats from localStorage", error);
    }
  }, []);
  
  const checkStreak = useCallback(() => {
    setStats(prevStats => {
      const today = new Date();
      const lastUsed = prevStats.lastUsedDate ? new Date(prevStats.lastUsedDate) : null;
      let newStreak = prevStats.streak;
      let newXp = prevStats.xp;

      if (lastUsed) {
        if (!isSameDay(today, lastUsed)) {
          if (isYesterday(today, lastUsed)) {
            newStreak++;
            newXp += XP_FOR_STREAK;
            toast({ title: 'Streak Continued!', description: `You're on a ${newStreak}-day streak! +${XP_FOR_STREAK} XP` });
          } else {
            newStreak = 1; // Reset streak if they missed a day
          }
        }
        // If it's the same day, do nothing.
      } else {
        newStreak = 1; // First time using the app
      }
      
      return { ...prevStats, streak: newStreak, xp: newXp, lastUsedDate: today.toISOString() };
    });
  }, [toast]);
  
  useEffect(() => {
    // We only want to check the streak once on initial load.
    checkStreak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    try {
      const statsToSave = {
        ...stats,
        languagesUsed: Array.from(stats.languagesUsed),
      };
      localStorage.setItem('gamificationStats', JSON.stringify(statsToSave));
    } catch (error) {
      console.error("Failed to save gamification stats to localStorage", error);
    }
  }, [stats]);

  const checkForNewBadges = useCallback((currentStats: GamificationStats) => {
    const newlyUnlocked: Badge[] = [];
    badges.forEach(badge => {
      if (!currentStats.unlockedBadgeIds.includes(badge.id) && badge.isUnlocked(currentStats)) {
        newlyUnlocked.push(badge);
      }
    });

    if (newlyUnlocked.length > 0) {
      newlyUnlocked.forEach(badge => {
          const BadgeIcon = badge.icon;
          toast({
              title: 'Badge Unlocked!',
              description: React.createElement(
                  'div',
                  { className: "flex items-center gap-2" },
                  React.createElement(BadgeIcon, { className: "h-5 w-5 text-amber-500" }),
                  React.createElement('span', { className: "font-semibold" }, badge.name)
              )
          });
      });
      return newlyUnlocked.map(b => b.id);
    }
    return [];
  }, [toast]);
  
  const updateStats = useCallback((updateFn: (prevStats: GamificationStats) => Partial<GamificationStats>, xpGained: number) => {
    setStats(prevStats => {
        const updates = updateFn(prevStats);
        const xp = prevStats.xp + xpGained;
        const level = Math.floor(xp / XP_PER_LEVEL) + 1;
        
        const newStats: GamificationStats = { ...prevStats, ...updates, xp, level };
        
        const newBadgeIds = checkForNewBadges(newStats);
        if (newBadgeIds.length > 0) {
            newStats.unlockedBadgeIds = [...newStats.unlockedBadgeIds, ...newBadgeIds];
        }

        return newStats;
    });
  }, [checkForNewBadges]);


  const logTextTranslation = useCallback((targetLang: string) => {
    updateStats(prev => ({
      translations: { ...prev.translations, text: prev.translations.text + 1 },
      languagesUsed: new Set([...Array.from(prev.languagesUsed), targetLang]),
    }), XP_PER_TEXT_TRANSLATION);
  }, [updateStats]);

  const logImageTranslation = useCallback(() => {
     updateStats(prev => ({
      translations: { ...prev.translations, image: prev.translations.image + 1 },
    }), XP_PER_IMAGE_TRANSLATION);
  }, [updateStats]);

  const logTutorMessage = useCallback(() => {
     updateStats(prev => ({
      tutorMessages: prev.tutorMessages + 1,
    }), XP_PER_TUTOR_MESSAGE);
  }, [updateStats]);
  
  const xpForNextLevel = stats.level * XP_PER_LEVEL;
  const currentLevelXp = stats.xp - ((stats.level - 1) * XP_PER_LEVEL);
  const progressPercentage = (currentLevelXp / XP_PER_LEVEL) * 100;
  
  const unlockedBadges = badges.filter(b => stats.unlockedBadgeIds.includes(b.id));
  const lockedBadges = badges.filter(b => !stats.unlockedBadgeIds.includes(b.id));

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
