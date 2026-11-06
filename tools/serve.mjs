// 개발용 정적 서버 (사이트는 쓰지 않는다). POST /__report 로 받은 시험 결과를 화면(콘솔)에 찍는다.
//   node tools/serve.mjs [port]        → http://127.0.0.1:8765/core-test.html?report
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.md': 'text/plain; charset=utf-8',
};

export function serve(port = 8765, { onReport } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === '/__report') {
      let body = '';
      for await (const c of req) body += c;
      try { onReport ? onReport(JSON.parse(body)) : console.log('[report]', JSON.parse(body).summary); } catch {}
      res.writeHead(204).end();
      return;
    }
    const p = normalize(join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
    if (!p.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const data = await readFile(p);
      res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: `"${data.length}"` });
      res.end(data);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = +(process.argv[2] || 8765);
  await serve(port);
  console.log(`http://127.0.0.1:${port}/`);
}
