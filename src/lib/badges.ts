import { Medal, MessageSquareQuote, Camera, Languages, Flame, TrendingUp, Award } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { GamificationStats } from '@/hooks/use-gamification';

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<LucideProps>;
  isUnlocked: (stats: GamificationStats) => boolean;
};

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
    icon: Award,
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
