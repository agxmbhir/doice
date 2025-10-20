require('dotenv').config();
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const { S3Client } = require('@aws-sdk/client-s3');

const isProd = process.env.NODE_ENV === 'production';

// Resolve uploads dir relative to project root (same as previous server.js behavior)
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120000, maxRetries: 2 })
  : null;

const s3Bucket = process.env.S3_BUCKET || '';
const s3Region = process.env.S3_REGION || process.env.AWS_REGION || '';
const s3PublicBase = process.env.S3_PUBLIC_BASE || '';

const s3 = s3Bucket && s3Region
  ? new S3Client({
      region: s3Region,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
          : undefined,
    })
  : null;

module.exports = {
  isProd,
  uploadsDir,
  openai,
  s3,
  s3Bucket,
  s3Region,
  s3PublicBase,
};


