import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const databaseUrl = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('BACKUP_DATABASE_URL or DATABASE_URL is required for backup.');
const backupId = new Date().toISOString().replace(/[:.]/g, '-');
const root = path.resolve(process.env.BACKUP_DIR || './backups', backupId);
const objectsDir = path.join(root, 'objects');
async function hashFile(filePath: string): Promise<{ sha256: string; size: number }> {
  const hash = createHash('sha256'); let size = 0;
  for await (const chunk of createReadStream(filePath)) { hash.update(chunk); size += chunk.length; }
  return { sha256: hash.digest('hex'), size };
}
async function runPgDump(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('pg_dump', args, { stdio: ['ignore', 'ignore', 'pipe'] }); let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); if (stderr.length > 8_000) stderr = stderr.slice(-8_000); });
    child.on('error', reject); child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`pg_dump failed (${code}): ${stderr}`)));
  });
}
const s3 = new S3Client({
  region: process.env.OBJECT_STORAGE_REGION || process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
  forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true' || Boolean(process.env.OBJECT_STORAGE_ENDPOINT),
  credentials: process.env.OBJECT_STORAGE_ACCESS_KEY_ID && process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY
    ? { accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY } : undefined,
});

async function bodyBuffer(body: any): Promise<Buffer> {
  if (body?.transformToByteArray) return Buffer.from(await body.transformToByteArray());
  const chunks: Buffer[] = []; for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks);
}
async function collectFiles(dir: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }); const result: string[] = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name); const absolute = path.join(dir, relative);
    if (entry.isDirectory()) result.push(...await collectFiles(absolute)); else result.push(absolute);
  }
  return result;
}
async function putBackupFile(bucket: string, key: string, filePath: string) {
  const kms = process.env.OBJECT_STORAGE_SSE_KMS_KEY_ID;
  if (process.env.NODE_ENV === 'production' && !kms) throw new Error('OBJECT_STORAGE_SSE_KMS_KEY_ID is required for production backup upload.');
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: createReadStream(filePath), ServerSideEncryption: 'aws:kms', SSEKMSKeyId: kms }));
}

await mkdir(objectsDir, { recursive: true });
const dumpPath = path.join(root, 'postgres.dump');
console.error(JSON.stringify({ event: 'backup.pg_dump.start', backupId }));
await runPgDump([databaseUrl, '--format=custom', '--no-owner', '--no-acl', '--file', dumpPath]);
console.error(JSON.stringify({ event: 'backup.pg_dump.complete', backupId }));
const dumpInfo = await hashFile(dumpPath);
const objectEntries: { key: string; localPath: string; sha256: string; size: number }[] = [];
const driver = process.env.OBJECT_STORAGE_DRIVER || 's3';
if (driver === 'filesystem') {
  const source = path.resolve(process.env.OBJECT_STORAGE_LOCAL_DIR || './.object-storage');
  try {
    const files = await collectFiles(source); console.error(JSON.stringify({ event: 'backup.objects.discovered', count: files.length }));
    for (const file of files) {
      const relative = path.relative(source, file).split(path.sep).join('/');
      const localPath = path.join(objectsDir, relative); await mkdir(path.dirname(localPath), { recursive: true }); await copyFile(file, localPath);
      const info = await hashFile(localPath); objectEntries.push({ key: relative, localPath: path.relative(root, localPath), ...info });
    }
  } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
} else {
  const bucket = process.env.OBJECT_STORAGE_BUCKET;
  if (!bucket) throw new Error('OBJECT_STORAGE_BUCKET is required for S3 backup.');
  let continuationToken: string | undefined;
  do {
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'tenants/', ContinuationToken: continuationToken }));
    for (const object of listed.Contents || []) {
      if (!object.Key) continue;
      const localPath = path.join(objectsDir, object.Key); await mkdir(path.dirname(localPath), { recursive: true });
      const body = (await s3.send(new GetObjectCommand({ Bucket: bucket, Key: object.Key }))).Body;
      if (!body) throw new Error(`Empty object: ${object.Key}`);
      await pipeline(body as any, createWriteStream(localPath));
      const info = await hashFile(localPath); objectEntries.push({ key: object.Key, localPath: path.relative(root, localPath), ...info });
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
}
const manifest = { version: 1, backupId, createdAt: new Date().toISOString(), databaseDump: { path: 'postgres.dump', ...dumpInfo }, objectStorage: { driver, objects: objectEntries } };
const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2)); await writeFile(path.join(root, 'manifest.json'), manifestBytes);
if (process.env.BACKUP_UPLOAD === 'true') {
  const bucket = process.env.BACKUP_BUCKET || process.env.OBJECT_STORAGE_BUCKET; if (!bucket) throw new Error('BACKUP_BUCKET or OBJECT_STORAGE_BUCKET is required for upload.');
  const prefix = `${process.env.BACKUP_PREFIX || 'backups'}/${backupId}`;
  await putBackupFile(bucket, `${prefix}/postgres.dump`, dumpPath); await putBackupFile(bucket, `${prefix}/manifest.json`, path.join(root, 'manifest.json'));
  for (const object of objectEntries) await putBackupFile(bucket, `${prefix}/objects/${object.key}`, path.join(root, object.localPath));
}
console.log(JSON.stringify({ event: 'backup.completed', backupId, root, uploaded: process.env.BACKUP_UPLOAD === 'true', objectCount: objectEntries.length }));
