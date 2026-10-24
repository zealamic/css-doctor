const config = {
  minPageRatio: 0.25,
  report: false,
  forceCommonSelectors: ['.always-keep'],
  pageUsage: {
    home: ['shared', 'always-keep'],
    about: ['shared', 'about-only'],
  },
};

export default config;
