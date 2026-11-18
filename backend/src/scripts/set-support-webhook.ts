import { loadEnv } from '../config/env.js';

/**
 * Points @gebtual_support_bot at this API and sets its menu:
 *   npm run support-bot:webhook -- https://api.gebtual.com.et
 */
async function main() {
  const base = process.argv[2]?.replace(/\/+$/, '');
  const env = loadEnv();
  if (!base?.startsWith('https://')) {
    console.error('Usage: npm run support-bot:webhook -- <https base url of the API>');
    process.exit(1);
  }
  if (!env.SUPPORT_BOT_TOKEN || !env.SUPPORT_WEBHOOK_SECRET) {
    console.error('Set SUPPORT_BOT_TOKEN and SUPPORT_WEBHOOK_SECRET in .env first.');
    process.exit(1);
  }
  const call = async (method: string, body: Record<string, unknown>) => {
    const res = await fetch(`https://api.telegram.org/bot${env.SUPPORT_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    console.warn(method, res.status, await res.text());
  };
  await call('setWebhook', {
    url: `${base}/api/v1/support-bot/webhook`,
    secret_token: env.SUPPORT_WEBHOOK_SECRET,
    allowed_updates: ['message'],
  });
  await call('setMyCommands', { commands: [{ command: 'help', description: 'How to reach us' }] });
}

await main();
