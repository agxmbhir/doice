require('dotenv').config();
const path = require('path');
const express = require('express');
const morgan = require('morgan');
const apiRouter = require('./api');
const { isProd, uploadsDir } = require('./api/config');

const app = express();
const PORT = 3001;

// Trust proxy if deployed behind one
app.set('trust proxy', true);

// uploadsDir is ensured in api/config

// Serve uploads locally (dev fallback) and built assets (in prod)
app.use('/u', express.static(uploadsDir, { maxAge: '1y', immutable: true }));
if (isProd) {
  app.use(express.static(path.join(__dirname, 'dist'), { maxAge: '1h' }));
}

// JSON body parsing
app.use(express.json());
app.use(morgan('dev'));

// Mount API router
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// In production, serve SPA index.html for app routes
if (isProd) {
  app.get(['/', '/s/*'], (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// In dev, leave frontend to Vite dev server (5173)

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

