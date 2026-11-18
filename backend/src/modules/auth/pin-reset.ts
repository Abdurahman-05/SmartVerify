import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

import type { FastifyBaseLogger, FastifyInstance } from 'fastify';

import { emailProvider, sendEmail } from '../../services/email.js';
import { hashPin } from '../../services/pin-hasher.js';
import { AppError } from '../../shared/errors/app-error.js';

import { CODE_TTL_MS, MAX_CODES_PER_HOUR, MAX_TRIES, RESEND_AFTER_MS } from './email-code.js';

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

    /**
     * Sets a new PIN with the newest unused code for the email. Expired, used-up (5 wrong tries)
     * or missing codes are WRONG_CODE; a right code is spent at once and every session ends.
     * newPin must have the role's length (owner 6, manager 4), checked only after the code is
     * right and without spending it.
     */
    async reset(email: string, code: string, newPin: string) {
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
      const expected = resetCodeHash(email, code);
      const right =
        row.codeHash.length === expected.length &&
        timingSafeEqual(Buffer.from(row.codeHash), Buffer.from(expected));
      if (!right) {
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

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, membership: { select: { role: true, active: true } } },
      });
      const role = user?.membership?.active ? user.membership.role : null;
      if (!user || (role !== 'owner' && role !== 'manager')) {
        throw new AppError('WRONG_CODE', { reason: 'expired' });
      }
      const length = role === 'owner' ? 6 : 4;
      if (!new RegExp(`^\\d{${length}}$`).test(newPin)) {
        throw new AppError('VALIDATION_ERROR', { reason: 'pinLength', length });
      }

      const pinHash = await hashPin(newPin);
      await prisma.$transaction(async (tx) => {
        // Spent once, even if two resets arrive together.
        const claimed = await tx.emailCode.updateMany({
          where: { id: row.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (claimed.count === 0) throw new AppError('WRONG_CODE', { reason: 'expired' });
        await tx.user.update({ where: { id: user.id }, data: { pinHash, pinIsTemporary: false } });
        await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
    },
  };
}
