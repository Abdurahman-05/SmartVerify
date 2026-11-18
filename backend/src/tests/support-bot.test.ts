import { describe, expect, it } from 'vitest';

import {
  handleUpdate,
  received,
  type SupportBotConfig,
} from '../modules/support-bot/support-bot.service.js';

import { createTestApp } from './helpers.js';

const config: SupportBotConfig = {
  token: 'x'.repeat(20),
  teamChatId: '-100500',
  company: 'Gebtual',
  email: 'support@example.com',
  phone: '+251900000000',
};

function recorder(failCopy = false) {
  const calls: { method: string; body: Record<string, unknown> }[] = [];
  const call = async (method: string, body: Record<string, unknown>) => {
    calls.push({ method, body });
    return !(failCopy && method === 'copyMessage');
  };
  return { calls, call };
}

describe('support bot', () => {
  it('answers /start with the welcome and tells the team nothing', async () => {
    const { calls, call } = recorder();
    await handleUpdate(
      config,
      { message: { message_id: 1, chat: { id: 11, type: 'private' }, text: '/start' } },
      call
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body.chat_id).toBe(11);
    expect(String(calls[0]!.body.text)).toContain('support@example.com');
  });

  it('relays a customer text to the team with a tag, and acknowledges once', async () => {
    const { calls, call } = recorder();
    const update = {
      message: {
        message_id: 2,
        from: { id: 22, first_name: 'Abebe', username: 'abe' },
        chat: { id: 22, type: 'private' },
        text: 'My payment is not verified',
      },
    };
    await handleUpdate(config, update, call);
    await handleUpdate(config, update, call);
    const toTeam = calls.filter((c) => c.body.chat_id === '-100500');
    expect(toTeam).toHaveLength(2);
    expect(String(toTeam[0]!.body.text)).toMatch(/^#22 Abebe \(@abe\)\n\nMy payment/);
    const acks = calls.filter((c) => c.body.text === received);
    expect(acks).toHaveLength(1);
  });

  it('copies a picture with the tag as caption', async () => {
    const { calls, call } = recorder();
    await handleUpdate(
      config,
      {
        message: {
          message_id: 3,
          from: { id: 33, first_name: 'Sara' },
          chat: { id: 33, type: 'private' },
          caption: 'receipt',
        },
      },
      call
    );
    expect(calls[0]!.method).toBe('copyMessage');
    expect(String(calls[0]!.body.caption)).toBe('#33 Sara\n\nreceipt');
  });

  it('sends a team reply back to the tagged customer only', async () => {
    const { calls, call } = recorder();
    await handleUpdate(
      config,
      {
        message: {
          message_id: 9,
          chat: { id: -100500, type: 'supergroup' },
          text: 'Fixed, try again',
          reply_to_message: { text: '#22 Abebe\n\nhi' },
        },
      },
      call
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('copyMessage');
    expect(calls[0]!.body).toMatchObject({ chat_id: 22, from_chat_id: -100500, message_id: 9 });

    const none = recorder();
    await handleUpdate(
      config,
      {
        message: { message_id: 10, chat: { id: -100500, type: 'supergroup' }, text: 'team chat' },
      },
      none.call
    );
    expect(none.calls).toHaveLength(0);
  });

  it('ignores other groups pretending to be the team', async () => {
    const { calls, call } = recorder();
    await handleUpdate(
      config,
      {
        message: {
          message_id: 5,
          chat: { id: -999, type: 'supergroup' },
          text: 'x',
          reply_to_message: { text: '#22 hi' },
        },
      },
      call
    );
    expect(calls).toHaveLength(0);
  });
});

describe('support bot webhook', () => {
  it('is hidden until configured, and rejects a wrong secret when on', async () => {
    const off = await createTestApp();
    expect(
      (await off.inject({ method: 'POST', url: '/api/v1/support-bot/webhook', payload: {} }))
        .statusCode
    ).toBe(404);
    await off.close();

    const on = await createTestApp({
      SUPPORT_BOT_TOKEN: 'x'.repeat(20),
      SUPPORT_CHAT_ID: '-100500',
      SUPPORT_WEBHOOK_SECRET: 'a'.repeat(24),
    });
    const bad = await on.inject({
      method: 'POST',
      url: '/api/v1/support-bot/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'wrong' },
      payload: {},
    });
    expect(bad.statusCode).toBe(401);
    const ok = await on.inject({
      method: 'POST',
      url: '/api/v1/support-bot/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'a'.repeat(24) },
      payload: {},
    });
    expect(ok.statusCode).toBe(200);
    await on.close();
  });
});
