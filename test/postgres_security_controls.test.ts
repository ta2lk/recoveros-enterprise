import { createHmac } from 'node:crypto';
import { AuthUserService } from '../src/security/authService';
import { AuthenticatedSession, db } from '../src/db/client';

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0; let value = 0; const output: number[] = [];
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    const index = alphabet.indexOf(char); if (index < 0) throw new Error('Invalid base32');
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(output);
}
function currentTotp(secret: string): string {
  const counter = Math.floor(Date.now() / 30_000); const buffer = Buffer.alloc(8); buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secret)).update(buffer).digest(); const offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

if (!process.env.DATABASE_URL) {
  console.log('POSTGRES SECURITY CONTROLS TEST SKIPPED: DATABASE_URL is not configured.');
  process.exit(0);
}

await db.initialize();
const suffix = Date.now().toString();
const owner: AuthenticatedSession = { sessionId: `security-${suffix}`, userId: `security-${suffix}`, tenantId: `security-tenant-${suffix}`, role: 'Owner', expiresAt: Date.now() + 60_000 };
const email = `owner-${suffix}@recoveros.test`; const password = 'owner security password 2026';
const user = await AuthUserService.createUser(owner, { id: `security-user-${suffix}`, email, name: 'Security Owner', role: 'Owner', password });

let enrollmentRequired = false;
try { await AuthUserService.authenticate(email, password, undefined, `security-ip-${suffix}`); } catch (error: any) { enrollmentRequired = error.message.includes('MFA_ENROLLMENT_REQUIRED'); }
if (!enrollmentRequired) throw new Error('Sensitive role was allowed to login without MFA enrollment.');

const setup = await AuthUserService.beginMfaSetup(email, password);
if (!setup.secret || !setup.otpauthUrl.startsWith('otpauth://totp/')) throw new Error('MFA setup did not return a valid TOTP configuration.');
await AuthUserService.confirmMfa(email, password, currentTotp(setup.secret));

const authenticated = await AuthUserService.authenticate(email, password, currentTotp(setup.secret), `security-ip-${suffix}`);
if (authenticated.user.id !== user.id) throw new Error('MFA-authenticated user mismatch.');

let badOtpRejected = false;
try { await AuthUserService.authenticate(email, password, '000000', `bad-otp-ip-${suffix}`); } catch { badOtpRejected = true; }
if (!badOtpRejected) throw new Error('Invalid MFA code was accepted.');

for (let i = 0; i < 5; i++) {
  try { await AuthUserService.authenticate(email, 'wrong password 2026', undefined, `lock-ip-${suffix}`); } catch { /* expected */ }
}
let lockRejected = false;
try { await AuthUserService.authenticate(email, password, currentTotp(setup.secret), `lock-ip-${suffix}`); } catch (error: any) { lockRejected = error.message.includes('locked') || error.message.includes('Too many'); }
if (!lockRejected) throw new Error('Account was not locked after repeated failures.');

await db.close();
console.log('POSTGRES SECURITY CONTROLS TEST PASSED: TOTP enrollment, MFA enforcement, invalid-code rejection, and account lockout.');
