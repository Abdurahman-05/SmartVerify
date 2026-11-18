import type { FastifyPluginAsync } from 'fastify';

import { LAST_UPDATED, sections, UI, type Contact, type Kind, type Lang } from './legal.content.js';

const CSS = `
:root{color-scheme:light dark;--bg:#fff;--fg:#1d1d1b;--muted:#5f625e;--line:#e4e2dc;--accent:#c04b0f}
@media(prefers-color-scheme:dark){:root{--bg:#161614;--fg:#f1efea;--muted:#a9aca6;--line:#2f2f2b;--accent:#f08a4b}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Ethiopic",sans-serif}
main{max-width:720px;margin:0 auto;padding:24px 18px 48px}
h1{font-size:1.7rem;line-height:1.25;margin:0 0 4px}
h2{font-size:1.2rem;margin:28px 0 6px}
.app,.updated{color:var(--muted);margin:0}
p{margin:8px 0}
ul{margin:8px 0;padding-left:22px}
li{margin:4px 0}
a{color:var(--accent)}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:8px 20px}
footer a{min-height:44px;display:inline-flex;align-items:center}
`;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Contact line: the email and each phone (SUPPORT_PHONE may list several, comma-separated) become links. */
function linkContact(text: string, c: Contact) {
  let out = esc(text).replace(esc(c.email), `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`);
  for (const phone of c.phone
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)) {
    out = out.replace(
      esc(phone),
      `<a href="tel:${esc(phone.replace(/\s/g, ''))}">${esc(phone)}</a>`
    );
  }
  return out;
}

function body(paragraphs: string[], c: Contact) {
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((li) => `<li>${li}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const p of paragraphs) {
    if (p.startsWith('- ')) {
      list.push(linkContact(p.slice(2), c));
    } else {
      flush();
      out.push(`<p>${linkContact(p, c)}</p>`);
    }
  }
  flush();
  return out.join('');
}

export function renderPage(kind: Kind, lang: Lang, c: Contact) {
  const ui = UI[lang];
  const suffix = lang === 'am' ? '/am' : '';
  const otherSuffix = lang === 'am' ? '' : '/am';
  const title = kind === 'terms' ? ui.terms : ui.privacy;
  const parts = sections(kind, lang, c)
    .map((s) => `<h2>${esc(s.h)}</h2>${body(s.p, c)}`)
    .join('');
  return `<!doctype html>
<html lang="${ui.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(ui.app)}</title>
<link rel="stylesheet" href="/legal.css">
</head>
<body>
<main>
<p class="app">${esc(ui.app)}</p>
<h1>${esc(title)}</h1>
<p class="updated">${esc(ui.updated)}: ${esc(LAST_UPDATED[lang])}</p>
${parts}
<footer>
<a href="/terms${suffix}">${esc(ui.terms)}</a>
<a href="/privacy${suffix}">${esc(ui.privacy)}</a>
<a href="/${kind}${otherSuffix}">${esc(ui.other)}</a>
</footer>
</main>
</body>
</html>`;
}

/** Public pages (no sign-in) for the app stores and the sign-up screen. */
export const legalRoutes: FastifyPluginAsync = async (app) => {
  const { COMPANY_NAME, SUPPORT_EMAIL, SUPPORT_PHONE } = app.env;
  const contact: Contact = { company: COMPANY_NAME, email: SUPPORT_EMAIL, phone: SUPPORT_PHONE };
  const cache = { 'cache-control': 'public, max-age=3600' };

  const pages: [string, Kind, Lang][] = [
    ['/terms', 'terms', 'en'],
    ['/terms/am', 'terms', 'am'],
    ['/privacy', 'privacy', 'en'],
    ['/privacy/am', 'privacy', 'am'],
  ];
  for (const [url, kind, lang] of pages) {
    const html = renderPage(kind, lang, contact);
    app.get(url, { schema: { hide: true } }, async (_request, reply) =>
      reply.headers(cache).type('text/html; charset=utf-8').send(html)
    );
  }
  app.get('/legal.css', { schema: { hide: true } }, async (_request, reply) =>
    reply.headers(cache).type('text/css; charset=utf-8').send(CSS)
  );
};
