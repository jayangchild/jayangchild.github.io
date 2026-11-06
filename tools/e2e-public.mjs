// 개발용: 처음 설정 전(keyring.json · access/ 가 아직 없음) 사이트를 처음 여는 방문자 시험. 헤드리스 Edge(Playwright).
//
//   node tools/e2e-public.mjs [결과폴더]     (PLAYWRIGHT_CORE=<playwright-core 폴더> 로 다른 곳의 것을 써도 된다)
//
// 이 저장소를 그대로 내주면 keyring.json · access/public/index.json 이 404 → 처음 설정 전과 같다.
// 휴대폰(400×850)·PC(1280×860) 에서, IndexedDB 가 보통일 때와 영영 열리지 않을 때(느리거나 막힌 브라우저) 모두
//   3초 안에 공개 화면(이름·소개·«로그인»·관리자용 «처음 설정»)이 보이고, «여는 중…» 에 머물지 않고,
//   위 막대 버튼이 화면 밖으로 잘리지 않는지 본다. 콘솔 오류(아직 없음 404 말고)·CSP 위반이 있으면 실패.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] || join(ROOT, 'tools', '_tmp-e2e-public'));
const PORT = 8870 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
await mkdir(OUT, { recursive: true });

const results = [];
function ok(name, cond, detail = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

// IndexedDB.open 이 끝나지 않는 브라우저 흉내 (성공도 실패도 오지 않음)
const STALL_IDB = () => {
  const never = () => { const req = {}; setTimeout(() => {}, 0); return req; };
  Object.defineProperty(window, 'indexedDB', { value: { open: never, deleteDatabase: never }, configurable: true });
};

const server = await serve(PORT);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const [w, h] of [[400, 850], [1280, 860], [360, 740]]) {
    for (const idb of ['보통', '안 열림']) {
      const tag = `${w}px · IndexedDB ${idb}`;
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      const problems = [];
      let notFound = 0;
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        if (/status of 404/.test(m.text())) { notFound++; return; } // keyring.json · access/public/index.json 아직 없음
        problems.push(m.text());
      });
      page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
      await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error('CSP', e.violatedDirective, e.blockedURI)));
      if (idb === '안 열림') await page.addInitScript(STALL_IDB);
      const t0 = Date.now();
      await page.goto(`${BASE}/`);
      let shown = true;
      try {
        await page.waitForFunction(() => {
          const v = document.querySelector('#view');
          const btn = [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim() === '로그인' && b.offsetParent);
          return v && v.querySelector('.pub-page') && btn && !/여는 중/.test(v.textContent);
        }, null, { timeout: 3000 });
      } catch { shown = false; }
      const ms = Date.now() - t0;
      ok(`${tag}: 3초 안에 공개 화면`, shown, `${ms}ms`);
      // «처음 설정» 은 keyring.json 404 를 받은 뒤 (조금 늦을 수 있음)
      const setup = await page.waitForSelector('[data-setup]', { timeout: 3000 }).then(() => true, () => false);
      ok(`${tag}: 관리자용 «처음 설정»`, setup);
      const info = await page.evaluate(() => {
        const cw = document.documentElement.clientWidth;
        const clipped = [...document.querySelectorAll('.topbar button, .topbar a')].filter((b) => {
          if (!b.offsetParent) return false;
          const r = b.getBoundingClientRect();
          return r.width && (r.right > cw + 0.5 || r.left < -0.5);
        }).map((b) => b.textContent.trim());
        return {
          clipped, wide: document.documentElement.scrollWidth > cw,
          title: document.querySelector('.hero h1')?.textContent || '',
          intro: document.querySelector('#pg-intro')?.textContent || '',
        };
      });
      ok(`${tag}: 이름·소개`, info.title.includes('자양교회 유년부') && info.intro.length > 10);
      ok(`${tag}: 위 막대 버튼이 잘리지 않음`, !info.clipped.length && !info.wide, info.clipped.join(',') || (info.wide ? '가로로 넘침' : ''));
      await page.screenshot({ path: join(OUT, `public-${w}-${idb === '보통' ? 'idb' : 'noidb'}.png`) });
      if (idb === '보통' && w === 400 && setup) {
        await page.click('[data-setup]');
        const gate = await page.waitForSelector('#gate:not([hidden]) [data-g=setup]', { state: 'attached', timeout: 5000 }).then(() => true, () => false);
        ok(`${tag}: «처음 설정» → 관리자 여는 화면`, gate);
        await page.screenshot({ path: join(OUT, 'public-setup-gate.png') });
      }
      ok(`${tag}: 콘솔 오류·CSP 위반 없음`, !problems.length, problems.join(' | ') + (notFound ? ` (아직 없음 404: ${notFound}번)` : ''));
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
const bad = results.filter((r) => !r.ok).length;
console.log(`\n${bad ? 'FAIL' : 'PASS'} ${results.length - bad}/${results.length}  (화면 사진: ${OUT})`);
process.exit(bad ? 1 : 0);
