import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background:  "var(--background)",
        foreground:  "var(--foreground)",
        border:      "var(--border)",
        input:       "var(--input)",
        ring:        "var(--ring)",
        surface:     "var(--surface)",

        primary: {
          DEFAULT:    "var(--primary)",
          light:      "var(--primary-light)",
          foreground: "var(--primary-foreground)",
          subtle:     "var(--primary-subtle)",
        },
        secondary: {
          DEFAULT:    "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT:    "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT:    "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT:    "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        card: {
          DEFAULT:    "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT:    "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        sidebar: {
          DEFAULT:             "var(--sidebar)",
          foreground:          "var(--sidebar-foreground)",
          border:              "var(--sidebar-border)",
          accent:              "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
        },
        topbar:       "var(--topbar)",
        ia:           "var(--ia)",
        "ia-subtle":  "var(--ia-subtle)",
        ficha:        "var(--ficha-color)",
        contestacion: "var(--contestacion-color)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
export default config;
