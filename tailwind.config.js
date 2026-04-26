/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "rgba(0, 0, 0, 0.1)",
        input: "#dddddd",
        ring: "#097fe8",
        background: "#ffffff",
        foreground: "rgba(0, 0, 0, 0.95)",

        notion: {
          black: "rgba(0, 0, 0, 0.95)",
          white: "#ffffff",
          blue: {
            DEFAULT: "#0075de",
            hover: "#005bab",
            focus: "#097fe8",
            pillText: "#097fe8",
            pillBg: "#f2f9ff"
          },
          navy: "#213183",
          warmWhite: "#f6f5f4",
          warmDark: "#31302e",
          gray: {
            500: "#615d59",
            300: "#a39e98"
          },
          teal: "#2a9d99",
          green: "#1aae39",
          orange: "#dd5b00",
          pink: "#ff64c8",
          purple: "#391c57",
          brown: "#523410",
        }
      },
      borderRadius: {
        full: "9999px",
        xl: "16px",
        lg: "12px",
        md: "8px",
        sm: "5px",
        micro: "4px"
      },
      boxShadow: {
        'soft-card': 'rgba(0, 0, 0, 0.04) 0px 4px 18px, rgba(0, 0, 0, 0.027) 0px 2.025px 7.84688px, rgba(0, 0, 0, 0.02) 0px 0.8px 2.925px, rgba(0, 0, 0, 0.01) 0px 0.175px 1.04062px',
        'deep': 'rgba(0, 0, 0, 0.01) 0px 1px 3px, rgba(0, 0, 0, 0.02) 0px 3px 7px, rgba(0, 0, 0, 0.02) 0px 7px 15px, rgba(0, 0, 0, 0.04) 0px 14px 28px, rgba(0, 0, 0, 0.05) 0px 23px 52px'
      },
      fontFamily: {
        sans: ['NotionInter', 'Inter', '-apple-system', 'system-ui', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
