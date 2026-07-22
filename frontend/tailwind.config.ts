import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand greens — mirrors the CSS custom properties in globals.css
        brand: {
          900: "#22361e",
          800: "#2c4326",
          700: "#33472e",
          600: "#465741",
          300: "#8a9880",
          100: "#e4e8df",
          50: "#f0f2ea",
        },
        // Ink scale for text
        ink: {
          DEFAULT: "#171f14",
          soft: "#4c5646",
          mute: "#7b8272",
        },
        // Surface scale
        surface: {
          DEFAULT: "#faf9f5",
          alt: "#f1efe7",
          panel: "#ffffff",
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
