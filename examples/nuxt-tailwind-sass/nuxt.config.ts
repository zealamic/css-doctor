import tailwindcss from "@tailwindcss/vite";

const stressSelectors = Array.from(
  { length: 140 },
  (_, index) => `.stress-surface-${index + 1}`,
);

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },

  modules: ["@zealamic/css-doctor-nuxt"],

  css: ["~/assets/styles-tailwind.css", "~/assets/styles-custom.scss"],

  cssDoctor: {
    pageCoverage: {
      enabled: true,
      minPageRatio: 0.5,
      forceCommon: [".app-header-shell", ".nav-pill-btn", ...stressSelectors],
    },
    sizeBudget: {
      enabled: true,
      maxChunkSize: 25 * 1024,
      isolateVariables: true,
    },
    minify: true,
    report: true,
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
