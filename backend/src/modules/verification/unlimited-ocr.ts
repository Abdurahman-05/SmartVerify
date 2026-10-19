import { findReference, type PictureBank } from './ocr.js';

/** A self-hosted model on a GPU can be slow on the first picture. */
const TIMEOUT_MS = 45_000;

export class UnlimitedOcrError extends Error {}

/**
 * Reads a receipt picture with Baidu's Unlimited-OCR, served by vLLM / SGLang / Ollama behind an
 * OpenAI-compatible API (e.g. `vllm serve baidu/Unlimited-OCR` → http://host:8000/v1). It
 * returns the text only; the Transaction ID is found with the same check as Tesseract's.
 */
export async function readWithUnlimitedOcr(
  image: Buffer,
  mimeType: string,
  config: { url: string; model: string; apiKey?: string },
  bank: PictureBank = 'CBE'
): Promise<{ reference: string | null; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${config.url.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${image.toString('base64')}` },
              },
              { type: 'text', text: 'Read all the text in this image, line by line.' },
            ],
          },
        ],
      }),
    });
  } catch (error) {
    throw new UnlimitedOcrError(controller.signal.aborted ? 'timeout' : 'unreachable', {
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new UnlimitedOcrError(`http ${res.status}`);

  const body = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new UnlimitedOcrError('bad answer');
  return { reference: findReference(bank, text), text };
}
