import type { FastifyBaseLogger } from 'fastify';

import type { PrismaClient } from '../generated/prisma/client.js';

/** Expo's push service: it hands the message to Google (Android) or Apple. */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo takes up to 100 messages per request. */
const BATCH = 100;

type Data = Record<string, unknown>;
type Lang = 'en' | 'am';

const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const money = (v: unknown) => `${Number(v ?? 0).toLocaleString('en-US')} ETB`;

function orderLabel(d: Data, lang: Lang) {
  if (d.type === 'dine' && d.table !== null && d.table !== undefined) {
    return lang === 'am' ? `ጠረጴዛ ${str(d.table)}` : `Table ${str(d.table)}`;
  }
  const delivery = d.type === 'delivery';
  if (lang === 'am') return `${delivery ? 'ዴሊቨሪ' : 'ለመውሰድ'} #${str(d.orderNo)}`;
  return `${delivery ? 'Delivery' : 'Takeaway'} #${str(d.orderNo)}`;
}

/**
 * The lock-screen text (the app's inbox writes its own from the same values). Short: the phone
 * cuts long lines. Unknown types get no push.
 */
export function pushText(
  type: string,
  d: Data,
  lang: Lang
): { title: string; body: string } | null {
  const am = lang === 'am';
  const label = orderLabel(d, lang);
  const n = str(d.orderNo);
  switch (type) {
    case 'new_order':
      return am
        ? { title: `አዲስ ትዕዛዝ · ${label}`, body: `${str(d.items)} ዕቃ · ትዕዛዝ #${n}` }
        : { title: `New order · ${label}`, body: `${str(d.items)} item(s) · order #${n}` };
    case 'order_added':
      return am
        ? { title: `ተጨማሪ ዕቃዎች · ${label}`, body: `${str(d.items)} ዕቃ · ትዕዛዝ #${n}` }
        : { title: `More items · ${label}`, body: `${str(d.items)} item(s) · order #${n}` };
    case 'order_changed':
      return am
        ? { title: `ትዕዛዝ ተቀይሯል · ${label}`, body: `ትዕዛዝ #${n}፦ ቲኬቱን ይመልከቱ` }
        : { title: `Order changed · ${label}`, body: `Order #${n}: check the ticket` };
    case 'order_cancelled':
      return am
        ? { title: `ትዕዛዝ ተሰርዟል · ${label}`, body: `ትዕዛዝ #${n}፦ ${str(d.reason)}` }
        : { title: `Order cancelled · ${label}`, body: `Order #${n}: ${str(d.reason)}` };
    case 'order_ready':
      return am
        ? { title: `ምግብ ተዘጋጅቷል · ${label}`, body: `ትዕዛዝ #${n} ለማቅረብ ዝግጁ ነው` }
        : { title: `Food ready · ${label}`, body: `Order #${n} is ready to serve` };
    case 'big_payment':
      return am
        ? {
            title: `ትልቅ ክፍያ፦ ${money(d.amountEtb)}`,
            body: `ከ${str(d.payerName)} · ${str(d.bankCode)}`,
          }
        : {
            title: `Big payment: ${money(d.amountEtb)}`,
            body: `From ${str(d.payerName)} · ${str(d.bankCode)}`,
          };
    case 'bad_receipt':
      return am
        ? { title: 'አጠራጣሪ ደረሰኝ', body: `በ${str(d.checkedBy)} ተረጋግጧል · ${str(d.bankCode)}` }
        : {
            title: 'Suspicious receipt',
            body: `Checked by ${str(d.checkedBy)} · ${str(d.bankCode)}`,
          };
    case 'daily_summary':
      return am
        ? { title: 'የዛሬ ክፍያዎች', body: `${str(d.count)} የተረጋገጡ ክፍያዎች · ${money(d.totalEtb)}` }
        : { title: "Today's payments", body: `${str(d.count)} verified · ${money(d.totalEtb)}` };
    case 'plan_ending':
      return am
        ? { title: `ፕላንዎ በ${str(d.daysLeft)} ቀን ያበቃል`, body: 'ያለ መቋረጥ ለማረጋገጥ አሁን ይክፈሉ' }
        : {
            title: `Your plan ends in ${str(d.daysLeft)} day(s)`,
            body: 'Pay now to keep verifying',
          };
    case 'plan_late':
      return am
        ? { title: 'ፕላንዎ አብቅቷል', body: 'ሁሉንም መልሶ ለማብራት ይክፈሉ' }
        : { title: 'Your plan has ended', body: 'Pay to turn everything back on' };
    default:
      return null;
  }
}

/**
 * Push to every phone where these members are signed in. Never throws: a phone that is gone
 * (uninstalled, signed out of push) is forgotten; anything else is only logged.
 */
export async function sendPush(
  prisma: PrismaClient,
  log: FastifyBaseLogger | undefined,
  input: { memberIds: string[]; type: string; data: Data }
) {
  // Tests never call Expo.
  if (process.env.NODE_ENV === 'test' || input.memberIds.length === 0) return;
  try {
    const tokens = await prisma.pushToken.findMany({
      where: {
        memberId: { in: input.memberIds },
        session: { revokedAt: null, expiresAt: { gt: new Date() } },
      },
      select: { token: true, language: true },
    });
    const messages = tokens.flatMap((t) => {
      const text = pushText(input.type, input.data, t.language === 'am' ? 'am' : 'en');
      return text
        ? [
            {
              to: t.token,
              sound: 'default',
              priority: 'high',
              channelId: 'alerts',
              ...text,
              data: { type: input.type },
            },
          ]
        : [];
    });
    for (let i = 0; i < messages.length; i += BATCH) {
      const batch = messages.slice(i, i + BATCH);
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      });
      const result = (await response.json().catch(() => null)) as {
        data?: { status: string; details?: { error?: string } }[];
      } | null;
      // A phone that no longer accepts pushes: stop sending to it.
      const gone = (result?.data ?? []).flatMap((ticket, j) =>
        ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
          ? [batch[j]?.to ?? '']
          : []
      );
      if (gone.length) await prisma.pushToken.deleteMany({ where: { token: { in: gone } } });
      if (!response.ok) log?.warn({ status: response.status }, 'push service answered an error');
    }
  } catch (error) {
    log?.warn({ err: error, type: input.type }, 'could not send push notifications');
  }
}
