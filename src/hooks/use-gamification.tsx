
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
  const [stats, setStats] = useState<GamificationStats>(() => getInitialStats());
  const { toast } = useToast();
  // Ref to store the previous stats to compare against for toasts
  const prevStatsRef = useRef<GamificationStats>();
  const isInitialLoad = useRef(true);


  // Load stats from localStorage on initial mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const savedStatsRaw = localStorage.getItem('gamificationStats');
      if (savedStatsRaw) {
        const savedStats = JSON.parse(savedStatsRaw);
        // Create a full stats object, falling back to defaults if properties are missing
        const loadedStats: GamificationStats = {
          ...getInitialStats(), // Start with defaults
          ...savedStats,         // Override with saved values
          languagesUsed: new Set(savedStats.languagesUsed || []), // Ensure languagesUsed is a Set
        };
        setStats(loadedStats);
      }
    } catch (error) {
      console.error("Failed to load gamification stats from localStorage", error);
      setStats(getInitialStats()); // Reset to default if loading fails
    }
  }, []);

  // Effect for saving stats to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Don't save on the very first render cycle before stats are loaded.
    if (isInitialLoad.current) {
        // Check if the loaded stats are different from the absolute initial state.
        // If they are, it means we have successfully loaded from storage.
        if (JSON.stringify(stats) !== JSON.stringify(getInitialStats())) {
            isInitialLoad.current = false;
        }
        return;
    }
    
    try {
      const statsToSave = {
        ...stats,
        languagesUsed: Array.from(stats.languagesUsed), // Convert Set to Array for JSON
      };
      localStorage.setItem('gamificationStats', JSON.stringify(statsToSave));
    } catch (error) {
      console.error("Failed to save gamification stats to localStorage", error);
    }
  }, [stats]);


  // Effect for firing toasts when stats change
  useEffect(() => {
      const prevStats = prevStatsRef.current;
      // Only run if we have previous stats to compare to
      if (!prevStats) {
          prevStatsRef.current = stats; // Set initial ref value
          return;
      }

      // 1. Level Up Toast
      if (stats.level > prevStats.level) {
          toast({ 
              title: 'Level Up!', 
              description: `Congratulations, you've reached Level ${stats.level}!` 
          });
      }

      // 2. Streak Toast
      if (stats.streak > prevStats.streak && stats.streak > 1) {
          toast({ 
              title: 'Streak Continued!', 
              description: `You're on a ${stats.streak}-day streak! +${XP_FOR_STREAK} XP` 
          });
      }

      // 3. Badge Unlocked Toast
      if (stats.unlockedBadgeIds.length > prevStats.unlockedBadgeIds.length) {
          const newBadgeIds = stats.unlockedBadgeIds.filter(id => !prevStats.unlockedBadgeIds.includes(id));
          const newBadges = badges.filter(b => newBadgeIds.includes(b.id));

          newBadges.forEach(badge => {
              // Avoid a "Level Up!" toast and a "Level 5!" badge toast at the same time
              if (badge.id.startsWith('level_up') && stats.level > prevStats.level) return;

              const BadgeIcon = badge.icon;
              toast({
                  title: 'Badge Unlocked!',
                  description: (
                      <div className="flex items-center gap-2">
                          <BadgeIcon className="h-5 w-5 text-amber-500" />
                          <span className="font-semibold">{badge.name}</span>
                      </div>
                  )
              });
          });
      }

      // Update ref for the next render
      prevStatsRef.current = stats;
  }, [stats, toast]);


  const updateStats = useCallback((updateFn: (currentStats: GamificationStats) => Partial<GamificationStats>, xpGained: number) => {
    setStats(currentStats => {
        // Store the state BEFORE any changes
        const prevStats = { ...currentStats };
        
        let newStats = { ...currentStats };

        // --- Streak Logic ---
        const today = new Date();
        const lastUsed = newStats.lastUsedDate ? new Date(newStats.lastUsedDate) : null;
        let streakBonusXp = 0;

        if (!lastUsed || !isSameDay(today, lastUsed)) {
            // First action of a new day
            if (lastUsed && isYesterday(today, lastUsed)) {
                newStats.streak++; // Continue streak
                streakBonusXp = XP_FOR_STREAK;
            } else {
                newStats.streak = 1; // Reset or start streak
            }
            newStats.lastUsedDate = today.toISOString();
        }
        // --- End Streak Logic ---
        
        // Apply the specific updates from the action (e.g., incrementing translation count)
        const updates = updateFn(newStats);
        newStats = { ...newStats, ...updates };

        // --- XP and Level Logic ---
        const totalXpGained = xpGained + streakBonusXp;
        newStats.xp += totalXpGained;
        newStats.level = Math.floor(newStats.xp / XP_PER_LEVEL) + 1;
        
        // --- Badge Logic ---
        const newlyUnlockedBadges = badges.filter(badge => 
            !newStats.unlockedBadgeIds.includes(badge.id) && badge.isUnlocked(newStats)
        );
        
        if (newlyUnlockedBadges.length > 0) {
            const newBadgeIds = newlyUnlockedBadges.map(b => b.id);
            newStats.unlockedBadgeIds = [...newStats.unlockedBadgeIds, ...newBadgeIds];
        }

        // Return the final, updated state
        return newStats;
    });
  }, []);

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
