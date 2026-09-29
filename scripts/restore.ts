import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const execFileAsync = promisify(execFile);
if (process.env.CONFIRM_RESTORE !== 'YES') throw new Error('Restore is destructive. Set CONFIRM_RESTORE=YES explicitly.');
const manifestPath = process.argv[2]; if (!manifestPath) throw new Error('Usage: npm run ops:restore -- /path/to/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as any;
if (manifest.version !== 1 || !manifest.databaseDump?.sha256) throw new Error('Unsupported or invalid backup manifest.');
const root = path.dirname(path.resolve(manifestPath)); const dumpPath = path.join(root, manifest.databaseDump.path);
const dumpBytes = await readFile(dumpPath); const checksum = createHash('sha256').update(dumpBytes).digest('hex');
if (checksum !== manifest.databaseDump.sha256) throw new Error('Database dump checksum mismatch; restore aborted.');
const databaseUrl = process.env.RESTORE_DATABASE_URL || process.env.DATABASE_URL; if (!databaseUrl) throw new Error('RESTORE_DATABASE_URL or DATABASE_URL is required for restore.');
await execFileAsync('pg_restore', ['--dbname', databaseUrl, '--clean', '--if-exists', '--no-owner', '--no-acl', '--exit-on-error', dumpPath]);

const driver = manifest.objectStorage?.driver || 's3';
const s3 = new S3Client({
  region: process.env.OBJECT_STORAGE_REGION || process.env.AWS_REGION || 'us-east-1', endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
  forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true' || Boolean(process.env.OBJECT_STORAGE_ENDPOINT),
  credentials: process.env.OBJECT_STORAGE_ACCESS_KEY_ID && process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY ? { accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY } : undefined,
});
for (const object of manifest.objectStorage?.objects || []) {
  const bytes = await readFile(path.join(root, object.localPath));
  if (createHash('sha256').update(bytes).digest('hex') !== object.sha256) throw new Error(`Object checksum mismatch for ${object.key}; restore aborted.`);
  if (driver === 'filesystem') {
    const destination = path.join(process.env.OBJECT_STORAGE_LOCAL_DIR || './.object-storage', object.key); await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, bytes);
  } else {
    const bucket = process.env.OBJECT_STORAGE_BUCKET; if (!bucket) throw new Error('OBJECT_STORAGE_BUCKET is required for S3 restore.');
    const kms = process.env.OBJECT_STORAGE_SSE_KMS_KEY_ID;
    if (process.env.NODE_ENV === 'production' && !kms) throw new Error('OBJECT_STORAGE_SSE_KMS_KEY_ID is required for production restore.');
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: object.key, Body: bytes, ServerSideEncryption: 'aws:kms', SSEKMSKeyId: kms }));
  }
}
console.log(JSON.stringify({ event: 'restore.completed', backupId: manifest.backupId, objectCount: manifest.objectStorage?.objects?.length || 0 }));
