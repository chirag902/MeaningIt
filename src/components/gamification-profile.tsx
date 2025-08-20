'use client';

import * as React from 'react';
import { useGamification, XP_PER_LEVEL } from '@/hooks/use-gamification';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Progress } from './ui/progress';
import { Flame, Star, Languages, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

export const GamificationProfile = React.memo(function GamificationProfile() {
  const { stats, progress, unlockedBadges, lockedBadges } = useGamification();

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-primary/10 to-accent/10 backdrop-blur-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
               <div className="relative">
                  <TrendingUp className="h-12 w-12 text-primary" />
                  <span className="absolute -bottom-1 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-sm border-2 border-background">{stats.level}</span>
               </div>
               <div>
                  <CardTitle>Level {stats.level}</CardTitle>
                  <CardDescription>Your Progress</CardDescription>
               </div>
            </div>
            <Badge variant="secondary" className="text-lg py-1 px-4">{stats.xp} XP</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground w-12 text-center">Lvl {stats.level}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Progress value={progress.progressPercentage} className="flex-1" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{progress.currentLevelXp} / {XP_PER_LEVEL} XP to next level</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-sm font-medium text-muted-foreground w-12 text-center">Lvl {stats.level + 1}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4 text-center">
        <Card className="bg-card/60 backdrop-blur-sm border-0">
          <CardHeader className="items-center pb-2">
            <Flame className="h-8 w-8 text-orange-500" />
            <CardTitle className="text-2xl">{stats.streak}</CardTitle>
            <CardDescription>Day Streak</CardDescription>
          </CardHeader>
        </Card>
        <Card className="bg-card/60 backdrop-blur-sm border-0">
          <CardHeader className="items-center pb-2">
            <Languages className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl">{stats.languagesUsed.size}</CardTitle>
            <CardDescription>Languages Used</CardDescription>
          </CardHeader>
        </Card>
        <Card className="bg-card/60 backdrop-blur-sm border-0">
          <CardHeader className="items-center pb-2">
            <Star className="h-8 w-8 text-amber-500" />
            <CardTitle className="text-2xl">{unlockedBadges.length}/{badges.length}</CardTitle>
            <CardDescription>Badges Unlocked</CardDescription>
          </CardHeader>
        </Card>
      </div>
      
      <Card className="bg-card/60 backdrop-blur-sm border-0">
          <CardHeader>
              <CardTitle>Badge Collection</CardTitle>
              <CardDescription>Flex your achievements!</CardDescription>
          </CardHeader>
          <CardContent>
              <h3 className="font-semibold mb-4 text-primary">Unlocked</h3>
              {unlockedBadges.length > 0 ? (
                <div className="flex flex-wrap gap-4">
                  {unlockedBadges.map(badge => {
                      const BadgeIcon = badge.icon;
                      return (
                          <TooltipProvider key={badge.id}>
                              <Tooltip>
                                  <TooltipTrigger>
                                      <div className="flex flex-col items-center justify-center gap-2 p-3 w-28 h-28 border rounded-lg bg-amber-500/10 border-amber-500/30">
                                          <BadgeIcon className="h-10 w-10 text-amber-500" />
                                          <p className="text-xs font-semibold text-center">{badge.name}</p>
                                      </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                      <p>{badge.description}</p>
                                  </TooltipContent>
                              </Tooltip>
                          </TooltipProvider>
                      )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Start translating to earn badges!</p>
              )}
              
              {lockedBadges.length > 0 && <Separator className="my-6" />}

              {lockedBadges.length > 0 && <h3 className="font-semibold mb-4 text-muted-foreground">Locked</h3>}
               <div className="flex flex-wrap gap-4">
                  {lockedBadges.map(badge => {
                      const BadgeIcon = badge.icon;
                      return (
                          <TooltipProvider key={badge.id}>
                              <Tooltip>
                                  <TooltipTrigger>
                                      <div className="flex flex-col items-center justify-center gap-2 p-3 w-28 h-28 border rounded-lg bg-muted/50 filter grayscale opacity-60">
                                          <BadgeIcon className="h-10 w-10 text-muted-foreground" />
                                          <p className="text-xs font-semibold text-center">{badge.name}</p>
                                      </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                      <p>{badge.description}</p>
                                  </TooltipContent>
                              </Tooltip>
                          </TooltipProvider>
                      )
                  })}
                </div>
          </CardContent>
      </Card>
    </div>
  );
});
