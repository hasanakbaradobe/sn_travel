/**
 * SN Travels Agency — Express Backend Server
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { apiRouter } from './routes/api.ts';

export const app = express();

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// API router mount
app.use('/api', apiRouter);

// Serve static frontend files in production
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

// Fallback to index.html for SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, err => {
    if (err) {
      res.status(404).send('Not found');
    }
  });
});

const PORT = parseInt(process.env.PORT || '3000', 10);

if (process.env.RUN_STANDALONE === 'true') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SN Travels Agency Server] Running on http://0.0.0.0:${PORT}`);
  });
}
