import type { NextConfig } from "next";

import { withCssDoctor } from "../src";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withCssDoctor(nextConfig, {
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
});
