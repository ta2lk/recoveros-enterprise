import { SecurityViolationError } from '../db/client';

const isPlaceholder = (value: string | undefined): boolean => {
  if (!value) return true;
  return /^(SET_IN_|REPLACE_|CHANGE_|MY_|TODO|example|placeholder)/i.test(value.trim());
};

/**
 * Production must never silently run with the prototype's in-memory adapters.
 * This guard intentionally fails before HTTP starts until durable services are configured.
 */
export function assertProductionConfiguration(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;

  const required: Array<[string, string | undefined]> = [
    ['RECOVEROS_JWT_SECRET', env.RECOVEROS_JWT_SECRET],
    ['RECOVEROS_MASTER_KEK_HEX', env.RECOVEROS_MASTER_KEK_HEX],
    ['DATABASE_URL', env.DATABASE_URL],
    ['REDIS_URL', env.REDIS_URL],
    ['APP_URL', env.APP_URL],
    ['OBJECT_STORAGE_SSE_KMS_KEY_ID', env.OBJECT_STORAGE_SSE_KMS_KEY_ID],
  ];
  const missing = required.filter(([, value]) => isPlaceholder(value)).map(([name]) => name);
  const errors: string[] = [];
  if (missing.length) errors.push(`missing secrets/services: ${missing.join(', ')}`);
  if (env.OBJECT_STORAGE_DRIVER !== 's3') errors.push('OBJECT_STORAGE_DRIVER must be s3 for OCI Object Storage');
  if (env.TRUST_PROXY !== 'true') errors.push('TRUST_PROXY=true is required behind the trusted TLS proxy');
  if (!env.APP_URL?.startsWith('https://')) errors.push('APP_URL must use https://');
  if (env.RECOVEROS_JWT_SECRET && Buffer.byteLength(env.RECOVEROS_JWT_SECRET, 'utf8') < 32) errors.push('RECOVEROS_JWT_SECRET must contain at least 32 bytes');
  if (env.RECOVEROS_MASTER_KEK_HEX && !/^[a-f0-9]{64}$/i.test(env.RECOVEROS_MASTER_KEK_HEX)) errors.push('RECOVEROS_MASTER_KEK_HEX must contain exactly 64 hexadecimal characters');

  if (errors.length) {
    throw new SecurityViolationError(`Production readiness gate failed: ${errors.join('; ')}`);
  }
}
