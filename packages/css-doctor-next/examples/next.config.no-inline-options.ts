import type { NextConfig } from "next";

import { withCssDoctor } from "../src";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

// cssd.config.ts is auto-discovered from the project root.
export default withCssDoctor(nextConfig);
