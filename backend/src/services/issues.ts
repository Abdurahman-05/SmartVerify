import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Server problems for the admin's "Health and errors" page: grouped by cause and counted, with
 * a Telegram alert when a new kind starts (or a resolved one comes back). Never stores request
 * bodies, PINs, tokens or pictures: only the cause, the route and the time.
 */
export type IssueArea = 'receipt_check' | 'read_picture' | 'database' | 'server';

interface AlertConfig {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

/** Sends one Telegram message to the team. Answers whether it was sent. */
export async function sendTelegram(env: AlertConfig, text: string): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Counts one problem. Never throws: logging a problem must not cause another. */
export async function recordIssue(
  prisma: PrismaClient,
  env: AlertConfig,
  issue: { area: IssueArea; cause: string; route?: string }
): Promise<void> {
  const key = `${issue.area}|${issue.cause}|${issue.route ?? ''}`;
  try {
    const before = await prisma.errorLog.findUnique({ where: { key } });
    const now = new Date();
    await prisma.errorLog.upsert({
      where: { key },
      create: { key, area: issue.area, cause: issue.cause, route: issue.route ?? null },
      update: { count: { increment: 1 }, lastSeen: now, resolvedAt: null },
    });
    if (!before || before.resolvedAt) {
      void sendTelegram(
        env,
        `Smart Verify: ${before ? 'back again' : 'new problem'} — ${issue.cause}` +
          (issue.route ? ` (${issue.route})` : '')
      );
    }
  } catch {
    // The database itself may be the problem.
  }
}

const today = () => new Date().toISOString().slice(0, 10);

/** +1 on a daily counter (gemini_calls, gemini_rate_limited, ocr_fallback, …). Never throws. */
export async function countToday(prisma: PrismaClient, key: string, by = 1): Promise<void> {
  try {
    await prisma.dailyCounter.upsert({
      where: { day_key: { day: today(), key } },
      create: { day: today(), key, count: by },
      update: { count: { increment: by } },
    });
  } catch {
    // Counting is best effort.
  }
}

/** The cause of a server error, in a few words the admin can act on. */
export function causeOf(error: unknown): { area: IssueArea; cause: string } {
  const code = (error as { code?: unknown } | null)?.code;
  const name = error instanceof Error ? error.name : 'Unknown';
  const message = error instanceof Error ? error.message : '';
  if (code === 'P1001' || /Can't reach database|ECONNREFUSED|ENOTFOUND/.test(message)) {
    return { area: 'database', cause: 'db_unreachable' };
  }
  if (code === 'P2024' || code === 'P1008' || /timed out|Timeout/i.test(message)) {
    return { area: 'database', cause: 'db_busy' };
  }
  if (typeof code === 'string' && code.startsWith('P')) {
    return { area: 'database', cause: `db_error:${code}` };
  }
  return { area: 'server', cause: `error:${name}` };
}
