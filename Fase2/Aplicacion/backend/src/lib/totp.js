import { createHmac, timingSafeEqual } from 'node:crypto';
// RFC 6238: SHA-1, 6 digits, 30 seconds. Base32 secret is provisioned privately.
function decode(secret) {
  if (typeof secret !== 'string' || !/^[A-Z2-7]{16,128}=*$/i.test(secret)) throw new Error('Invalid TOTP configuration');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, acc = 0;
  const bytes = [];
  for (const c of secret.toUpperCase().replace(/=+$/, '')) {
    acc = (acc << 5) | alphabet.indexOf(c); bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((acc >> bits) & 255); }
  }
  return Buffer.from(bytes);
}
export function totp(secret, counter, digits = 6) {
  const bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac('sha1', decode(secret)).update(bytes).digest();
  const offset = hash.at(-1) & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).toString().padStart(digits, '0');
}
export function verifyTotp(secret, code, now = Date.now(), lastCounter = -1) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  for (const step of [current, current - 1, current + 1]) {
    if (step <= lastCounter || step < 0) continue;
    if (timingSafeEqual(Buffer.from(totp(secret, step)), Buffer.from(code))) return step;
  }
  return null;
}
