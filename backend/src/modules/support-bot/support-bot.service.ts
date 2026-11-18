/**
 * @gebtual_support_bot. A customer writes to the bot; the message is copied into the team group
 * with a tag (#<chat id>). A team member REPLIES to that message in the group and the answer goes
 * back to the customer. Nothing is stored: the tag in the message is the link.
 */
export interface SupportBotConfig {
  token: string;
  /** The team group (the bot is a member). Only this chat may answer customers. */
  teamChatId: string;
  company: string;
  email: string;
  phone: string;
}

interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}
interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
  reply_to_message?: { text?: string; caption?: string };
}
export interface TgUpdate {
  message?: TgMessage;
}

type Call = (method: string, body: Record<string, unknown>) => Promise<boolean>;

const TAG = /#(\d{1,15})\b/;
/** The customer gets the "we got it" note at most once per this long. */
const ACK_EVERY_MS = 30 * 60_000;
const lastAck = new Map<number, number>();

export const welcome = (c: SupportBotConfig) =>
  `Hello! This is ${c.company} support. Write your question here (you can send a picture too) and our team will answer you in this chat.\n\n` +
  `ሰላም! ይህ የ${c.company} የደንበኛ ድጋፍ ነው። ጥያቄዎን እዚህ ይጻፉ (ፎቶም መላክ ይችላሉ)፤ ቡድናችን በዚሁ ቻት ይመልስልዎታል።\n\n` +
  `${c.email} · ${c.phone}`;

export const received =
  'Thanks, we got your message. We will reply here soon.\nአመሰግናለሁ፣ መልዕክትዎ ደርሶናል። በቅርቡ እዚሁ እንመልሳለን።';

const nameOf = (u?: TgUser) =>
  [u?.first_name, u?.last_name].filter(Boolean).join(' ') || 'Customer';

function makeCall(token: string): Call {
  return async (method, body) => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  };
}

/** Handles one Telegram update. Never throws (Telegram would retry the same update forever). */
export async function handleUpdate(
  config: SupportBotConfig,
  update: TgUpdate,
  call: Call = makeCall(config.token)
): Promise<void> {
  const m = update.message;
  if (!m) return;
  try {
    if (String(m.chat.id) === config.teamChatId) {
      await fromTeam(m, call);
    } else if (m.chat.type === 'private') {
      await fromCustomer(config, m, call);
    }
  } catch {
    // Best effort.
  }
}

async function fromCustomer(config: SupportBotConfig, m: TgMessage, call: Call) {
  const chatId = m.chat.id;
  if (m.text && /^\/(start|help)(@\w+)?(\s|$)/.test(m.text)) {
    await call('sendMessage', { chat_id: chatId, text: welcome(config) });
    return;
  }
  const who = m.from?.username ? `${nameOf(m.from)} (@${m.from.username})` : nameOf(m.from);
  const head = `#${chatId} ${who}`;
  let sent: boolean;
  if (m.text) {
    sent = await call('sendMessage', {
      chat_id: config.teamChatId,
      text: `${head}\n\n${m.text}`.slice(0, 4096),
    });
  } else {
    // Pictures, documents, voice: copied with the tag as the caption.
    const caption = `${head}${m.caption ? `\n\n${m.caption}` : ''}`.slice(0, 1024);
    sent = await call('copyMessage', {
      chat_id: config.teamChatId,
      from_chat_id: chatId,
      message_id: m.message_id,
      caption,
    });
    if (!sent) {
      // Types without a caption (sticker, location): a tagged note, then the copy.
      sent = await call('sendMessage', { chat_id: config.teamChatId, text: head });
      if (sent) {
        await call('copyMessage', {
          chat_id: config.teamChatId,
          from_chat_id: chatId,
          message_id: m.message_id,
        });
      }
    }
  }
  const now = Date.now();
  if (sent && now - (lastAck.get(chatId) ?? 0) > ACK_EVERY_MS) {
    lastAck.set(chatId, now);
    await call('sendMessage', { chat_id: chatId, text: received });
  }
}

async function fromTeam(m: TgMessage, call: Call) {
  const quoted = m.reply_to_message;
  const id = (quoted?.text ?? quoted?.caption ?? '').match(TAG)?.[1];
  // Only replies to a tagged customer message are sent out; other group chat stays in the group.
  if (!id) return;
  const ok = await call('copyMessage', {
    chat_id: Number(id),
    from_chat_id: m.chat.id,
    message_id: m.message_id,
  });
  if (!ok) {
    await call('sendMessage', {
      chat_id: m.chat.id,
      text: 'Could not deliver: the customer may have blocked the bot.',
      reply_parameters: { message_id: m.message_id },
    });
  }
}
