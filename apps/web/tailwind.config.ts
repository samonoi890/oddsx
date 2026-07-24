import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#020617",
      },
      fontFamily: {
        display: ["Space Grotesk Variable", "sans-serif"],
        sans: ["Manrope Variable", "sans-serif"],
      },
      boxShadow: {
        glass: "0 24px 80px rgba(0, 0, 0, 0.34)",
        yes: "0 0 32px rgba(52, 211, 153, 0.22)",
        no: "0 0 32px rgba(251, 113, 133, 0.2)",
      },
      keyframes: {
        pingSoft: {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0", transform: "scale(2.2)" },
        },
      },
      animation: {
        "ping-soft": "pingSoft 2s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
