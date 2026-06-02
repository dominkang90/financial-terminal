/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#000000",
          panel: "#0d0d0d",
          border: "#1a1a1a",
          header: "#111111",
          accent: "#ff6600",
          "accent-dim": "#cc4400",
          green: "#00cc44",
          red: "#ff3333",
          blue: "#3399ff",
          yellow: "#ffcc00",
          gray: "#555555",
          "text-primary": "#e0e0e0",
          "text-secondary": "#888888",
          "text-dim": "#555555",
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
