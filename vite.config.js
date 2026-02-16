import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/racer/',
  build: {
    outDir: 'docs',
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
  }
});
