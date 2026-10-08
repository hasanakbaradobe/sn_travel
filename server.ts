import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { apiRouter } from './server/routes/api.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security Headers & Request Hygiene
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Mount API router
app.use('/api', apiRouter);

// Error handler for API routes
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Error]:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: err.message || 'An internal server error occurred',
    });
  }
});

// Locate static dist folder (checks process.cwd()/dist and __dirname/dist)
const candidateDistPaths = [
  path.resolve(process.cwd(), 'dist'),
  path.resolve(__dirname, 'dist'),
];

const distPath = candidateDistPaths.find((p) => fs.existsSync(path.join(p, 'index.html')));

if (distPath) {
  console.log(`[Server] Serving static frontend from: ${distPath}`);
  app.use(express.static(distPath));

  app.get('*', (_req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Frontend index.html not found. Please run "npm run build".');
    }
  });
} else {
  console.warn('[Server] Warning: Could not locate built "dist/index.html". Ensure "npm run build" ran successfully.');
  app.get('*', (_req, res) => {
    res.status(404).send('Frontend build (dist/index.html) is missing. Please ensure your Render build command is: "npm run build" or "bun run build".');
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
