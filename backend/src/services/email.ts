import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
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

type EmailEnv = Pick<Env, 'EMAIL_PROVIDER' | 'RESEND_API_KEY' | 'EMAIL_FROM' | 'SES_REGION'>;

/** Which provider sends (SES when asked for, else Resend when it has a key), or null for none. */
export const emailProvider = (env: EmailEnv): 'ses' | 'resend' | null =>
  env.EMAIL_PROVIDER === 'ses' ? 'ses' : env.RESEND_API_KEY ? 'resend' : null;

let ses: SESv2Client | undefined;

/** Amazon SES: credentials come from the server's AWS role (nothing stored in the app). */
async function sendWithSes(env: EmailEnv, log: FastifyBaseLogger, email: OutgoingEmail) {
  ses ??= new SESv2Client({ region: env.SES_REGION });
  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: env.EMAIL_FROM,
        Destination: { ToAddresses: [email.to] },
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: email.text, Charset: 'UTF-8' },
              Html: { Data: email.html, Charset: 'UTF-8' },
            },
          },
        },
      })
    );
    return true;
  } catch (error) {
    // The error name only (e.g. MessageRejected in the sandbox): never the address or message.
    log.error({ sesError: error instanceof Error ? error.name : 'unknown' }, 'email not sent');
    return false;
  }
}

/**
 * Sends one email (Amazon SES or Resend, see emailProvider). Returns false when it could not be
 * sent. With no provider (development and tests) nothing is sent and the caller decides.
 */
export async function sendEmail(
  env: EmailEnv,
  log: FastifyBaseLogger,
  email: OutgoingEmail
): Promise<boolean> {
  const provider = emailProvider(env);
  if (!provider) return false;
  if (provider === 'ses') return sendWithSes(env, log, email);
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
