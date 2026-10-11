import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],

  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
        xl: '2rem',
        '2xl': '2.5rem',
      },
      screens: {
        '2xl': '1400px',
      },
    },

    extend: {
      /*
       * ------------------------------------------------------------------
       * Typography
       * ------------------------------------------------------------------
       */
      fontFamily: {
        sans: [
          'var(--font-sans)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        display: [
          'var(--font-sans)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        code: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },

      /*
       * ------------------------------------------------------------------
       * Application design tokens
       *
       * These map directly to CSS variables defined by your global
       * stylesheet and preserve compatibility with your existing
       * shadcn-style components.
       * ------------------------------------------------------------------
       */
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },

        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },

        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },

        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },

        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },

        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },

        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        /*
         * Charts
         */
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },

        /*
         * Sidebar
         */
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',

          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground':
            'hsl(var(--sidebar-primary-foreground))',

          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground':
            'hsl(var(--sidebar-accent-foreground))',

          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },

      /*
       * ------------------------------------------------------------------
       * Border radius
       * ------------------------------------------------------------------
       */
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      /*
       * ------------------------------------------------------------------
       * Shadows
       *
       * Subtle elevation system for cards, modals and interactive UI.
       * ------------------------------------------------------------------
       */
      boxShadow: {
        soft: '0 2px 12px hsl(var(--foreground) / 0.05)',
        card: '0 8px 30px hsl(var(--foreground) / 0.08)',
        elevated:
          '0 16px 40px hsl(var(--foreground) / 0.10)',
        glow:
          '0 0 30px hsl(var(--primary) / 0.20)',
      },

      /*
       * ------------------------------------------------------------------
       * Animations
       * ------------------------------------------------------------------
       */
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },

        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },

        wave: {
          '0%, 100%': {
            transform: 'scaleY(0.5)',
          },
          '50%': {
            transform: 'scaleY(1.5)',
          },
        },

        /*
         * Small entrance animation for polished UI transitions.
         */
        'fade-in': {
          from: {
            opacity: '0',
          },
          to: {
            opacity: '1',
          },
        },

        'fade-out': {
          from: {
            opacity: '1',
          },
          to: {
            opacity: '0',
          },
        },

        'slide-up': {
          from: {
            opacity: '0',
            transform: 'translateY(8px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },

        'slide-down': {
          from: {
            opacity: '0',
            transform: 'translateY(-8px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },

        'scale-in': {
          from: {
            opacity: '0',
            transform: 'scale(0.96)',
          },
          to: {
            opacity: '1',
            transform: 'scale(1)',
          },
        },

        /*
         * Useful for your voice/live translator UI.
         */
        'pulse-soft': {
          '0%, 100%': {
            opacity: '1',
          },
          '50%': {
            opacity: '0.65',
          },
        },

        /*
         * Subtle loading shimmer.
         */
        shimmer: {
          '0%': {
            backgroundPosition: '-200% 0',
          },
          '100%': {
            backgroundPosition: '200% 0',
          },
        },

        /*
         * Voice activity indicator.
         */
        'voice-pulse': {
          '0%, 100%': {
            transform: 'scale(1)',
            opacity: '0.75',
          },
          '50%': {
            transform: 'scale(1.08)',
            opacity: '1',
          },
        },
      },

      animation: {
        'accordion-down':
          'accordion-down 0.2s ease-out',

        'accordion-up':
          'accordion-up 0.2s ease-out',

        wave:
          'wave 1.2s ease-in-out infinite',

        'fade-in':
          'fade-in 0.2s ease-out',

        'fade-out':
          'fade-out 0.2s ease-in',

        'slide-up':
          'slide-up 0.25s ease-out',

        'slide-down':
          'slide-down 0.25s ease-out',

        'scale-in':
          'scale-in 0.2s ease-out',

        'pulse-soft':
          'pulse-soft 2s ease-in-out infinite',

        shimmer:
          'shimmer 2s linear infinite',

        'voice-pulse':
          'voice-pulse 1.5s ease-in-out infinite',
      },

      /*
       * ------------------------------------------------------------------
       * Transition tuning
       * ------------------------------------------------------------------
       */
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },

      /*
       * ------------------------------------------------------------------
       * Z-index scale
       *
       * Keeps overlays/modals/tooltips predictable across the app.
       * ------------------------------------------------------------------
       */
      zIndex: {
        60: '60',
        70: '70',
        80: '80',
        90: '90',
        100: '100',
      },
    },
  },

  /*
   * Use an ESM import instead of require().
   *
   * This fixes the @typescript-eslint/no-require-imports error
   * from your previous configuration.
   */
  plugins: [tailwindcssAnimate],
};

export default config;