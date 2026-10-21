import { defineConfig } from 'vite';
export default defineConfig({
  // Read VITE_* settings from the repo-root .env. Vite only exposes VITE_-prefixed
  // variables to browser code, so server secrets in the same file stay server-side.
  envDir: '../..',
  server: { host: '127.0.0.1', port: Number(process.env.COMPANION_PORT ?? 5173), strictPort: true, proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT ?? 8787}`, '/health': `http://127.0.0.1:${process.env.API_PORT ?? 8787}`, '/fixtures': `http://127.0.0.1:${process.env.API_PORT ?? 8787}` } },
  build: { target: 'es2022', manifest: true },
});
