import path from 'node:path';

import { createWorker, type Worker } from 'tesseract.js';

/**
 * Text from a receipt screenshot (Tesseract, English). One worker is reused: starting one takes
 * a few seconds, and it reads one image at a time (later calls wait their turn). The English
 * data is downloaded once and kept in .cache/tesseract. Images are never stored.
 */
let worker: Promise<Worker> | null = null;

function getWorker() {
  worker ??= createWorker('eng', 1, {
    cachePath: path.resolve('.cache', 'tesseract'),
  }).catch((error: unknown) => {
    // Let the next request try again (e.g. the language data could not be downloaded).
    worker = null;
    throw error;
  });
  return worker;
}

export async function readImageText(image: Buffer): Promise<string> {
  const { data } = await (await getWorker()).recognize(image);
  return data.text;
}

export async function closeOcr() {
  const current = worker;
  worker = null;
  if (current) await (await current).terminate();
}

/** FT + 10 letters/digits, e.g. FT26286JZH4B. */
const REFERENCE = /FT[A-Z0-9]{10}/;

/**
 * The CBE Transaction ID in OCR text. Reading may split it ("FT26286 JZH4B"), so the text is
 * also tried without spaces. Letters O in the digit part are not guessed: the user confirms.
 */
export function findCbeReference(text: string): string | null {
  const upper = text.toUpperCase();
  const inLine = REFERENCE.exec(upper.replace(/[^A-Z0-9\s]/g, ' '));
  if (inLine) return inLine[0];
  const joined = REFERENCE.exec(upper.replace(/[^A-Z0-9]/g, ''));
  return joined ? joined[0] : null;
}

const MAGIC: [string, number[]][] = [
  ['png', [0x89, 0x50, 0x4e, 0x47]],
  ['jpeg', [0xff, 0xd8, 0xff]],
  ['webp', [0x52, 0x49, 0x46, 0x46]],
];

/** The picture's type from its first bytes (image/png, …), or null when it is not one we read. */
export function imageType(image: Buffer): string | null {
  const found = MAGIC.find(([, bytes]) => bytes.every((b, i) => image[i] === b));
  return found ? `image/${found[0]}` : null;
}

/** Only real PNG / JPEG / WebP pictures are read. */
export const isImage = (image: Buffer) => imageType(image) !== null;

/**
 * The Telebirr transaction number (10 letters/digits, e.g. DJD2QW8XTE) in text: from the
 * receipt link in the SMS, or after "transaction number" (SMS and app). Not guessed otherwise.
 */
export function findTelebirrNumber(text: string): string | null {
  const upper = text.toUpperCase();
  const fromLink = /RECEIPT\s*\/\s*([A-Z0-9]{10})\b/.exec(upper);
  if (fromLink?.[1]) return fromLink[1];
  const afterLabel = /TRANSACTION\s+(?:NUMBER|NO\.?)\s*(?:IS|:)?\s*([A-Z0-9]{10})\b/.exec(upper);
  return afterLabel?.[1] && /\d/.test(afterLabel[1]) && /[A-Z]/.test(afterLabel[1])
    ? afterLabel[1]
    : null;
}

/**
 * The Dashen FT Ref (e.g. C65WDTI262870002) in text: after "FT Ref" / "Transaction Reference",
 * or at the end of a receipts.dashenbanksc.com/receipt/ link. Not guessed otherwise.
 */
export function findDashenReference(text: string): string | null {
  const upper = text.toUpperCase();
  const m =
    /RECEIPT\s*\/\s*([A-Z0-9]{10,24})\b/.exec(upper) ??
    /(?:FT\s*REF|TRANSACTION\s+REFERENCE)\s*:?\s*([A-Z0-9]{10,24})\b/.exec(upper);
  const ref = m?.[1];
  return ref && /\d/.test(ref) && /[A-Z]/.test(ref) ? ref : null;
}

/**
 * BOA: the receipt id (FT reference + sender's last 5 digits) from the SMS link
 * (cs.bankofabyssinia.com/slip/?trx=FT26238SRG1T10431), else just the FT reference.
 */
export function findBoaReference(text: string): string | null {
  const upper = text.toUpperCase();
  const fromLink = /TRX\s*=\s*(FT[A-Z0-9]{10}\d{5})\b/.exec(upper);
  return fromLink?.[1] ?? findCbeReference(text);
}

export type PictureBank = 'CBE' | 'TEL' | 'DAS' | 'BOA';

/** Words that only one bank's receipts carry, strongest first. */
const BANK_WORDS: [PictureBank, RegExp][] = [
  ['TEL', /transactioninfo\.ethiotelecom|telebirr|ethio\s*telecom|ቴሌብር/i],
  ['DAS', /dashen|superapp|receipts\.dashenbanksc|ዳሽን/i],
  ['BOA', /abyssinia|bankofabyssinia|\bBoA\b|አቢሲኒያ/i],
  ['CBE', /commercial\s*bank\s*of\s*ethiopia|cbe\.com\.et|\bCBE\b|ኢትዮጵያ\s*ንግድ\s*ባንክ/i],
];

/** Which bank a receipt's text comes from, or null when it does not say. */
export function detectBank(text: string): PictureBank | null {
  return BANK_WORDS.find(([, words]) => words.test(text))?.[0] ?? null;
}

/** The reference to look for in a picture of this bank's receipt. */
export const findReference = (bank: PictureBank, text: string) =>
  bank === 'TEL'
    ? findTelebirrNumber(text)
    : bank === 'DAS'
      ? findDashenReference(text)
      : bank === 'BOA'
        ? findBoaReference(text)
        : findCbeReference(text);
