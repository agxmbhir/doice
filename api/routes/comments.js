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
    // Ensure stable order by posted time
    comments.sort((a, b) => (a?.createdAt || 0) - (b?.createdAt || 0));
    res.json({ comments });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

router.post('/memos/:id/comments', async (req, res) => {
  try {
    if (!(s3 && s3Bucket)) return res.status(503).json({ error: 'Comments storage unavailable (S3 required)' });
    const id = req.params.id;
    const { text, parentId, at, lineIndex, start, end, quoteText } = req.body || {};
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
      quoteText: typeof quoteText === 'string' && quoteText.trim() ? quoteText.trim() : undefined,
      text: bodyText,
      createdAt: now,
      reactions: {},
    };
    const comments = await getComments(id);
    comments.push(newComment);
    await saveComments(id, comments);
    res.json({ ok: true, comment: newComment });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save comment' });
  }
});

// Toggle an emoji reaction for a specific comment
router.post('/memos/:id/comments/:commentId/reactions', async (req, res) => {
  try {
    if (!(s3 && s3Bucket)) return res.status(503).json({ error: 'Comments storage unavailable (S3 required)' });
    const id = req.params.id;
    const commentId = req.params.commentId;
    const { emoji, clientId, action } = req.body || {};
    const em = typeof emoji === 'string' ? emoji : '';
    const cid = typeof clientId === 'string' ? clientId : '';
    if (!em) return res.status(400).json({ error: 'Missing emoji' });
    if (!cid) return res.status(400).json({ error: 'Missing clientId' });

    const comments = await getComments(id);
    const idx = comments.findIndex((c) => c.id === commentId);
    if (idx === -1) return res.status(404).json({ error: 'Comment not found' });
    const comment = comments[idx];
    if (!comment.reactions || typeof comment.reactions !== 'object') comment.reactions = {};
    if (!Array.isArray(comment.reactions[em])) comment.reactions[em] = [];

    const arr = comment.reactions[em];
    const exists = arr.includes(cid);
    const shouldAdd = action === 'add' ? true : action === 'remove' ? false : !exists; // default toggle
    if (shouldAdd && !exists) arr.push(cid);
    if (!shouldAdd && exists) comment.reactions[em] = arr.filter((x) => x !== cid);

    comments[idx] = comment;
    await saveComments(id, comments);
    res.json({ ok: true, comment });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update reactions' });
  }
});

module.exports = router;


