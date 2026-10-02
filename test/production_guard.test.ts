import { assertProductionConfiguration } from '../src/config/productionGuard';

let passed = 0;
let total = 0;
function assert(condition: boolean, name: string) {
  total++;
  if (condition) { passed++; console.log(`  ✓ [PASS] ${name}`); }
  else { console.error(`  ✗ [FAIL] ${name}`); process.exitCode = 1; }
}

console.log('--- RecoverOS Production Readiness Guard ---');
let blocked = false;
try { assertProductionConfiguration({ NODE_ENV: 'production' }); } catch { blocked = true; }
assert(blocked, 'Incomplete production configuration is fail-closed');

const complete: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  RECOVEROS_JWT_SECRET: 'a'.repeat(32),
  RECOVEROS_MASTER_KEK_HEX: 'a'.repeat(64),
  DATABASE_URL: 'postgresql://app:secret@private-db:5432/recoveros',
  REDIS_URL: 'rediss://private-redis:6380',
  APP_URL: 'https://staging.recoveros.example',
  OBJECT_STORAGE_DRIVER: 's3',
  OBJECT_STORAGE_SSE_KMS_KEY_ID: 'ocid1.key.oc1..example',
  TRUST_PROXY: 'true',
};
let accepted = true;
try { assertProductionConfiguration(complete); } catch { accepted = false; }
assert(accepted, 'Complete HTTPS, durable-storage and secret configuration is accepted');

console.log(`Production guard result: ${passed}/${total} passed`);
if (passed !== total) process.exitCode = 1;
