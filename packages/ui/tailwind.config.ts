import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
        serif: ["var(--font-instrument)", "ui-serif", "Georgia", "serif"],
      },
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        "text-dim": "var(--text-dim)",
        "text-faint": "var(--text-faint)",
        violet: "var(--violet)",
        emerald: "var(--emerald)",
        amber: "var(--amber)",
        rose: "var(--rose)",
        cyan: "var(--cyan)",
      },
    },
  },
  plugins: [],
};

export default config;
