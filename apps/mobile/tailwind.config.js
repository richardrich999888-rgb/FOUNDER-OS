/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ballast: {
          ink: "#16211f",
          mist: "#f6f8f7",
          sage: "#8fa99b",
          tide: "#2f6f73",
        },
      },
    },
  },
  plugins: [],
};
