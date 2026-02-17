export default {
  content: [
    "./renderer/index.html",
    "./renderer/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  build: {
    outDir: "../app-dist",
  },
  plugins: [],
};
