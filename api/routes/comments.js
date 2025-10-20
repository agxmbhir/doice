const express = require('express');
const { s3, s3Bucket } = require('../config');
const { getMemoFromS3, getComments, saveComments } = require('../services/storage');

const router = express.Router();

router.get('/memos/:id/comments', async (req, res) => {
  try {
    if (!(s3 && s3Bucket)) return res.status(503).json({ error: 'Comments storage unavailable (S3 required)' });
    const id = req.params.id;
    const meta = await getMemoFromS3(id);
    if (!meta) return res.status(404).json({ error: 'Not found' });
    const comments = await getComments(id);
    res.json({ comments });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

router.post('/memos/:id/comments', async (req, res) => {
  try {
    if (!(s3 && s3Bucket)) return res.status(503).json({ error: 'Comments storage unavailable (S3 required)' });
    const id = req.params.id;
    const { text, parentId, at, lineIndex, start, end } = req.body || {};
    const bodyText = (typeof text === 'string' ? text : '').trim();
    if (!bodyText) return res.status(400).json({ error: 'Missing text' });
    const meta = await getMemoFromS3(id);
    if (!meta) return res.status(404).json({ error: 'Not found' });
    const now = Date.now();
    const newComment = {
      id: now.toString(36) + Math.random().toString(36).slice(2, 8),
      parentId: parentId || null,
      at: typeof at === 'number' ? at : undefined,
      lineIndex: typeof lineIndex === 'number' ? lineIndex : undefined,
      start: typeof start === 'number' ? start : undefined,
      end: typeof end === 'number' ? end : undefined,
      text: bodyText,
      createdAt: now,
    };
    const comments = await getComments(id);
    comments.push(newComment);
    await saveComments(id, comments);
    res.json({ ok: true, comment: newComment });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save comment' });
  }
});

module.exports = router;


