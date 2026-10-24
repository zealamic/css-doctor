import type { CssDoctorNextOptions } from '@zealamic/css-doctor-next';

const config: CssDoctorNextOptions = {
  minPageRatio: 0.5,
  report: true,
  forceCommonSelectors: [':root', 'html', 'body', '.app-shell'],
  // Optional direct usage for routes that are not statically analyzable:
  // pageUsage: {
  //   home: ['hero', 'nav'],
  //   about: ['team-card'],
  // },
};

export default config;
