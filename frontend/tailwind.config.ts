import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand greens — mirrors the CSS custom properties in globals.css
        brand: {
          950: "#1c2818",
          900: "#22361e",
          800: "#2c4326",
          700: "#33472e",
          600: "#465741",
          300: "#8a9880",
          100: "#e4e8df",
          75: "#e9efe6",
          50: "#f0f2ea",
        },
        // Ink scale for text
        ink: {
          DEFAULT: "#171f14",
          soft: "#4c5646",
          mute: "#7b8272",
          "on-brand": "#f4f3ee",
        },
        // Surface scale
        surface: {
          DEFAULT: "#faf9f5",
          alt: "#f1efe7",
          panel: "#ffffff",
        },
        // Semantic colors
        error: {
          DEFAULT: "#b91c1c",
          light: "#fef2f2",
          border: "#fecaca",
          text: "#991b1b",
        },
        success: {
          DEFAULT: "#059669",
          light: "#ecfdf5",
          border: "#a7f3d0",
          text: "#065f46",
        },
        warning: {
          DEFAULT: "#d97706",
          light: "#fffbeb",
          border: "#fde68a",
          text: "#92400e",
        },
        info: {
          DEFAULT: "#0284c7",
          light: "#f0f9ff",
          border: "#bae6fd",
          text: "#075985",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        "2xl": "20px",
        xl: "12px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(23,31,20,0.04), 0 10px 26px rgba(23,31,20,0.07)",
        "card-lg": "0 24px 60px rgba(23,31,20,0.14)",
      },
      maxWidth: {
        content: "1160px",
      },
    },
  },
  plugins: [],
};

export default config;
