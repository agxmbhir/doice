const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy if deployed behind one
app.set('trust proxy', true);

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Serve static assets
app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use('/u', express.static(uploadsDir, { maxAge: '1y', immutable: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Root -> index
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Storage: memory to capture then fs write for speed
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Simple in-memory memo index (swap to DB later)
const memos = new Map();

// Upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const ext = (req.file.originalname.split('.').pop() || 'webm').toLowerCase();
    const filename = `${id}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(filePath, req.file.buffer);
    const url = `/u/${filename}`;
    memos.set(id, { id, filename, url, createdAt: Date.now(), duration: null });
    res.json({ id, url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Memo meta
app.get('/api/memos/:id', (req, res) => {
  const meta = memos.get(req.params.id);
  if (!meta) return res.status(404).json({ error: 'Not found' });
  res.json(meta);
});

// Share route (static page handles fetching by ID)
app.get('/s/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'share.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


