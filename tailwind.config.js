/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          main: "var(--theme-main, #111827)",
          hover: "var(--theme-hover, #1f2937)",
          shadow: "var(--theme-shadow, #000000)",
        }
      }
    },
  },
  plugins: [],
}
