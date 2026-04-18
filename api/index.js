import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import couplesRoutes from './routes/couples.js';
import entriesRoutes from './routes/entries.js';

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: false,
  })
);
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/auth', authRoutes);
app.use('/api/couple', couplesRoutes);
app.use('/api/entries', entriesRoutes);

// Catch-all 404 inside /api so we don't accidentally hijack SPA routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Centralised error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[api error]', err);
  res.status(500).json({ error: 'Server error' });
});

// When running locally with `npm run dev:api` we listen on a port.
// On Vercel, the `default export` is wired up as a serverless handler.
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

export default app;
