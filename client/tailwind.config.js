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
        // Accenti che seguono il tema tramite variabili CSS (vedi index.css):
        // fluo in scuro, versioni scurite/accessibili (≥4.5:1) in chiaro.
        acc: {
          green: "var(--acc-green)",
          pink: "var(--acc-pink)",
          cyan: "var(--acc-cyan)",
          violet: "var(--acc-violet)",
          amber: "var(--acc-amber)",
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
      fontSize: {
        largeTitle: ["34px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "700" }],
        title2: ["22px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "600" }],
        headline: ["17px", { lineHeight: "22px", letterSpacing: "-0.01em", fontWeight: "600" }],
        body: ["17px", { lineHeight: "22px" }],
        callout: ["15px", { lineHeight: "20px" }],
        footnote: ["13px", { lineHeight: "18px" }],
        caption: ["12px", { lineHeight: "16px", letterSpacing: "0.02em" }],
      },
      boxShadow: {
        glow: "0 0 24px -4px var(--tw-shadow-color)",
      },
    },
  },
  plugins: [],
};
