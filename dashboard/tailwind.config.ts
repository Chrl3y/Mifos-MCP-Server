import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#1d4ed8", light: "#3b82f6", dark: "#1e3a8a" },
        success: "#16a34a", warning: "#d97706", danger: "#dc2626",
      },
    },
  },
  plugins: [],
} satisfies Config;
