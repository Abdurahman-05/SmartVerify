import { createHash, randomInt } from 'node:crypto';

import type { FastifyBaseLogger, FastifyInstance } from 'fastify';

import { emailProvider, sendEmail } from '../../services/email.js';
import { AppError } from '../../shared/errors/app-error.js';

import { CODE_TTL_MS, MAX_CODES_PER_HOUR, RESEND_AFTER_MS } from './email-code.js';

/**
 * Reset codes live in the EmailCode table next to sign-up codes, hashed with their own prefix so
 * a reset code can never pass as a sign-up proof (POST /auth/verify-email) or the reverse.
 */
export const resetCodeHash = (email: string, code: string) =>
  createHash('sha256').update(`pin-reset:${email}:${code}`).digest('hex');

function resetEmail(code: string) {
  const subject = `Your Gebtual PIN reset code: ${code}`;
  const text =
    `Your Gebtual PIN reset code is ${code}. It works for 10 minutes.\n` +
    `የGebtual የፒን መቀየሪያ ኮድዎ ${code} ነው። ለ10 ደቂቃ ይሰራል።\n\n` +
    'If you did not ask for this, ignore this email: your PIN has not changed.';
  const html =
    '<div style="font-family:Arial,sans-serif;font-size:16px;color:#1E1A1C">' +
    '<p>Your Gebtual PIN reset code is:</p>' +
    `<p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>` +
    '<p>It works for 10 minutes.</p>' +
    `<p>የGebtual የፒን መቀየሪያ ኮድዎ <b>${code}</b> ነው። ለ10 ደቂቃ ይሰራል።</p>` +
    '<p style="color:#6B6266;font-size:13px">If you did not ask for this, ignore this email: ' +
    'your PIN has not changed.</p>' +
    '</div>';
  return { subject, text, html };
}

export function createPinReset(app: FastifyInstance) {
  const { prisma, env } = app;

  return {
    /**
     * Emails a 6-digit reset code to an active owner or manager. The answer is the same whether
     * or not the email has an account (nobody can test which emails exist), and a request too
     * soon after the last one is silently skipped. Without an email provider (development only)
     * the code is written to the server log; production without one refuses.
     */
    async send(email: string, log: FastifyBaseLogger) {
      const provider = emailProvider(env);
      if (!provider && env.NODE_ENV === 'production') throw new AppError('EMAIL_NOT_SENT');
      const answer = { resendInSeconds: RESEND_AFTER_MS / 1000 };

      const user = await prisma.user.findUnique({
        where: { email },
        select: { membership: { select: { role: true, active: true, business: true } } },
      });
      const member = user?.membership;
      const canReset =
        member &&
        member.active &&
        !member.business.deactivatedAt &&
        (member.role === 'owner' || member.role === 'manager');
      if (!canReset) return answer;

      const now = Date.now();
      const recent = await prisma.emailCode.findMany({
        where: { email, createdAt: { gte: new Date(now - 3_600_000) } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      const last = recent[0];
      if (last && now - last.createdAt.getTime() < RESEND_AFTER_MS) return answer;
      if (recent.length >= MAX_CODES_PER_HOUR) return answer;

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const row = await prisma.emailCode.create({
        data: {
          email,
          codeHash: resetCodeHash(email, code),
          expiresAt: new Date(now + CODE_TTL_MS),
        },
      });
      if (!provider) {
        log.info({ pinResetCode: code }, 'PIN reset code (no email provider, development only)');
        return answer;
      }
      const sent = await sendEmail(env, log, {
        to: email,
        ...resetEmail(code),
        idempotencyKey: `pin-reset/${row.id}`,
      });
      if (!sent) {
        await prisma.emailCode.delete({ where: { id: row.id } });
        throw new AppError('EMAIL_NOT_SENT');
      }
      return answer;
    },
  };
}
