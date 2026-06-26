import type { Config } from "tailwindcss";
import animatePlugin from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "xs": "480px",
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        pixel: ['"Press Start 2P"', 'cursive'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        strength: "hsl(var(--strength))",
        intelligence: "hsl(var(--intelligence))",
        endurance: "hsl(var(--endurance))",
        xpGlow: "hsl(var(--xp-glow))",
        levelBadge: "hsl(var(--level-badge))",
        focused: {
          bg: "hsl(var(--focused-bg))",
          dim: "hsl(var(--focused-text-dim))",
          correct: "hsl(var(--focused-text-correct))",
          incorrect: "hsl(var(--focused-text-incorrect))",
          current: "hsl(var(--focused-text-current))",
          caret: "hsl(var(--focused-caret))",
        },
        game: {
          live: "hsl(var(--game-live))",
          comingSoon: "hsl(var(--game-coming-soon))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        titlePulse: {
          "0%": {
            transform: "scale(1)",
            boxShadow: "0 0 0px rgba(250,204,21,0)",
          },
          "50%": {
            transform: "scale(1.06)",
            boxShadow: "0 0 18px rgba(250,204,21,0.85)",
          },
          "100%": {
            transform: "scale(1)",
            boxShadow: "0 0 0px rgba(250,204,21,0)",
          },
        },
        "caret-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "char-error": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-3px)" },
          "75%": { transform: "translateX(3px)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Coin Rush
        "coin-pop": {
          "0%":   { transform: "scale(1)",   opacity: "1" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        "gem-pulse": {
          "0%, 100%": { transform: "scale(1) rotate(45deg)" },
          "50%":      { transform: "scale(1.12) rotate(45deg)" },
        },
        "stun-shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%":      { transform: "translateX(-2px)" },
          "75%":      { transform: "translateX(2px)" },
        },
        "countdown-pop": {
          "0%":   { transform: "scale(0.6)", opacity: "0" },
          "40%":  { transform: "scale(1)",   opacity: "1" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        titlePulse: "titlePulse 1.5s ease-in-out infinite",
        "caret-blink": "caret-blink 1s ease-in-out infinite",
        "char-error": "char-error 0.2s ease-in-out",
        "fade-in": "fade-in 150ms ease-out",
        // Coin Rush
        "coin-pop": "coin-pop 300ms ease-out forwards",
        "gem-pulse": "gem-pulse 1.2s ease-in-out infinite",
        "stun-shake": "stun-shake 200ms ease-in-out infinite",
        "countdown-pop": "countdown-pop 900ms ease-out forwards",
      },
    },
  },
  plugins: [animatePlugin],
} satisfies Config;
