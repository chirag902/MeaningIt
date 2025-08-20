'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const prevStatsRef = useRef<GamificationStats>();

  // Load stats from localStorage on initial mount
  useEffect(() => {
    try {
      const savedStatsRaw = localStorage.getItem('gamificationStats');
      if (savedStatsRaw) {
        const savedStats = JSON.parse(savedStatsRaw);
        const newStats = {
          ...getInitialStats(),
          ...savedStats,
          languagesUsed: new Set(savedStats.languagesUsed || []),
        };
        setStats(newStats);
        prevStatsRef.current = newStats;
      } else {
        prevStatsRef.current = getInitialStats();
      }
    } catch (error) {
      console.error("Failed to load gamification stats from localStorage", error);
    }
  }, []);
  
  // This effect handles firing toasts AFTER state has been updated
  useEffect(() => {
    const prevStats = prevStatsRef.current;
    if (!prevStats) {
        prevStatsRef.current = stats;
        return;
    }
    
    // Check for level up toasts
    if (stats.level > prevStats.level) {
        toast({ title: 'Level Up!', description: `Congratulations, you've reached Level ${stats.level}!` });
    }

    // Check for streak toasts
    if (stats.streak > prevStats.streak && stats.streak > 1) {
        toast({ title: 'Streak Continued!', description: `You're on a ${stats.streak}-day streak! +${XP_FOR_STREAK} XP` });
    }

    // Check for badge toasts
    if (stats.unlockedBadgeIds.length > prevStats.unlockedBadgeIds.length) {
        const newBadgeIds = stats.unlockedBadgeIds.filter(id => !prevStats.unlockedBadgeIds.includes(id));
        const newBadges = badges.filter(b => newBadgeIds.includes(b.id));

        newBadges.forEach(badge => {
            const BadgeIcon = badge.icon;
            // Don't double-toast for level up badge
            if (badge.id === 'level_up') return;

            toast({
                title: 'Badge Unlocked!',
                description: React.createElement(
                    'div', { className: "flex items-center gap-2" },
                    React.createElement(BadgeIcon, { className: "h-5 w-5 text-amber-500" }),
                    React.createElement('span', { className: "font-semibold" }, badge.name)
                )
            });
        });
    }

    // Update ref for next render
    prevStatsRef.current = stats;
  }, [stats, toast]);

  // Save stats to localStorage whenever they change
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
  
  const checkForNewBadges = useCallback((currentStats: GamificationStats): Badge[] => {
    return badges.filter(badge => 
        !currentStats.unlockedBadgeIds.includes(badge.id) && badge.isUnlocked(currentStats)
    );
  }, []);
  
  const updateStats = useCallback((updateFn: (prevStats: GamificationStats) => Partial<GamificationStats>, xpGained: number) => {
    setStats(prevStats => {
        // --- Streak Logic ---
        const today = new Date();
        const lastUsed = prevStats.lastUsedDate ? new Date(prevStats.lastUsedDate) : null;
        let streakBonusXp = 0;
        let newStreak = prevStats.streak;

        if (!lastUsed || !isSameDay(today, lastUsed)) {
            // This is the first action of the day
            if (lastUsed && isYesterday(today, lastUsed)) {
                newStreak++; // Continue streak
                streakBonusXp = XP_FOR_STREAK;
            } else {
                newStreak = 1; // Reset or first time
            }
        }
        // --- End Streak Logic ---
        
        const updates = updateFn(prevStats);
        const totalXpGained = xpGained + streakBonusXp;
        const xp = prevStats.xp + totalXpGained;
        const level = Math.floor(xp / XP_PER_LEVEL) + 1;
        
        let newStats: GamificationStats = { 
            ...prevStats, 
            ...updates, 
            xp, 
            level,
            streak: newStreak,
            lastUsedDate: today.toISOString(), // Always update last used date on any action
        };
        
        const newBadges = checkForNewBadges(newStats);
        if (newBadges.length > 0) {
            const newBadgeIds = newBadges.map(b => b.id);
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
