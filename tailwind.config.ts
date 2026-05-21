import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        fraunces:          ["var(--font-fraunces)", "Georgia", "serif"],
        sans:              ["var(--font-instrument-sans)", "system-ui", "sans-serif"],
        mono:              ["var(--font-martian-mono)", "ui-monospace", "monospace"],
        "instrument-sans": ["var(--font-instrument-sans)", "system-ui", "sans-serif"],
        "martian-mono":    ["var(--font-martian-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        /* Chronicle tokens */
        "bg-ground":          "var(--bg-ground)",
        "bg-surface":         "var(--bg-surface)",
        "bg-overlay":         "var(--bg-overlay)",
        "bg-sidebar":         "var(--bg-sidebar)",
        "bg-hover":           "var(--bg-hover)",
        "bg-active":          "var(--bg-active)",

        "border-ghost":       "var(--border-ghost)",
        "border-subtle":      "var(--border-subtle)",
        "border-medium":      "var(--border-medium)",
        "border-strong":      "var(--border-strong)",

        "text-primary":       "var(--text-primary)",
        "text-secondary":     "var(--text-secondary)",
        "text-muted":         "var(--text-muted)",
        "text-on-dark":       "var(--text-on-dark)",
        "text-muted-dark":    "var(--text-muted-dark)",

        "color-destructive":  "var(--color-destructive)",
        "color-success":      "var(--color-success)",

        /* shadcn compat */
        background:           "var(--background)",
        foreground:           "var(--foreground)",
        primary: {
          DEFAULT:            "var(--primary)",
          foreground:         "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT:            "var(--secondary)",
          foreground:         "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT:            "var(--muted)",
          foreground:         "var(--muted-foreground)",
        },
        accent: {
          DEFAULT:            "var(--accent)",
          foreground:         "var(--accent-foreground)",
        },
        popover: {
          DEFAULT:            "var(--popover)",
          foreground:         "var(--popover-foreground)",
        },
        card: {
          DEFAULT:            "var(--card)",
          foreground:         "var(--card-foreground)",
        },
        border:               "var(--border)",
        input:                "var(--input)",
        ring:                 "var(--ring)",
        destructive: {
          DEFAULT:            "var(--destructive)",
          foreground:         "var(--destructive-foreground)",
        },
      },
      borderRadius: {
        DEFAULT: "4px",
        sm:      "2px",
        md:      "4px",
        lg:      "4px",
        xl:      "4px",
        pill:    "3px",
        full:    "9999px",
      },
      keyframes: {
        shimmer: {
          "0%":   { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        shimmer: "shimmer 500ms ease forwards",
      },
    },
  },
  plugins: [],
};

export default config;
