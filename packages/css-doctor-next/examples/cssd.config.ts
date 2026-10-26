import type { CssDoctorNextOptions } from "../src";

const config = {
  pageCoverage: {
    enabled: true,
    minPageRatio: 0.5,
    forceCommon: [":root", "html", "body", ".app-shell"],
  },
  sizeBudget: {
    enabled: true,
    maxChunkSize: 60 * 1024,
    isolateVariables: true,
  },
  minify: true,
  report: true,
  // Optional explicit usage for routes that are not statically analyzable:
  // pageUsage: {
  //   home: ["hero", "nav"],
  //   about: ["team-card"],
  // },
} satisfies CssDoctorNextOptions;

export default config;
