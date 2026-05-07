import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#F2F4F7",
        foreground: "#2A2F36",
        border: "#D6DDE7",
        card: "#FFFFFF",
        primary: {
          DEFAULT: "#0D3B5C",
          foreground: "#FFFFFF"
        },
        accent: {
          DEFAULT: "#E09A1A",
          foreground: "#FFFFFF"
        },
        warning: "#C67D00",
        danger: "#C55A4F",
        muted: "#667085",
        success: "#1F8C5C",
        info: "#2C6EA5",
        brand: {
          ink: "#0D3B5C",
          graphite: "#2A2F36",
          mist: "#F2F4F7",
          amber: "#E09A1A",
          white: "#FFFFFF"
        }
      },
      boxShadow: {
        panel: "0 24px 50px rgba(13, 59, 92, 0.08)",
        float: "0 18px 35px rgba(13, 59, 92, 0.14)",
        glow: "0 18px 30px rgba(224, 154, 26, 0.18)"
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "2rem"
      },
      fontFamily: {
        display: [
          "\"Sora\"",
          "\"Segoe UI\"",
          "Tahoma",
          "Geneva",
          "Verdana",
          "sans-serif"
        ],
        sans: [
          "\"Inter\"",
          "\"Segoe UI\"",
          "Tahoma",
          "Geneva",
          "Verdana",
          "sans-serif"
        ],
        mono: [
          "\"Consolas\"",
          "\"Courier New\"",
          "monospace"
        ]
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at 0% 0%, rgba(13, 59, 92, 0.15), transparent 28%), radial-gradient(circle at 100% 0%, rgba(224, 154, 26, 0.18), transparent 24%), linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(242, 244, 247, 1))",
        "brand-mesh":
          "radial-gradient(circle at top left, rgba(13, 59, 92, 0.16), transparent 30%), radial-gradient(circle at bottom right, rgba(224, 154, 26, 0.12), transparent 24%), linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(242, 244, 247, 0.94))"
      }
    }
  },
  plugins: []
};

export default config;
