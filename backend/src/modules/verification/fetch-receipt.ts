import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';

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
  /** Go through this HTTP proxy (CONNECT tunnel, so the page stays encrypted end to end). */
  proxy?: URL;
}

const MAX_REDIRECTS = 3;
/** First try at opening the relay tunnel (a working one opens in about 1 s). */
const FIRST_TRY_MS = 4_000;

/** An https agent whose only connection is the given (already encrypted) tunnel. */
function tunnelAgent(socket: tls.TLSSocket): https.Agent {
  const agent = new https.Agent({ keepAlive: false });
  agent.createConnection = () => socket;
  return agent;
}

/** Opens an encrypted connection to the target through the proxy (HTTP CONNECT). */
function tunnel(proxy: URL, target: URL, tlsStrict: boolean, ms: number): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const where = `${target.hostname}:443`;
    const user = decodeURIComponent(proxy.username);
    const pass = decodeURIComponent(proxy.password);
    const req = http.request({
      host: proxy.hostname,
      port: Number(proxy.port || 80),
      method: 'CONNECT',
      path: where,
      headers: {
        host: where,
        ...(user
          ? { 'proxy-authorization': `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` }
          : {}),
      },
    });
    const timer = setTimeout(() => req.destroy(new ReceiptFetchError('TIMEOUT')), ms);
    req.on('connect', (res, socket) => {
      clearTimeout(timer);
      if (res.statusCode !== 200) {
        socket.destroy();
        return reject(new ReceiptFetchError('UNREACHABLE'));
      }
      // Hand over only a ready connection (Node 22 stalls on one still shaking hands).
      const secure = tls.connect({
        socket,
        servername: target.hostname,
        rejectUnauthorized: tlsStrict,
      });
      const left = setTimeout(() => secure.destroy(new ReceiptFetchError('TIMEOUT')), ms);
      secure.once('secureConnect', () => {
        clearTimeout(left);
        resolve(secure);
      });
      secure.once('error', (error) => {
        clearTimeout(left);
        reject(error instanceof ReceiptFetchError ? error : new ReceiptFetchError('UNREACHABLE'));
      });
    });
    req.on('error', (error) => {
      clearTimeout(timer);
      reject(error instanceof ReceiptFetchError ? error : new ReceiptFetchError('UNREACHABLE'));
    });
    req.end();
  });
}

/**
 * GET a receipt over https. SSRF-safe for a fixed bank host: only https, redirects only to
 * the same host, one overall timeout, and a size cap.
 */
export function fetchReceipt(url: URL, options: FetchOptions): Promise<FetchedReceipt> {
  const deadline = Date.now() + options.timeoutMs;

  // The relay's network often drops the first connection after a quiet spell: give the tunnel
  // a short first try, then one more with the time that is left.
  const openTunnel = async (proxy: URL, target: URL, tlsStrict: boolean) => {
    const left = deadline - Date.now();
    try {
      return await tunnel(proxy, target, tlsStrict, Math.min(left, FIRST_TRY_MS));
    } catch {
      const rest = deadline - Date.now();
      if (rest <= 0) throw new ReceiptFetchError('TIMEOUT');
      return tunnel(proxy, target, tlsStrict, rest);
    }
  };

  const get = async (target: URL, redirectsLeft: number): Promise<FetchedReceipt> => {
    const left = deadline - Date.now();
    if (left <= 0) throw new ReceiptFetchError('TIMEOUT');
    const socket = options.proxy
      ? await openTunnel(options.proxy, target, options.tlsStrict)
      : undefined;
    return new Promise((resolve, reject) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        socket?.destroy();
        return reject(new ReceiptFetchError('TIMEOUT'));
      }

      const requestOptions: https.RequestOptions = {
        rejectUnauthorized: options.tlsStrict,
        // Check the certificate of the server we dial, even when a Host header names another site.
        servername: target.hostname,
        headers: options.headers,
        // An agent of its own that hands out the tunnel (works the same on every Node version).
        ...(socket ? { agent: tunnelAgent(socket) } : {}),
      };
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
  };

  return get(url, MAX_REDIRECTS);
}
