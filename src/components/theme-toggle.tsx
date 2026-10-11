"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  const handleLightTheme = React.useCallback(() => {
    setTheme("light");
  }, [setTheme]);

  const handleDarkTheme = React.useCallback(() => {
    setTheme("dark");
  }, [setTheme]);

  const handleSystemTheme = React.useCallback(() => {
    setTheme("system");
  }, [setTheme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-10 w-10 rounded-full border-border/60 bg-background/80 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-primary/40 hover:bg-accent hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
          aria-label="Change theme"
        >
          <Sun
            aria-hidden="true"
            className="h-[1.15rem] w-[1.15rem] rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0"
          />

          <Moon
            aria-hidden="true"
            className="absolute h-[1.15rem] w-[1.15rem] rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100"
          />

          <span className="sr-only">Change theme</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-[140px]"
      >
        <DropdownMenuItem onClick={handleLightTheme}>
          <Sun
            aria-hidden="true"
            className="mr-2 h-4 w-4"
          />
          Light
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleDarkTheme}>
          <Moon
            aria-hidden="true"
            className="mr-2 h-4 w-4"
          />
          Dark
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleSystemTheme}>
          <span
            aria-hidden="true"
            className="mr-2 flex h-4 w-4 items-center justify-center text-xs font-semibold"
          >
            ◐
          </span>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}