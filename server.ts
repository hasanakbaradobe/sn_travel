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

// Locate static dist folder (checks process.cwd()/dist and __dirname/dist dynamically)
const getDistPath = (): string | null => {
  const candidateDistPaths = [
    path.resolve(process.cwd(), 'dist'),
    path.resolve(__dirname, 'dist'),
    path.resolve(process.cwd(), 'public'),
  ];
  return candidateDistPaths.find((p) => fs.existsSync(path.join(p, 'index.html'))) || null;
};

// Middleware to serve static files dynamically
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  const currentDistPath = getDistPath();
  if (currentDistPath) {
    express.static(currentDistPath, {
      maxAge: req.path.startsWith('/assets/') ? '1y' : '0',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    })(req, res, next);
  } else {
    next();
  }
});

// SPA wildcard fallback
app.get('*', (_req, res) => {
  const currentDistPath = getDistPath();
  if (currentDistPath) {
    const indexPath = path.join(currentDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(indexPath);
    }
  }
  return res
    .status(404)
    .send('Frontend build (dist/index.html) is missing. Please ensure your Render build command is set to "npm run build" and start command is "npm start".');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
