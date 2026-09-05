/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages sirve la app bajo /nutri-plan/ (docs/04). En desarrollo también, para que las rutas coincidan.
export default defineConfig({
  base: '/nutri-plan/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
});
