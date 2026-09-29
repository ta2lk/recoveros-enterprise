import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-dev-server',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/healthz') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'HEALTHY', timestamp: new Date().toISOString() }));
              return;
            }
            if (req.url === '/ready') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'READY', services: ['database', 'matching-engine', 'agents'] }));
              return;
            }
            if (req.url === '/api/v1/health') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ platform: 'RecoverOS', version: '1.0.0', mode: 'AUTONOMOUS_ENTERPRISE_RECOVERY' }));
              return;
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
