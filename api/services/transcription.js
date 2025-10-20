const fs = require('fs');
const { openai } = require('../config');

function buildWordTimingsFromSegments(segments) {
  const words = [];
  for (const seg of segments || []) {
    const segStart = typeof seg.start === 'number' ? seg.start : 0;
    const segEnd = typeof seg.end === 'number' ? seg.end : segStart;
    const segText = (seg.text || '').trim();
    if (!segText) continue;
    const segWords = segText.split(/\s+/).filter(Boolean);
    const dur = Math.max(0.001, segEnd - segStart);
    const step = dur / segWords.length;
    let t = segStart;
    for (const w of segWords) {
      const start = t;
      const end = Math.min(segEnd, start + step);
      words.push({ text: w, start, end });
      t = end;
    }
  }
  return words;
}

function groupWordsIntoLines(wordTimings) {
  const lines = [];
  for (let i = 0; i < wordTimings.length; i += 8) {
    const slice = wordTimings.slice(i, i + 8);
    const text = slice.map((w) => w.text).join(' ');
    const start = slice[0].start;
    const end = slice[slice.length - 1].end;
    lines.push({ text, start, end, from: i, to: i + slice.length - 1 });
  }
  return lines;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildChaptersFromSegments(segments) {
  const chapters = [];
  if (!Array.isArray(segments) || segments.length === 0) return chapters;
  let curStart = null;
  let curEnd = null;
  let buf = '';
  const flush = () => {
    if (curStart == null || curEnd == null) return;
    const raw = buf.trim().replace(/\s+/g, ' ');
    const sentence = (raw.split(/(?<=[.!?])\s+/)[0] || raw).trim();
    const words = sentence.split(/\s+/).slice(0, 10).join(' ');
    const title = words || `Moment ${chapters.length + 1}`;
    chapters.push({ title, start: curStart, end: curEnd });
    buf = '';
    curStart = null;
    curEnd = null;
  };
  for (const s of segments) {
    const sStart = typeof s.start === 'number' ? s.start : curEnd ?? 0;
    const sEnd = typeof s.end === 'number' ? s.end : sStart;
    const gap = curEnd == null ? 0 : Math.max(0, sStart - curEnd);
    const text = (s.text || '').trim();
    const shouldSplit = gap > 2.5 || buf.length > 200;
    if (shouldSplit) flush();
    if (curStart == null) curStart = sStart;
    curEnd = sEnd;
    if (text) buf += (buf ? ' ' : '') + text;
  }
  flush();
  return chapters;
}

async function transcribeWithOpenAI(filePath) {
  if (!openai) return null;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
        response_format: 'verbose_json',
      });
      const segments = resp.segments || [];
      const text =
        typeof resp.text === 'string'
          ? resp.text
          : segments.map((s) => (s.text || '').trim()).join(' ').trim();
      const words = buildWordTimingsFromSegments(segments);
      const lines = groupWordsIntoLines(words);
      const chapters = buildChaptersFromSegments(segments);
      return { text, segments, words, lines, chapters };
    } catch (e) {
      try {
        const details = {
          name: e?.name,
          message: e?.message,
          status: e?.status,
          code: e?.code,
          type: e?.type,
          error: e?.error,
          headers: e?.headers,
          cause: e?.cause?.message,
        };
        console.error('[whisper] attempt', attempt, 'of', maxAttempts, 'error', details);
        if (e?.response && typeof e.response.text === 'function') {
          try {
            const body = await e.response.text();
            console.error('[whisper] response body', body);
          } catch {}
        }
        if (e?.stack) console.error('[whisper] stack', e.stack);
      } catch {}
      const cause = (e?.cause?.message || '').toLowerCase();
      const msg = (e?.message || '').toLowerCase();
      const retryable =
        cause.includes('econnreset') ||
        cause.includes('timed out') ||
        msg.includes('connection error') ||
        msg.includes('timeout') ||
        msg.includes('fetch failed');
      if (attempt < maxAttempts && retryable) {
        await sleep(500 * attempt);
        continue;
      }
      return null;
    }
  }
  return null;
}

function extractSmartCommentsFromLines(lines) {
  const results = [];
  const actionRegexes = [
    /^(?:let's|lets)\b/i,
    /\bwe (?:need|should|must|will)\b/i,
    /\baction(?: item)?s?\b/i,
    /\btodo\b/i,
    /\bfollow ?up\b/i,
    /\bschedule\b/i,
    /\bsend\b/i,
    /\bemail\b/i,
    /\bcreate\b/i,
    /\bupdate\b/i,
    /\bfix\b/i,
    /\breview\b/i,
    /\bdeploy\b/i,
    /\btest\b/i,
    /\bdocument\b/i,
  ];
  const keyRegexes = [
    /\bkey point\b/i,
    /\bimportant\b/i,
    /\bnote\b/i,
    /\bsummary\b/i,
    /!\s*$/,
  ];
  for (let i = 0; i < (lines || []).length; i++) {
    const line = lines[i];
    const text = (line && line.text ? String(line.text) : '').trim();
    if (!text) continue;
    const isAction = actionRegexes.some((r) => r.test(text));
    const isKey = !isAction && keyRegexes.some((r) => r.test(text));
    if (!isAction && !isKey) continue;
    const label = isAction ? 'Action' : 'Key';
    const normalized = text.replace(/\s+/g, ' ').trim();
    results.push({ lineIndex: i, at: typeof line.start === 'number' ? line.start : undefined, text: `${label}: ${normalized}` });
    if (results.length >= 12) break; // cap to keep it concise
  }
  // de-duplicate by text
  const seen = new Set();
  const deduped = [];
  for (const r of results) {
    const k = r.text.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(r);
  }
  return deduped;
}

module.exports = {
  buildWordTimingsFromSegments,
  groupWordsIntoLines,
  buildChaptersFromSegments,
  transcribeWithOpenAI,
  extractSmartCommentsFromLines,
  sleep,
};


