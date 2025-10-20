const express = require('express');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3, s3Bucket } = require('../config');
const { getMemoFromS3 } = require('../services/storage');

const router = express.Router();

router.get('/memos/:id', async (req, res) => {
  const id = req.params.id;
  const meta = await getMemoFromS3(id);
  if (!meta) return res.status(404).json({ error: 'Not found' });
  res.json(meta);
});

router.get('/memos/:id/transcript', async (req, res) => {
  const meta = await getMemoFromS3(req.params.id);
  if (!meta) return res.status(404).json({ error: 'not found' });
  const { transcript } = meta;
  if (!transcript || transcript.status === 'processing') return res.status(202).json({ status: 'processing' });
  if (transcript.status === 'error') return res.status(500).json({ status: 'error' });
  res.json({ status: 'ready', words: transcript.words, lines: transcript.lines, chapters: transcript.chapters || [] });
});

router.get('/memos/:id/audio', async (req, res) => {
  const id = req.params.id;
  const meta = await getMemoFromS3(id);
  if (!meta) return res.status(404).end();
  if (!(s3 && s3Bucket)) return res.status(404).end();
  const key = `memos/${meta.filename}`;
  try {
    const range = req.headers['range'];
    const params = { Bucket: s3Bucket, Key: key };
    if (range) params.Range = range;
    const out = await s3.send(new GetObjectCommand(params));
    if (out.ContentRange) res.setHeader('Content-Range', out.ContentRange);
    res.setHeader('Accept-Ranges', 'bytes');
    if (typeof out.ContentLength === 'number') res.setHeader('Content-Length', String(out.ContentLength));
    res.setHeader('Content-Type', out.ContentType || 'audio/webm');
    if (range) res.status(206);
    out.Body.pipe(res);
  } catch (e) {
    res.status(404).end();
  }
});

module.exports = router;


