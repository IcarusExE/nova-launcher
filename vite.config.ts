import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  test: {
    restoreMocks: true,
    maxWorkers: 1,
    testTimeout: 15000,
    // Vitest workers do not inherit this Node flag from the parent process.
    // Let JSDOM provide browser storage on Node 25+ as it does on Node 24.
    execArgv: ['--no-experimental-webstorage'],
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
