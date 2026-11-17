import type { FastifyBaseLogger } from 'fastify';

import type { Env } from '../config/env.js';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Same key within 24 h = Resend sends it only once (safe to retry). */
  idempotencyKey: string;
}

/**
 * Sends one email with Resend (HTTP API, no SDK). Returns false when it could not be sent.
 * Without RESEND_API_KEY (development and tests) nothing is sent and the caller decides.
 */
export async function sendEmail(
  env: Pick<Env, 'RESEND_API_KEY' | 'EMAIL_FROM'>,
  log: FastifyBaseLogger,
  email: OutgoingEmail
): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
        'idempotency-key': email.idempotencyKey,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Status and Resend's error name only: never the address or the message.
      const body = (await res.json().catch(() => ({}))) as { name?: string };
      log.error({ status: res.status, resendError: body.name }, 'email not sent');
      return false;
    }
    return true;
  } catch (error) {
    log.error({ err: error }, 'email not sent (network)');
    return false;
  }
}
