import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';

// Route modules
import stripeRoutes from './routes/stripe.js';
import tenantRoutes from './routes/tenants.js';
import questionRoutes from './routes/questions.js';
import lessonRoutes from './routes/lessons.js';
import youtubeRoutes from './routes/youtube.js';
import fileRoutes from './routes/files.js';

// Middleware
import { apiLimiter } from './lib/middleware.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ─── Webhooks (must be before express.json) ────────────────────
app.use('/api', stripeRoutes);

// ─── Body Parsers ──────────────────────────────────────────────
app.use(express.json());

// ─── Global Middleware ─────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api', (req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// ─── Health Check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ────────────────────────────────────────────────
app.use('/api', tenantRoutes);
app.use('/api', questionRoutes);
app.use('/api', lessonRoutes);
app.use('/api', youtubeRoutes);
app.use('/api', fileRoutes);

// ─── Vite Dev / Production Static ──────────────────────────────
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
