import 'dotenv/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import express from 'express';
import compression from 'compression';
import {defineConfig, Plugin} from 'vite';

function expressApiPlugin(): Plugin {
  return {
    name: 'express-api-plugin',
    async configureServer(server) {
      const { apiRouter } = await import('./server/routes/api.ts');
      const apiApp = express();
      
      // HTTP Response Compression (Gzip / Deflate)
      apiApp.use(compression({
        threshold: 1024,
      }));

      // Security Headers & Request Hygiene
      apiApp.use((_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        next();
      });

      apiApp.use(express.json({ limit: '25mb' }));
      apiApp.use(express.urlencoded({ extended: true, limit: '25mb' }));
      apiApp.use('/api', apiRouter);

      // Catch-all for any unhandled /api route so it NEVER falls through to Vite HTML fallback
      apiApp.use('/api', (req, res) => {
        if (!res.headersSent) {
          res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
        }
      });

      // Graceful error handler to prevent Vite 500 mask
      apiApp.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        console.error('[API Error in Middleware]:', err);
        if (!res.headersSent) {
          res.status(err.status || 500).json({
            error: err.message || 'An internal server error occurred',
          });
        }
      });

      server.middlewares.use((req, res, next) => {
        if (req.url && (req.url === '/api' || req.url.startsWith('/api/') || req.url.startsWith('/api?'))) {
          apiApp(req as any, res as any, (err?: any) => {
            // NEVER let an API request pass through to Vite's HTML index middleware
            if (err) {
              if (!res.headersSent) {
                res.statusCode = err.status || 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
              }
            } else if (!res.writableEnded) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `API route not found: ${req.url}` }));
            }
          });
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), expressApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
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
