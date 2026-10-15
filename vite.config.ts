import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the app from /calisthenics-training/.
export default defineConfig({
  base: '/calisthenics-training/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
