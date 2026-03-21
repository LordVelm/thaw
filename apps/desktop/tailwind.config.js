/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0efff",
          200: "#b9ddff",
          300: "#7cc4ff",
          400: "#36a9ff",
          500: "#0b8fef",
          600: "#0070cc",
          700: "#0059a6",
          800: "#024b89",
          900: "#083f71",
        },
        warm: {
          50: "#faf8f5",
          100: "#f5f0ea",
          200: "#ede5d8",
          300: "#ddd0bd",
          400: "#c9b59c",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
