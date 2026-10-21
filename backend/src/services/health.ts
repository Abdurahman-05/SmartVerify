import { connect } from 'node:net';

/** Response times of the last requests, for "typical" and "slowest 5%" on the health page. */
const RING = 2000;
const durations: number[] = [];
export function recordDuration(ms: number) {
  durations.push(ms);
  if (durations.length > RING) durations.shift();
}
export function responseTimes(): { p50: number | null; p95: number | null; samples: number } {
  if (durations.length === 0) return { p50: null, p95: null, samples: 0 };
  const sorted = [...durations].sort((a, b) => a - b);
  const at = (q: number) =>
    Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0);
  return { p50: at(0.5), p95: at(0.95), samples: sorted.length };
}

/** The banks' receipt sites: is each one answering? (A TCP connection, every 5 minutes.) */
export const BANK_SITES = [
  { code: 'CBE', host: 'mbreciept.cbe.com.et', port: 443 },
  { code: 'TEL', host: 'transactioninfo.ethiotelecom.et', port: 443 },
  { code: 'DAS', host: 'receipts.dashenbanksc.com', port: 443 },
  { code: 'BOA', host: 'cs.bankofabyssinia.com', port: 443 },
] as const;

interface SiteState {
  up: boolean | null;
  checkedAt: Date | null;
  downSince: Date | null;
  checks: number;
  ups: number;
}
const sites = new Map<string, SiteState>(
  BANK_SITES.map((s) => [s.code, { up: null, checkedAt: null, downSince: null, checks: 0, ups: 0 }])
);
const CHECK_EVERY_MS = 5 * 60_000;

const answers = (host: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = connect({ host, port, timeout: 8_000 });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });

/** Checks the sites not checked in the last 5 minutes (or all, when forced). */
export async function checkBankSites(force = false) {
  const now = Date.now();
  await Promise.all(
    BANK_SITES.map(async ({ code, host, port }) => {
      const state = sites.get(code);
      if (!state) return;
      if (!force && state.checkedAt && now - state.checkedAt.getTime() < CHECK_EVERY_MS) return;
      const up = await answers(host, port);
      state.checks += 1;
      if (up) state.ups += 1;
      state.downSince = up ? null : (state.downSince ?? new Date());
      state.up = up;
      state.checkedAt = new Date();
    })
  );
  return BANK_SITES.map(({ code }) => {
    const s = sites.get(code);
    return {
      code,
      up: s?.up ?? null,
      checkedAt: s?.checkedAt?.toISOString() ?? null,
      downSince: s?.downSince?.toISOString() ?? null,
      /** Share of checks that answered since the server started. */
      uptime: s && s.checks > 0 ? Math.round((s.ups / s.checks) * 1000) / 10 : null,
    };
  });
}
