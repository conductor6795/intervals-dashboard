import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        dash: {
          bg:     "rgb(var(--dash-bg-rgb) / <alpha-value>)",
          card:   "rgb(var(--dash-card-rgb) / <alpha-value>)",
          border: "rgb(var(--dash-border-rgb) / <alpha-value>)",
          muted:  "rgb(var(--dash-muted-rgb) / <alpha-value>)",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
