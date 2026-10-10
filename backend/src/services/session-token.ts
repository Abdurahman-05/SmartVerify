import { createHash, randomBytes } from 'node:crypto';

/** A new random bearer token (256 bits). Only its hash is stored. */
export const newSessionToken = () => randomBytes(32).toString('base64url');

export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex');
