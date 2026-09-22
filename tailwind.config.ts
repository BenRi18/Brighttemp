import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
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
