/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // CSS 변수 기반 — opacity modifier 완전 지원 (bg-terminal-accent/20 등)
        terminal: {
          bg:              "rgb(var(--t-bg) / <alpha-value>)",
          panel:           "rgb(var(--t-panel) / <alpha-value>)",
          border:          "rgb(var(--t-border) / <alpha-value>)",
          header:          "rgb(var(--t-header) / <alpha-value>)",
          accent:          "rgb(var(--t-accent) / <alpha-value>)",
          "accent-dim":    "rgb(var(--t-accent-dim) / <alpha-value>)",
          green:           "rgb(var(--t-green) / <alpha-value>)",
          red:             "rgb(var(--t-red) / <alpha-value>)",
          blue:            "rgb(var(--t-blue) / <alpha-value>)",
          yellow:          "rgb(var(--t-yellow) / <alpha-value>)",
          gray:            "rgb(var(--t-gray) / <alpha-value>)",
          "text-primary":  "rgb(var(--t-text-primary) / <alpha-value>)",
          "text-secondary":"rgb(var(--t-text-secondary) / <alpha-value>)",
          "text-dim":      "rgb(var(--t-text-dim) / <alpha-value>)",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "'Courier New'", "monospace"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": "0.625rem",
        xs: "0.7rem",
        sm: "0.75rem",
        base: "0.8125rem",
      },
    },
  },
  plugins: [],
};
