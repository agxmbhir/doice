const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3, s3Bucket } = require('../config');

async function saveMemoToS3(id, meta) {
  if (!(s3 && s3Bucket)) return;
  const key = `memos/${id}.json`;
  await s3.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      Body: JSON.stringify(meta),
      ContentType: 'application/json',
      ACL: 'public-read',
    })
  );
}

async function getMemoFromS3(id) {
  if (!(s3 && s3Bucket)) return null;
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: s3Bucket, Key: `memos/${id}.json` }));
    const buf = await streamToBuffer(out.Body);
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

async function getComments(id) {
  if (!(s3 && s3Bucket)) throw new Error('S3 not configured');
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: s3Bucket, Key: `memos/${id}.comments.json` }));
    const buf = await streamToBuffer(out.Body);
    const json = JSON.parse(buf.toString('utf8'));
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.comments)) return json.comments;
    return [];
  } catch {
    return [];
  }
}

async function saveComments(id, comments) {
  if (!(s3 && s3Bucket)) throw new Error('S3 not configured');
  const payload = JSON.stringify(comments);
  await s3.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: `memos/${id}.comments.json`,
      Body: payload,
      ContentType: 'application/json',
      ACL: 'public-read',
    })
  );
}

function streamToBuffer(stream) {
  if (!stream) return Promise.resolve(Buffer.alloc(0));
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

module.exports = {
  saveMemoToS3,
  getMemoFromS3,
  getComments,
  saveComments,
  streamToBuffer,
};


