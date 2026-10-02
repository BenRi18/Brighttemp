import type { Config } from "tailwindcss";

export default {
  // Every folder that contains class names. A folder missing here means its
  // styles are silently never generated.
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Instrument Sans Variable"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ['"Bricolage Grotesque Variable"', '"Instrument Sans Variable"', "system-ui", "sans-serif"],
      },
      colors: {
        pine: { DEFAULT: "#0E3B36", deep: "#082926" },
        amber: { DEFAULT: "#FFC93D", deep: "#E0A400" },
        paper: "#F4F7F3",
        muted: "#5E7370",
        line: "#D5DFD8",
        mint: "#16A67F",
      },
    },
  },
  plugins: [],
} satisfies Config;
