import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for small secrets kept in the database (admin authenticator secrets).
 * The key is ADMIN_SECRET_KEY: 32 random bytes, base64. Stored as "iv.tag.data", base64url.
 */
const keyOf = (keyBase64: string) => {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) throw new Error('ADMIN_SECRET_KEY must be 32 bytes (base64)');
  return key;
};

export function sealSecret(plain: string, keyBase64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyOf(keyBase64), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

export function openSecret(sealed: string, keyBase64: string): string {
  const [iv, tag, data] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !data) throw new Error('bad sealed secret');
  const decipher = createDecipheriv('aes-256-gcm', keyOf(keyBase64), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
