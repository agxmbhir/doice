const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { uploadsDir, s3, s3Bucket, s3Region, s3PublicBase } = require('../config');
const { saveMemoToS3, getComments, saveComments } = require('../services/storage');
const { transcribeWithOpenAI, extractSmartCommentsFromLines } = require('../services/transcription');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const ext = (req.file.originalname.split('.').pop() || 'webm').toLowerCase();
    const filename = `${id}.${ext}`;

    let publicUrl = '';
    if (s3 && s3Bucket) {
      const key = `memos/${filename}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype || 'audio/webm',
          ACL: 'public-read',
        })
      );
      publicUrl = s3PublicBase ? `${s3PublicBase.replace(/\/$/, '')}/${key}` : `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${key}`;
    } else {
      const filePath = path.join(uploadsDir, filename);
      await fs.promises.writeFile(filePath, req.file.buffer);
      publicUrl = `/u/${filename}`;
    }

    const createdAt = Date.now();
    await saveMemoToS3(id, {
      id,
      filename,
      url: publicUrl,
      audioUrl: publicUrl,
      createdAt,
      transcript: { status: process.env.OPENAI_API_KEY ? 'processing' : 'unavailable' },
    });

    (async () => {
      try {
        let localPath = '';
        if (publicUrl.startsWith('/u/')) {
          localPath = path.join(uploadsDir, filename);
        } else {
          const tempPath = path.join(uploadsDir, filename);
          await fs.promises.writeFile(tempPath, req.file.buffer);
          localPath = tempPath;
        }
        const t = await transcribeWithOpenAI(localPath);
        if (!t) {
          await saveMemoToS3(id, { id, filename, url: publicUrl, audioUrl: publicUrl, createdAt, transcript: { status: 'error' } });
          return;
        }
        await saveMemoToS3(id, {
          id,
          filename,
          url: publicUrl,
          audioUrl: publicUrl,
          createdAt,
          transcript: {
            status: 'ready',
            text: t.text,
            words: t.words,
            lines: t.lines,
            chapters: t.chapters,
            source: 'openai',
          },
          segments: t.segments,
        });
        try {
          if (Array.isArray(t.lines) && t.lines.length) {
            const smart = extractSmartCommentsFromLines(t.lines);
            if (smart.length) {
              const existing = await getComments(id).catch(() => []);
              const now = Date.now();
              const merged = existing.slice();
              const seen = new Set(existing.map((c) => `${c.lineIndex ?? ''}|${(c.text || '').toLowerCase()}`));
              for (const s of smart) {
                const key = `${s.lineIndex ?? ''}|${(s.text || '').toLowerCase()}`;
                if (seen.has(key)) continue;
                seen.add(key);
                merged.push({
                  id: (now + Math.floor(Math.random() * 1e6)).toString(36),
                  parentId: null,
                  at: typeof s.at === 'number' ? s.at : undefined,
                  lineIndex: s.lineIndex,
                  text: s.text,
                  createdAt: now,
                });
              }
              if (merged.length !== existing.length) {
                await saveComments(id, merged);
              }
            }
          }
        } catch {}
      } catch (e) {
        try {
          await saveMemoToS3(id, { id, filename, url: publicUrl, audioUrl: publicUrl, createdAt, transcript: { status: 'error' } });
        } catch {}
      }
    })();

    res.json({ id, url: publicUrl, shareUrl: `${process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173'}/s/${id}` });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;


