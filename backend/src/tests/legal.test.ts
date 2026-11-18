import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from './helpers.js';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp({
    COMPANY_NAME: 'Test <Co>',
    SUPPORT_EMAIL: 'help@example.com',
    SUPPORT_PHONE: '+251911000000',
  });
});
afterAll(async () => {
  await app.close();
});

describe('Terms and Privacy pages', () => {
  it.each([
    ['/terms', 'en', 'Terms of Service'],
    ['/terms/am', 'am', 'የአገልግሎት ውል'],
    ['/privacy', 'en', 'Privacy Policy'],
    ['/privacy/am', 'am', 'የግላዊነት ፖሊሲ'],
  ])('%s is public HTML in the right language', async (url, lang, title) => {
    const res = await app.inject({ method: 'GET', url });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain(`<html lang="${lang}">`);
    expect(res.body).toContain(title);
    expect(res.body).toContain('mailto:help@example.com');
    expect(res.body).toContain('Test &lt;Co&gt;');
    expect(res.body).toContain('/legal.css');
  });

  it('links between the pages and serves the shared CSS', async () => {
    const en = await app.inject({ method: 'GET', url: '/terms' });
    expect(en.body).toContain('href="/privacy"');
    expect(en.body).toContain('href="/terms/am"');
    const css = await app.inject({ method: 'GET', url: '/legal.css' });
    expect(css.statusCode).toBe(200);
    expect(css.headers['content-type']).toContain('text/css');
  });
});
