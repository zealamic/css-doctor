import { withCssDoctor } from '../../../dist/index.js';

const nextConfig = {
  reactStrictMode: true,
};

export default withCssDoctor(nextConfig, {
  minPageRatio: 0.6,
  report: true,
});
