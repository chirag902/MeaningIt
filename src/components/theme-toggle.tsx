'use client';

import * as React from 'react';
import { Check, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const;

function OptionIcon({ value }: { value: (typeof OPTIONS)[number]['value'] }) {
  if (value === 'light') return <Sun aria-hidden="true" className="mr-2 h-4 w-4" />;
  if (value === 'dark') return <Moon aria-hidden="true" className="mr-2 h-4 w-4" />;

  return (
    <span
      aria-hidden="true"
      className="mr-2 flex h-4 w-4 items-center justify-center text-xs font-semibold"
    >
      ◐
    </span>
  );
}

export function ThemeToggle() {
  // Reading `theme` here is hydration-safe: Radix doesn't render the menu
  // content until it is opened, which only happens after hydration.
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-10 w-10 rounded-full border-border/60 bg-background/80 shadow-sm transition-colors duration-200 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
          aria-label="Change theme"
        >
          {/* Icons swap with CSS only (dark: variants), so there is no flash. */}
          <Sun
            aria-hidden="true"
            className="h-[1.15rem] w-[1.15rem] rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0"
          />

          <Moon
            aria-hidden="true"
            className="absolute h-[1.15rem] w-[1.15rem] rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="min-w-[140px]">
        {OPTIONS.map((option) => {
          const selected = theme === option.value;

          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value)}
              aria-current={selected ? 'true' : undefined}
            >
              <OptionIcon value={option.value} />
              {option.label}
              {selected && <Check aria-hidden="true" className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}