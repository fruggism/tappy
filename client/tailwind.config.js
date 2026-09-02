/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: "#f5f5f7",
          dark: "#000000",
        },
        surface: {
          DEFAULT: "#ffffff",
          dark: "#111113",
        },
        surface2: {
          DEFAULT: "#f0f0f2",
          dark: "#1c1c1f",
        },
        ink: {
          DEFAULT: "#1d1d1f",
          dark: "#f5f5f7",
        },
        muted: {
          DEFAULT: "#6e6e73",
          dark: "#9a9aa2",
        },
        neon: {
          green: "#39ff88",
          cyan: "#00e5ff",
          pink: "#ff2ecb",
          violet: "#a3a3ff",
          amber: "#ffcf4d",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        glow: "0 0 24px -4px var(--tw-shadow-color)",
      },
    },
  },
  plugins: [],
};
