import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Admin panel rəngləri CSS dəyişənlərindən gəlir ki sidebar-dakı
        // toggle bütün paneli light/dark rejimə keçirə bilsin.
        admin: {
          bg: "rgb(var(--admin-bg) / <alpha-value>)",
          card: "rgb(var(--admin-card) / <alpha-value>)",
          chip: "rgb(var(--admin-chip) / <alpha-value>)",
          chip2: "rgb(var(--admin-chip2) / <alpha-value>)",
          line: "rgb(var(--admin-line) / <alpha-value>)",
          line2: "rgb(var(--admin-line2) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
export default config;
