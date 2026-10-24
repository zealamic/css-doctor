import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { cssDoctor } from '@zealamic/css-doctor-vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cssDoctor({
      minPageRatio: 0.5,
      report: true,
    }),
  ],
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
