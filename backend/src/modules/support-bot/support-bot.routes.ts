import { timingSafeEqual } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';

import { handleUpdate, type TgUpdate } from './support-bot.service.js';

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** POST /api/v1/support-bot/webhook: where Telegram delivers the bot's messages. */
export const supportBotRoutes: FastifyPluginAsync = async (app) => {
  const { SUPPORT_BOT_TOKEN, SUPPORT_CHAT_ID, SUPPORT_WEBHOOK_SECRET } = app.env;
  // Not configured: the route does not exist.
  if (!SUPPORT_BOT_TOKEN || !SUPPORT_CHAT_ID || !SUPPORT_WEBHOOK_SECRET) return;
  const config = {
    token: SUPPORT_BOT_TOKEN,
    teamChatId: SUPPORT_CHAT_ID,
    company: app.env.COMPANY_NAME,
    email: app.env.SUPPORT_EMAIL,
    phone: app.env.SUPPORT_PHONE,
  };

  app.post('/support-bot/webhook', { schema: { hide: true } }, async (request, reply) => {
    const secret = request.headers['x-telegram-bot-api-secret-token'];
    if (typeof secret !== 'string' || !same(secret, SUPPORT_WEBHOOK_SECRET)) {
      return reply.status(401).send();
    }
    // Answer Telegram at once; the relay runs after.
    void handleUpdate(config, (request.body ?? {}) as TgUpdate);
    return reply.status(200).send();
  });
};
