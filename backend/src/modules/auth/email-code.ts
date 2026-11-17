import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

import type { FastifyBaseLogger, FastifyInstance } from 'fastify';

import { sendEmail } from '../../services/email.js';
import { AppError } from '../../shared/errors/app-error.js';

/** How long a code works, how often one can be sent, and how many wrong tries it takes. */
export const CODE_TTL_MS = 10 * 60_000;
export const RESEND_AFTER_MS = 45_000;
export const MAX_CODES_PER_HOUR = 5;
export const MAX_TRIES = 5;
/** After the right code, sign-up with that email must happen within this time. */
export const VERIFIED_FOR_MS = 30 * 60_000;

const hashOf = (email: string, code: string) =>
  createHash('sha256').update(`${email}:${code}`).digest('hex');

const sameHash = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function codeEmail(code: string) {
  const subject = `Your Gebtual code: ${code}`;
  const text =
    `Your Gebtual sign-up code is ${code}. It works for 10 minutes.\n` +
    `የGebtual የምዝገባ ኮድዎ ${code} ነው። ለ10 ደቂቃ ይሰራል።\n\n` +
    'If you did not ask for this, you can ignore this email.';
  const html =
    '<div style="font-family:Arial,sans-serif;font-size:16px;color:#1E1A1C">' +
    '<p>Your Gebtual sign-up code is:</p>' +
    `<p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>` +
    '<p>It works for 10 minutes.</p>' +
    `<p>የGebtual የምዝገባ ኮድዎ <b>${code}</b> ነው። ለ10 ደቂቃ ይሰራል።</p>` +
    '<p style="color:#6B6266;font-size:13px">If you did not ask for this, you can ignore this email.</p>' +
    '</div>';
  return { subject, text, html };
}

export function createEmailCodes(app: FastifyInstance) {
  const { prisma, env } = app;

  return {
    /**
     * Sends a new 6-digit code. Without an email provider (development, tests) nothing is sent
     * and the code comes back as `devCode`; production without one refuses.
     */
    async send(email: string, log: FastifyBaseLogger) {
      if (await prisma.user.findUnique({ where: { email } })) throw new AppError('EMAIL_TAKEN');
      const now = Date.now();
      const recent = await prisma.emailCode.findMany({
        where: { email, createdAt: { gte: new Date(now - 3_600_000) } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      const last = recent[0];
      if (last && now - last.createdAt.getTime() < RESEND_AFTER_MS) {
        const wait = Math.ceil((RESEND_AFTER_MS - (now - last.createdAt.getTime())) / 1000);
        throw new AppError('RATE_LIMITED', { reason: 'tooSoon', retryAfterSeconds: wait });
      }
      if (recent.length >= MAX_CODES_PER_HOUR) {
        throw new AppError('RATE_LIMITED', { reason: 'tooMany' });
      }

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const row = await prisma.emailCode.create({
        data: { email, codeHash: hashOf(email, code), expiresAt: new Date(now + CODE_TTL_MS) },
      });

      const delivery = {
        expiresInSeconds: CODE_TTL_MS / 1000,
        resendInSeconds: RESEND_AFTER_MS / 1000,
      };
      if (!env.RESEND_API_KEY) {
        if (env.NODE_ENV === 'production') {
          await prisma.emailCode.delete({ where: { id: row.id } });
          throw new AppError('EMAIL_NOT_SENT');
        }
        return { ...delivery, devCode: code };
      }
      const sent = await sendEmail(env, log, {
        to: email,
        ...codeEmail(code),
        idempotencyKey: `email-code/${row.id}`,
      });
      if (!sent) {
        // Not sent: it does not count against the limits.
        await prisma.emailCode.delete({ where: { id: row.id } });
        throw new AppError('EMAIL_NOT_SENT');
      }
      return delivery;
    },

    /** Checks the newest code for the email. Wrong tries count; the fifth kills the code. */
    async verify(email: string, code: string) {
      const row = await prisma.emailCode.findFirst({
        where: { email, usedAt: null, verifiedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (!row || row.expiresAt.getTime() <= Date.now()) {
        throw new AppError('WRONG_CODE', { reason: 'expired' });
      }
      if (row.attempts >= MAX_TRIES) {
        throw new AppError('WRONG_CODE', { reason: 'tooManyTries', triesLeft: 0 });
      }
      if (!sameHash(row.codeHash, hashOf(email, code))) {
        const updated = await prisma.emailCode.update({
          where: { id: row.id },
          data: { attempts: { increment: 1 } },
        });
        const triesLeft = Math.max(MAX_TRIES - updated.attempts, 0);
        throw new AppError('WRONG_CODE', {
          reason: triesLeft === 0 ? 'tooManyTries' : 'wrong',
          triesLeft,
        });
      }
      await prisma.emailCode.update({ where: { id: row.id }, data: { verifiedAt: new Date() } });
    },
  };
}
