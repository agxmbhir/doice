const express = require('express');
const upload = require('./routes/upload');
const memos = require('./routes/memos');
const comments = require('./routes/comments');
const ask = require('./routes/ask');

const router = express.Router();

router.use(upload); // /upload
router.use(memos); // /memos/:id, /memos/:id/transcript, /memos/:id/audio
router.use(comments); // /memos/:id/comments
router.use(ask); // /memos/:id/ask

module.exports = router;


