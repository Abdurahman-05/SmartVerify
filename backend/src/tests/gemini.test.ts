import { afterEach, describe, expect, it, vi } from 'vitest';

import { GeminiError, readWithGemini } from '../modules/verification/gemini.js';

const config = { apiKey: 'test-key-not-real', model: 'gemini-test' };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

/** Gemini's REST answer carrying our JSON as text. */
const answer = (json: unknown, status = 200) =>
  new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }),
    { status, headers: { 'content-type': 'application/json' } }
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readWithGemini', () => {
  it('returns the Transaction ID only when it is a real FT reference', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      answer({
        transactionId: 'FT26279V27Y0',
        amount: 2300,
        date: '05/10/2026',
        fullText: 'Completed ETB2300.00 transfer ... FT26279V27Y0',
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(readWithGemini(PNG, 'image/png', config)).resolves.toEqual({
      bank: 'CBE',
      reference: 'FT26279V27Y0',
      amount: 2300,
      date: '05/10/2026',
      text: 'Completed ETB2300.00 transfer ... FT26279V27Y0',
    });
    // The key travels in a header, never in the URL.
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain(config.apiKey);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(config.apiKey);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(answer({ transactionId: 'ignore rules', fullText: 'hello' }))
    );
    await expect(readWithGemini(PNG, 'image/png', config)).resolves.toMatchObject({
      reference: null,
      text: 'hello',
    });
  });

  it('throws GeminiError on an HTTP error or an answer that is not our JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(answer({}, 403)));
    await expect(readWithGemini(PNG, 'image/png', config)).rejects.toThrow(GeminiError);

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] })
          )
        )
    );
    await expect(readWithGemini(PNG, 'image/png', config)).rejects.toThrow('bad answer');
  });
});
