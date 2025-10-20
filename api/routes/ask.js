const express = require('express');
const { openai } = require('../config');
const { getMemoFromS3 } = require('../services/storage');

const router = express.Router();

router.post('/memos/:id/ask', async (req, res) => {
  try {
    const id = req.params.id;
    const question = (req.body && req.body.question ? String(req.body.question) : '').trim();
    if (!question) return res.status(400).json({ error: 'Missing question' });
    const meta = await getMemoFromS3(id);
    if (!meta) return res.status(404).json({ error: 'Not found' });
    if (!openai) return res.status(503).json({ error: 'QA unavailable (no OPENAI_API_KEY)' });
    const transcriptText = (meta.transcript?.lines || []).map((l) => l.text).join(' ');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Answer questions using only the provided transcript.' },
        { role: 'user', content: `Transcript:\n${transcriptText}\n\nQuestion: ${question}` },
      ],
    });
    const answer = completion.choices[0]?.message?.content || '';
    res.json({ answer });
  } catch (e) {
    res.status(500).json({ error: 'QA failed' });
  }
});

module.exports = router;


