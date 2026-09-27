import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for HAC passwords at rest. Key = 32 random bytes, base64, in HAC_CREDENTIALS_KEY.
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * Output format: v1.<iv>.<tag>.<ciphertext> (base64url).
 */
function key() {
  const k = Buffer.from(process.env.HAC_CREDENTIALS_KEY ?? '', 'base64');
  if (k.length !== 32) throw new Error('HAC_CREDENTIALS_KEY must be 32 bytes (base64)');
  return k;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

export function decrypt(payload: string): string {
  const [version, iv, tag, data] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unknown ciphertext format');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
