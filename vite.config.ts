import 'dotenv/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import express from 'express';
import compression from 'compression';
import {defineConfig, Plugin} from 'vite';

function expressApiPlugin(): Plugin {
  return {
    name: 'express-api-plugin',
    configureServer(server) {
      let apiAppInstance: express.Express | null = null;

      const initApiApp = async (): Promise<express.Express> => {
        const { apiRouter } = await import('./server/routes/api.ts');
        const apiApp = express();
        apiApp.disable('x-powered-by');
        apiApp.set('trust proxy', 1);

        // HTTP Response Compression (Gzip / Deflate — skip Server-Sent Events stream)
        apiApp.use(
          compression({
            threshold: 1024,
            filter: (req, res) => {
              if (req.path === '/api/events' || req.headers.accept?.includes('text/event-stream')) {
                return false;
              }
              return compression.filter(req, res);
            },
          })
        );

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

        apiAppInstance = apiApp;
        return apiApp;
      };

      // Kick off API router initialization in the background without blocking port 3000 binding
      const apiAppPromise = initApiApp().catch((err) => {
        console.error('[Vite API Plugin] Failed to initialize API router:', err);
        throw err;
      });

      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url === '/api' || req.url.startsWith('/api/') || req.url.startsWith('/api?'))) {
          try {
            const apiApp = apiAppInstance || (await apiAppPromise);
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
          } catch (err: any) {
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'API initialization error' }));
            }
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      expressApiPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          id: '/',
          name: 'SN Travels Agency — Client Management',
          short_name: 'SN Travels',
          description: 'Internal China Visa Client Management System for SN Travels Agency.',
          theme_color: '#0f172a',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          navigateFallbackDenylist: [/^\/api/],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
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
