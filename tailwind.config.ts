import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Menlo", "monospace"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card-bg)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        "accent-bg": "var(--accent-bg)",
        "action-primary": "var(--action-primary)",
        "action-primary-text": "var(--action-primary-text)",
        "sidebar-bg": "var(--sidebar-bg)",
        "sidebar-text": "var(--sidebar-text)",
        "sidebar-muted": "var(--sidebar-muted)",
        destructive: "var(--destructive)",
        // shadcn compat
        primary: {
          DEFAULT: "var(--action-primary)",
          foreground: "var(--action-primary-text)",
        },
        secondary: {
          DEFAULT: "var(--accent-bg)",
          foreground: "var(--text-primary)",
        },
        muted: {
          DEFAULT: "var(--accent-bg)",
          foreground: "var(--text-muted)",
        },
        input: "var(--border)",
        ring: "var(--border-strong)",
      },
      borderRadius: {
        DEFAULT: "4px",
        sm: "2px",
        md: "4px",
        lg: "6px",
        xl: "8px",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        shimmer: "shimmer 600ms ease forwards",
        "pulse-dot": "pulse-dot 1.5s ease infinite",
      },
    },
  },
  plugins: [],
};
export default config;
