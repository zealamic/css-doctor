import { withCssDoctor } from '@zealamic/css-doctor-next';

const nextConfig = {
  reactStrictMode: true,
  // Your normal Next.js configuration.
};

export default withCssDoctor(nextConfig, {
  minPageRatio: 0.5,
  report: true,
});
