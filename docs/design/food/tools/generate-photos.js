// usage (from the repo root): node docs/design/food/tools/generate-photos.js <batch 01-06> <count>
// Generates, in Stitch (project "Gebtual Menu Photos"), the next <count> dishes of that batch that have no photo yet.
const fs = require('fs');
const os = require('os');
const path = require('path');
const [batch, count] = [process.argv[2], Number(process.argv[3] || 11)];
const key = require(os.homedir() + '/.claude.json').projects['C:/Users/HP/Desktop/smartVerify'].mcpServers.stitch.headers['X-Goog-Api-Key'];
const PROJECT = '14213200852666657849';
const ROOT = 'docs/design/food/stitch_gebtual_menu_photos';
const prompts = fs.readFileSync(`docs/design/flow/batch-${batch}-prompts.txt`, 'utf8').split(/\r?\n/).filter(Boolean);
const files = fs.readFileSync(`docs/design/flow/batch-${batch}-filenames.txt`, 'utf8').split(/\r?\n/).filter(Boolean)
  .map((l) => l.replace(/^\d+\.\s*/, '').replace(/\.png$/, '').replace(/-/g, '_'));
const todo = files.map((f, i) => ({ folder: f, prompt: prompts[i] }))
  .filter((x) => !fs.existsSync(path.join(ROOT, x.folder))).slice(0, count);
const call = async (name, args) => {
  const r = await fetch('https://stitch.googleapis.com/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'X-Goog-Api-Key': key },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }),
    signal: AbortSignal.timeout(600_000),
  });
  return JSON.parse((await r.text()).match(/\{.*\}/s)[0]);
};
(async () => {
  console.log('todo', todo.map((x) => x.folder).join(', '));
  for (const { folder, prompt } of todo) {
    try {
      const r = await call('generate_screen_from_text', { projectId: PROJECT, deviceType: 'AGNOSTIC', prompt: prompt + ' Output: one single square photo only, no app interface.' });
      const out = JSON.parse(r.result.content.map((c) => c.text || '').join(''));
      const screen = out.outputComponents.flatMap((o) => o.design?.screens ?? [])[0];
      const res = await fetch(screen.screenshot.downloadUrl, { headers: { 'X-Goog-Api-Key': key } });
      const raw = Buffer.from(await res.arrayBuffer());
      const buf = raw[0] === 0x7b ? Buffer.from(JSON.parse(raw.toString()).dataString, 'base64') : raw;
      fs.mkdirSync(path.join(ROOT, folder), { recursive: true });
      fs.writeFileSync(path.join(ROOT, folder, 'screen.jpg'), buf);
      console.log('OK', folder, screen.width + 'x' + screen.height);
    } catch (e) {
      console.log('FAIL', folder, String(e).slice(0, 200));
    }
  }
  console.log('done');
})();
