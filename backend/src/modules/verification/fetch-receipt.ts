import https from 'node:https';

/** NOT_FOUND: the bank answered that it has no such receipt (400/404). */
export type FetchFailure = 'TIMEOUT' | 'UNREACHABLE' | 'NOT_FOUND';

export class ReceiptFetchError extends Error {
  constructor(readonly reason: FetchFailure) {
    super(reason);
  }
}

export interface FetchedReceipt {
  contentType: string;
  body: Buffer;
}

export interface FetchOptions {
  tlsStrict: boolean;
  timeoutMs: number;
  maxBytes: number;
  headers?: Record<string, string>;
}

const MAX_REDIRECTS = 3;

/**
 * GET a receipt over https. SSRF-safe for a fixed bank host: only https, redirects only to
 * the same host, one overall timeout, and a size cap.
 */
export function fetchReceipt(url: URL, options: FetchOptions): Promise<FetchedReceipt> {
  const deadline = Date.now() + options.timeoutMs;

  const get = (target: URL, redirectsLeft: number): Promise<FetchedReceipt> =>
    new Promise((resolve, reject) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return reject(new ReceiptFetchError('TIMEOUT'));

      const requestOptions = { rejectUnauthorized: options.tlsStrict, headers: options.headers };
      const req = https.get(target, requestOptions, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          clearTimeout(timer);
          let next: URL;
          try {
            next = new URL(res.headers.location, target);
          } catch {
            return reject(new ReceiptFetchError('UNREACHABLE'));
          }
          if (next.protocol !== 'https:' || next.hostname !== url.hostname || redirectsLeft <= 0) {
            return reject(new ReceiptFetchError('UNREACHABLE'));
          }
          return get(next, redirectsLeft - 1).then(resolve, reject);
        }
        if (status !== 200) {
          res.resume();
          clearTimeout(timer);
          const reason = status === 400 || status === 404 ? 'NOT_FOUND' : 'UNREACHABLE';
          return reject(new ReceiptFetchError(reason));
        }

        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > options.maxBytes) {
            req.destroy(new ReceiptFetchError('UNREACHABLE'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          clearTimeout(timer);
          resolve({
            contentType: String(res.headers['content-type'] ?? '').toLowerCase(),
            body: Buffer.concat(chunks),
          });
        });
        res.on('error', () => undefined);
      });

      const timer = setTimeout(() => req.destroy(new ReceiptFetchError('TIMEOUT')), remaining);
      req.on('error', (error) => {
        clearTimeout(timer);
        reject(error instanceof ReceiptFetchError ? error : new ReceiptFetchError('UNREACHABLE'));
      });
    });

  return get(url, MAX_REDIRECTS);
}
