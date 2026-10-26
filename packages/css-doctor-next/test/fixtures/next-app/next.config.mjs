import { withCssDoctor } from '../../../dist/index.js';

const nextConfig = {
  reactStrictMode: true,
};

export default withCssDoctor(nextConfig, {
  pageCoverage: {
    enabled: true,
    minPageRatio: 0.6,
  },
  sizeBudget: {
    enabled: true,
    maxChunkSize: 60 * 1024,
    isolateVariables: true,
  },
  minify: true,
  report: true,
});
