// 개발용 전체 시험 (사이트는 쓰지 않는다). 진짜 GitHub 대신 core 의 가짜 저장소(js/core/fake-backend.js)를
// Node 에 하나 두고, 두 브라우저(두 기기)가 같이 쓴다. 헤드리스 Edge(Playwright)로 돌린다.
//
//   npm i --no-save playwright-core     (한 번)
//   node tools/e2e.mjs [결과폴더]         (PLAYWRIGHT_CORE=<playwright-core 폴더> 로 다른 곳의 것을 써도 된다)
//
// 하는 일: core-test.html → 예전(암호화 안 된) 데이터가 있는 기기에서 처음 설정 → 복구 코드 확인 → 예전 데이터 옮기기
//   → CSV·PPTX 가져오기 → 11·12월 인쇄 미리보기를 pilsa/monthly.html 과 나란히 찍기 → 디자인 그림 올리기
//   → 둘째 기기가 QR 링크로 연결 → 오프라인에서 둘 다 고치기 → 다시 연결 → 같아지는지, 충돌 표시·고르기, 휴지통·되살리기
//   → 둘째 기기의 인쇄 미리보기(첫째 기기가 올린 그림 포함) → 잠그기/열기. 화면 사진: 결과폴더/*.png
// 콘솔 오류와 CSP 위반이 하나라도 있으면 실패.

import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';
import { FakeRepo } from '../js/core/fake-backend.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const JSZip = require('../js/vendor/jszip.min.js');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MONTHLY = process.env.MONTHLY || 'D:/dev/AI-Projects/pilsa/monthly.html';
const OUT = resolve(process.argv[2] || join(ROOT, 'tools', '_tmp-e2e'));
const PORT = 8770 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const PW = 'jayang-yunyeon-2026';
await mkdir(OUT, { recursive: true });

const results = [];
const problems = []; // 콘솔 오류 · CSP 위반
const shots = [];
function note(name, cond, detail = '') {
  results.push({ name, ok: true, soft: !cond, detail });
  console.log(`${cond ? 'PASS' : 'NOTE'} ${name}${detail ? ' — ' + detail : ''}`);
}
function ok(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!cond) throw new Error(`실패: ${name} ${detail}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 가짜 GitHub (Node 의 FakeRepo 를 브라우저에서 부른다) ----------

const TEST_INDEX = `// 시험용 core (tools/e2e.mjs 가 js/core/index.js 대신 준다)
import { createCore } from './core.js';
import { BackendError } from './github.js';
import { b64, unb64 } from './crypto.js';
const call = async (...a) => { const r = await window.__fake(...a); if (r && r.err != null) throw new BackendError(r.err, r.msg); return r; };
const backend = (token) => ({
  token,
  check: () => call('check', token),
  tree: () => call('tree', token),
  get: async (p) => { const r = await call('get', token, p); return r ? { sha: r.sha, bytes: unb64(r.b64) } : null; },
  put: (p, bytes, sha) => call('put', token, p, b64(bytes), sha || null),
});
export * from './core.js';
const core = createCore({ backend, syncDelay: 200, pollMs: 1500, siteUrl: location.origin + '/' });
export default core;
`;

async function fakeCall(repo, op, token, ...a) {
  const c = repo.client(token);
  try {
    if (op === 'check') return await c.check();
    if (op === 'tree') return await c.tree();
    if (op === 'get') { const r = await c.get(a[0]); return r ? { sha: r.sha, b64: Buffer.from(r.bytes).toString('base64') } : null; }
    if (op === 'put') return await c.put(a[0], new Uint8Array(Buffer.from(a[1], 'base64')), a[2]);
    return { err: 400, msg: `bad op ${op}` };
  } catch (e) {
    return { err: e.status ?? 500, msg: e.message };
  }
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });

async function device(name, repo, { phone = false } = {}) {
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 400, height: 850 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }
    : { viewport: { width: 1280, height: 860 } });
  await ctx.exposeFunction('__fake', (op, token, ...a) => fakeCall(repo, op, token, ...a));
  await ctx.route('**/js/core/index.js', (r) => r.fulfill({ body: TEST_INDEX, contentType: 'text/javascript; charset=utf-8' }));
  await ctx.addInitScript(() => {
    addEventListener('securitypolicyviolation', (e) => console.error(`CSP 위반: ${e.violatedDirective} ${e.blockedURI}`));
  });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${name}] console: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  page.name = name;
  return page;
}

// 같은 문서 안에서 #주소만 바꾸고 다 그릴 때까지 기다린다
async function nav(page, hash) {
  await page.evaluate((h) => {
    document.body.dataset.ready = '';
    if (location.hash === h) dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = h;
  }, hash);
  await ready(page);
}
// 지금 올리고 받기 (자동 동기화를 기다리지 않고)
const syncNow = (page) => page.evaluate(async () => (await import('/js/store.js')).core.sync().then((s) => s.state));
const ready = (page) => page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 30000 });
const synced = (page) => page.waitForFunction(() => document.querySelector('#sync-chip')?.textContent.includes('저장됨'), null, { timeout: 30000 });
async function shot(page, file, opts = {}) {
  const p = join(OUT, file);
  await page.screenshot({ path: p, ...opts });
  shots.push(p);
}
// (CSP 가 eval 을 막으므로 함수를 그대로 넘긴다)
const lessonsOf = (page) => page.evaluate(async () => { const m = await import('/js/store.js'); return m.S.data.items.lessons.map(({ id, no, kind, title, date, ref, lines, term, _conflicts }) => ({ id, no, kind, title, date, ref, lines, term, c: (_conflicts || []).length })).sort((a, b) => (a.id < b.id ? -1 : 1)); });
// 두 PNG 에서 눈에 띄게 다른 픽셀의 비율 (글자 가장자리의 아주 작은 차이는 무시)
async function pixelDiff(a, b) {
  const pg = await browser.newPage();
  const r = await pg.evaluate(async ([x, y]) => {
    const load = async (s) => createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob());
    const [ia, ib] = [await load(x), await load(y)];
    if (ia.width !== ib.width || ia.height !== ib.height) return 1;
    const px = (im) => { const c = new OffscreenCanvas(im.width, im.height); const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data; };
    const [da, db] = [px(ia), px(ib)];
    let n = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 48) n++;
    return n / (da.length / 4);
  }, [a.toString('base64'), b.toString('base64')]);
  await pg.close();
  return r;
}
async function choose(page, click, files) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), click()]);
  await fc.setFiles(files);
}

const server = await serve(PORT, { onReport: (r) => { reported = r; } });
let reported = null;

try {
  // ---------- 1. core-test.html ----------
  {
    const p = await device('core-test', new FakeRepo());
    await p.goto(`${BASE}/core-test.html?report`);
    await p.waitForFunction(() => document.body.dataset.done, null, { timeout: 120000 });
    const done = await p.evaluate(() => document.body.dataset.done);
    for (let i = 0; i < 20 && !reported; i++) await sleep(100);
    ok('core-test.html', done.startsWith('PASS'), `${done} (POST /__report: ${reported?.summary || '없음'})`);
    await p.context().close();
  }

  // ---------- 2. 휴대폰 폭: 여는 화면 사진 (따로 쓰는 빈 저장소) ----------
  {
    const repo2 = new FakeRepo(['tok-phone']);
    const p = await device('phone-setup', repo2, { phone: true });
    await p.goto(`${BASE}/`);
    await p.waitForSelector('#gate-card h1');
    await shot(p, 'phone-1-welcome.png', { fullPage: true });
    await p.click('details.admin summary');
    await p.click('[data-g=setup]');
    await shot(p, 'phone-2-setup.png', { fullPage: true });
    await p.fill('#f-setup [name=token]', 'tok-phone');
    await p.fill('#f-setup [name=pw]', PW);
    await p.fill('#f-setup [name=pw2]', PW);
    await p.fill('#f-setup [name=user]', '관리자');
    await p.click('#f-setup button[type=submit]');
    await p.waitForSelector('#rc-text', { timeout: 30000 });
    await shot(p, 'phone-3-recovery-code.png', { fullPage: true });
    const code = await p.textContent('#rc-text');
    await p.check('#rc-ok');
    await p.fill('#rc-last', code.replace(/[^A-Z0-9]/gi, '').slice(-4));
    await p.click('#rc-next');
    await ready(p);
    await shot(p, 'phone-4-app.png');
    await p.click('#settings-btn');
    await p.click('[data-s=lock]');
    await p.waitForSelector('#f-unlock');
    ok('휴대폰: 이 기기 기억하기 기본 꺼짐', !(await p.isChecked('#f-unlock [name=remember]')));
    await shot(p, 'phone-5-unlock.png', { fullPage: true });
    await p.context().close();
  }

  // ---------- 3. 기기 A (PC): 예전 데이터 + 처음 설정 ----------
  const repo = new FakeRepo(['tok-A']);
  const A = await device('A', repo);
  const png = await A.evaluate(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 240, height: 160 });
    const g = c.getContext('2d');
    g.fillStyle = '#2f7a5b'; g.beginPath(); g.ellipse(120, 80, 110, 70, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2c14e'; g.fillRect(100, 20, 40, 120);
    return c.toDataURL('image/png');
  });
  const pngBuf = Buffer.from(png.split(',')[1], 'base64');
  // 예전 버전(동기화 전)이 이 브라우저에 남긴 암호화 안 된 데이터
  await A.goto(`${BASE}/js/core/README.md`);
  await A.evaluate(async (png) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('jayangchild', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const bin = atob(png.split(',')[1]);
    const blob = new Blob([Uint8Array.from(bin, (ch) => ch.charCodeAt(0))], { type: 'image/png' });
    const t = db.transaction('kv', 'readwrite');
    const s = t.objectStore('kv');
    s.put([{ id: 'legacy1', kind: 'special', term: '2027-1', title: '겨울성경학교 말씀 필사', date: '2027-01-03', month: 1, ref: '요한복음 3:16', lines: ['하나님이 세상을 이처럼 사랑하사', '독생자를 주셨으니'], at: '2026-10-01T00:00:00.000Z' }], 'd:lessons');
    s.put([{ id: 'm1', hideBuiltin: false, images: [{ id: 'legim', file: 'legacyimg1', slot: 'br', dx: 0, dy: 0, scale: 1 }] }], 'd:themes');
    s.put([{ id: 'legacyimg1', name: 'snow.png', type: 'image/png', size: blob.size, w: 240, h: 160, at: '2026-10-01T00:00:00.000Z' }], 'd:files');
    s.put({ v: 1, firstSunday: { '2027-1': '2027-01-03' } }, 'd:sys');
    s.put(blob, 'b:legacyimg1');
    s.put(['data/lessons.json', 'f/legacyimg1'], 'dirty');
    await new Promise((r) => { t.oncomplete = r; });
    db.close();
  }, png);

  await A.goto(`${BASE}/`);
  await A.waitForSelector('#gate-card h1');
  ok('연결 화면: 예전 데이터 안내', (await A.textContent('#gate-card')).includes('예전에 저장한 필사노트'));
  await shot(A, 'pc-1-welcome.png');
  await A.click('details.admin summary');
  await A.click('[data-g=setup]');
  await shot(A, 'pc-2-setup.png', { fullPage: true });
  await A.fill('#f-setup [name=token]', 'tok-A');
  await A.fill('#f-setup [name=pw]', PW);
  await A.fill('#f-setup [name=pw2]', 'different-pw');
  await A.fill('#f-setup [name=user]', '관리자');
  await A.click('#f-setup button[type=submit]');
  await A.waitForFunction(() => document.querySelector('#f-setup .err')?.textContent.includes('서로 달라요'));
  await A.fill('#f-setup [name=pw2]', PW);
  await A.click('#f-setup button[type=submit]');
  await A.waitForSelector('#rc-text', { timeout: 30000 });
  await shot(A, 'pc-3-recovery-code.png', { fullPage: true });
  const code = await A.textContent('#rc-text');
  ok('복구 코드 모양', /^[A-Z0-9]{4}(-[A-Z0-9]{4}){5}$/.test(code.trim()), code);
  ok('복구 코드: 확인 전에는 계속 못 함', await A.isDisabled('#rc-next'));
  await A.check('#rc-ok');
  await A.fill('#rc-last', 'ZZZZ');
  ok('복구 코드: 마지막 4글자가 틀리면 못 함', await A.isDisabled('#rc-next'));
  await A.fill('#rc-last', code.replace(/[^A-Z0-9]/gi, '').slice(-4).toLowerCase());
  ok('복구 코드: 맞게 넣으면 계속', !(await A.isDisabled('#rc-next')));
  await A.click('#rc-next');
  await ready(A);
  ok('vault.json 이 저장소에 생김', repo.files.has('vault.json'));

  // 예전 데이터가 옮겨졌는가 → 예전 사본은 지워졌는가
  await A.waitForFunction(async () => (await import('/js/store.js')).S.data.items.lessons.some((v) => v.id === 'legacy1'));
  const mig = await A.evaluate(async () => {
    const m = await import('/js/store.js');
    const blob = await m.getFile('legacyimg1');
    const legacy = await m.legacyInfo();
    return { theme: m.S.data.items.themes.find((t) => t.id === 'm1')?.images?.length, blob: blob?.size || 0, legacy, fs: m.S.data.sys.firstSunday };
  });
  ok('예전 데이터 옮기기: 말씀·디자인·그림·학기 설정', mig.theme === 1 && mig.blob > 0 && mig.fs['2027-1'] === '2027-01-03', JSON.stringify(mig));
  ok('예전(암호화 안 된) 사본은 옮긴 뒤에 지움', mig.legacy === null);

  // ---------- 4. CSV · PPTX 가져오기 ----------
  const DATA = [
    [45, '2026-11-08', '빌립보서 4:4', ['주 안에서 항상 기뻐하라', '내가 다시 말하노니 기뻐하라']],
    [46, '2026-11-15', '누가복음 17:15-16', ['그 중의 한 사람이 자기가 나은 것을 보고 큰 소리로 하나님께', '영광을 돌리며 돌아와 예수의 발 아래에 엎드리어 감사하니', '그는 사마리아 사람이라']],
    [47, '2026-11-22', '마태복음 5:9', ['화평하게 하는 자는 복이 있나니 그들이', '하나님의 아들이라 일컬음을 받을 것임이요']],
    [48, '2026-11-29', '마태복음 1:16', ['야곱은 마리아의 남편 요셉을 낳았으니', '마리아에게서 그리스도라 칭하는 예수가 나시니라']],
    [49, '2026-12-06', '마태복음 1:23', ['보라 처녀가 잉태하여 아들을 낳을 것이요', '그의 이름은 임마누엘이라 하리라', '하셨으니 이를 번역한즉 하나님이 우리와 함께 계시다 함이라']],
    [50, '2026-12-13', '누가복음 1:31', ['보라 네가 잉태하여 아들을 낳으리니', '그 이름을 예수라 하라']],
    [51, '2026-12-20', '마태복음 2:11', ['집에 들어가 아기와 그의 어머니 마리아가 함께 있는 것을 보고', '엎드려 아기께 경배하고 보배합을 열어', '황금과 유향과 몰약을 예물로 드리니라']],
    [52, '2026-12-27', '요한일서 2:24-25', ['너희는 처음부터 들은 것을 너희 안에 거하게 하라 처음부터 들은 것이', '너희 안에 거하면 너희가 아들과 아버지 안에 거하리라 그가 우리에게', '약속하신 것은 이것이니 곧 영원한 생명이니라']],
  ];
  const csv = '과,구절,성경,날짜\r\n' + DATA.map(([no, d, ref, lines]) => `${no},"${lines.join('\n')}",(${ref}),${d}`).join('\r\n');
  await nav(A, `#/pilsa/make/import`);
  await choose(A, () => A.click('#drop'), { name: '달달말씀.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  await A.waitForSelector('#imp-save');
  await A.click('#imp-save');
  await A.waitForFunction(() => location.hash.includes('table?term=2026-2'));
  await A.waitForSelector('#rows tr[data-id]');

  const zip = new JSZip();
  const slide = (title, body) => `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>
    <p:sp><p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:txBody><a:p><a:r><a:t>${body}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  zip.file('ppt/slides/slide1.xml', slide('1과 오늘의 말씀', '태초에 하나님이 천지를 창조하시니라 (창세기 1:1)'));
  zip.file('ppt/slides/slide2.xml', slide('2과 오늘의 말씀', '여호와는 나의 목자시니 내게 부족함이 없으리로다 (시편 23:1)'));
  zip.file('ppt/slides/slide3.xml', slide('3과 오늘의 말씀', '너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라 (잠언 3:5)'));
  const pptx = await zip.generateAsync({ type: 'nodebuffer' });
  await nav(A, `#/pilsa/make/import`);
  await choose(A, () => A.click('#drop'), { name: '말씀카드.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: pptx });
  await A.waitForSelector('#imp-save');
  ok('PPTX 에서 3과를 찾음', (await A.textContent('#imp-result h2')).includes('3과를 찾았어요'));
  await A.click('#imp-save');
  await A.waitForFunction(() => location.hash.includes('table?term=2027-1'));
  await synced(A);
  let LA = await lessonsOf(A);
  ok('가져온 말씀: CSV 8과 + PPTX 3과 + 예전 1장', LA.length === 12 && LA.filter((v) => v.term === '2026-2').length === 8, `${LA.length}장`);
  const repoText = [...repo.files.values()].map((f) => Buffer.from(f.bytes).toString('utf8')).join('\n');
  ok('GitHub(가짜)에는 암호문만', !repoText.includes('빌립보서') && !repoText.includes('관리자') && repo.files.size > 3, `${repo.files.size}개 파일`);

  // ---------- 5. 11·12월 인쇄 미리보기 = pilsa/monthly.html ? ----------
  const fontCSS = `@font-face{font-family:'Jua';src:url(https://fonts.gstatic.com/__local/Jua-Regular.woff2) format('woff2')}
    @font-face{font-family:'Gowun Dodum';src:url(https://fonts.gstatic.com/__local/GowunDodum-Regular.woff2) format('woff2')}`;
  const M = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await M.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: fontCSS, contentType: 'text/css' }));
  await M.route('https://fonts.gstatic.com/__local/*', async (r) => r.fulfill({ body: await readFile(join(ROOT, 'fonts', r.request().url().split('/').pop())), contentType: 'font/woff2', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await M.goto(pathToFileURL(MONTHLY).href);
  await M.emulateMedia({ media: 'print' });
  await M.waitForFunction(() => document.fonts.status === 'loaded' && document.querySelectorAll('.page').length >= 8);
  await sleep(500);
  const mPages = await M.$$('.page');
  // 기준 2: 앱·store 를 거치지 않는 원래 그리기(tools/print-check.html)에 이 기기의 '필사노트 백업'을 넣은 것
  const backupFile = join(ROOT, 'tools', '_tmp-e2e-backup.json');
  await writeFile(backupFile, await A.evaluate(async () => (await import('/js/store.js')).backupJSON()));
  const P = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pct = (d) => (d === 0 ? '같음' : `${(d * 100).toFixed(3)}% 다름`);
  for (const m of [11, 12]) {
    await nav(A, `#/pilsa/print?term=2026-2&month=${m}`);
    await A.evaluate(() => document.fonts.ready);
    await A.emulateMedia({ media: 'print' });
    const pages = await A.$$('#print-root .page');
    await P.goto(`${BASE}/tools/print-check.html?file=_tmp-e2e-backup.json&month=${m}`);
    await P.emulateMedia({ media: 'print' });
    await P.waitForFunction(() => document.body.dataset.ready === '1');
    await P.evaluate(() => document.fonts.ready);
    const pPages = await P.$$('.page');
    ok(`${m}월 인쇄: 4장`, pages.length === 4 && pPages.length === 4, `${pages.length}장`);
    const vsMonthly = [];
    const vsBase = [];
    for (let i = 0; i < pages.length; i++) {
      const idx = (m === 11 ? 0 : 4) + i;
      const a = join(OUT, `print-${m}-${i + 1}-site.png`);
      const b = join(OUT, `print-${m}-${i + 1}-monthly.png`);
      const sa = await pages[i].screenshot({ path: a });
      const sb = await mPages[idx].screenshot({ path: b });
      const sp = await pPages[i].screenshot();
      shots.push(a, b);
      vsMonthly.push(sa.equals(sb) ? 0 : await pixelDiff(sa, sb));
      vsBase.push(sa.equals(sp) ? 0 : await pixelDiff(sa, sp));
    }
    ok(`${m}월 인쇄: 백업 → 원래 그리기(print-check.html)와 픽셀까지 같음`, vsBase.every((d) => d === 0), vsBase.map(pct).join(' · '));
    note(`${m}월 인쇄: monthly.html 과 픽셀 비교 (0.1% 미만이면 같음)`, vsMonthly.every((d) => d < 0.001), vsMonthly.map(pct).join(' · '));
    const texts = await A.$$eval('#print-root .page', (ps) => ps.map((p) => p.innerText.replace(/\s+/g, ' ').trim()));
    const mtexts = await M.$$eval('.page', (ps) => ps.map((p) => p.innerText.replace(/\s+/g, ' ').trim()));
    const want = mtexts.slice(m === 11 ? 0 : 4, m === 11 ? 4 : 8);
    ok(`${m}월 인쇄: 글자가 monthly.html 과 같음`, JSON.stringify(texts) === JSON.stringify(want), texts.map((t, i) => (t === want[i] ? '같음' : `다름: ${t.slice(0, 60)} / ${want[i].slice(0, 60)}`)).join(' · '));
    await A.emulateMedia({ media: 'screen' });
  }
  await shot(A, 'pc-4-print-preview.png');
  await M.close();
  await P.close();

  // ---------- 6. 11월 디자인에 그림 올리기 ----------
  await nav(A, `#/pilsa/make/design?month=11`);
  await A.waitForSelector('#d-upload');
  await choose(A, () => A.click('#d-upload'), { name: 'leaf.png', mimeType: 'image/png', buffer: pngBuf });
  await A.waitForSelector('.img-item img');
  await synced(A);
  ok('그림이 GitHub(가짜)에 암호화되어 올라감', [...repo.files.keys()].filter((k) => k.startsWith('files/')).length === 2);

  // ---------- 7. 기기 B (휴대폰): QR 링크로 연결 ----------
  await nav(A, `#/settings`);
  await A.click('[data-s=qr]');
  await A.waitForSelector('#qr-box .qr svg');
  const link = await A.$eval('#qr-box', (b) => b.dataset.link);
  const qrSvg = await A.$eval('#qr-box .qr', (b) => b.innerHTML);
  const { default: qrcode } = await import(pathToFileURL(join(ROOT, 'js/core/qrcode.js')).href);
  const qr = qrcode(0, 'M');
  qr.addData(link);
  qr.make();
  const dOf = (svg) => svg.match(/<path[^>]*\sd="([^"]+)"/)?.[1];
  ok('QR 에 연결 링크가 들어 있음', dOf(qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true })) === dOf(qrSvg) && !!dOf(qrSvg) && link.startsWith(`${BASE}/#join=`));
  await shot(A, 'pc-5-qr.png');

  const B = await device('B', repo, { phone: true });
  await B.goto(link);
  await B.waitForSelector('#f-join');
  ok('QR 링크를 연 뒤 주소창에서 링크를 지움', !(await B.evaluate(() => location.href)).includes('join='));
  await shot(B, 'phone-6-join.png', { fullPage: true });
  await B.fill('#f-join [name=pw]', 'wrong-password');
  await B.fill('#f-join [name=user]', '김은혜');
  await B.click('#f-join button[type=submit]');
  await B.waitForFunction(() => document.querySelector('#f-join .err')?.textContent.includes('맞지 않아요'));
  await B.fill('#f-join [name=pw]', PW);
  await B.click('#f-join button[type=submit]');
  await ready(B);
  await B.waitForFunction(async () => (await import('/js/store.js')).S.data.items.lessons.length === 12, null, { timeout: 30000 });
  await syncNow(B);
  const diff = (x, y) => { const i = x.findIndex((v, k) => JSON.stringify(v) !== JSON.stringify(y[k])); return i < 0 ? '' : `${JSON.stringify(x[i])} ≠ ${JSON.stringify(y[i])}`; };
  {
    const [lb, la] = [await lessonsOf(B), await lessonsOf(A)];
    ok('B 가 같은 데이터를 받음', JSON.stringify(lb) === JSON.stringify(la), diff(lb, la));
  }

  // ---------- 8. 둘 다 오프라인에서 고치기 → 다시 연결 → 같아짐 ----------
  repo.online = false;
  const editRef = async (page, no, value) => {
    await nav(page, `#/pilsa/make/table?term=2026-2`);
    await page.waitForSelector('#rows tr[data-id]');
    const id = (await lessonsOf(page)).find((v) => v.no === no && v.term === '2026-2').id;
    await page.fill(`#rows tr[data-id="${id}"] input[data-f=ref]`, value);
    await page.click('h2, .hint', { position: { x: 2, y: 2 } }).catch(() => {});
    await sleep(900);
  };
  await editRef(A, 45, '빌립보서 4:4 (A가 고침)');
  await editRef(A, 47, '마태복음 5:9 (A)');
  await sleep(400); // A 가 먼저 고친 것이 '나중' 이 되지 않게
  await nav(B, `#/pilsa/make/table?term=2026-2`);
  await B.waitForSelector('#rows tr[data-id]');
  const id46 = (await lessonsOf(B)).find((v) => v.no === 46).id;
  await B.fill(`#rows tr[data-id="${id46}"] textarea[data-f=lines]`, '그 중의 한 사람이\n(B가 고침)');
  await sleep(900);
  await editRef(B, 47, '마태복음 5:9 (B)');
  await B.waitForFunction(() => document.querySelector('#sync-chip')?.textContent.includes('오프라인'), null, { timeout: 15000 });
  await shot(B, 'phone-7-offline.png');
  repo.online = true;
  for (const p of [A, B, A, B]) ok(`${p.name} 동기화`, (await syncNow(p)) === 'saved');
  LA = await lessonsOf(A);
  const LB = await lessonsOf(B);
  ok('두 기기의 데이터가 같아짐', JSON.stringify(LA) === JSON.stringify(LB));
  const by = (no) => LA.find((v) => v.no === no && v.term === '2026-2');
  ok('A 가 고친 45과 남음', by(45).ref === '빌립보서 4:4 (A가 고침)');
  ok('B 가 고친 46과 남음', by(46).lines.join('|') === '그 중의 한 사람이|(B가 고침)');
  ok('47과: 나중 값(B) + 진 값(A)은 충돌로 남음', by(47).ref === '마태복음 5:9 (B)' && by(47).c === 1, JSON.stringify(by(47)));

  // 충돌 표시 → 고르기
  await nav(B, `#/pilsa/make`);
  await B.waitForSelector('#conflict-badge:not([hidden])');
  await nav(A, `#/pilsa/make`);
  await A.waitForSelector('#conflict-badge:not([hidden])');
  await shot(A, 'pc-6-conflict-badge.png');
  await B.click('#conflict-badge');
  await B.waitForSelector('.cf-card');
  await shot(B, 'phone-8-conflicts.png', { fullPage: true });
  await B.check('.cf-card input[value=other]');
  await B.click('.cf-card button[type=submit]');
  await B.waitForFunction(() => !document.querySelector('.cf-card'));
  await syncNow(B);
  await syncNow(A);
  await A.waitForFunction(() => document.querySelector('#conflict-badge').hidden, null, { timeout: 15000 });
  LA = await lessonsOf(A);
  ok('충돌에서 고른 값(A)이 두 기기에', LA.find((v) => v.no === 47).ref === '마태복음 5:9 (A)' && JSON.stringify(LA) === JSON.stringify(await lessonsOf(B)));

  // ---------- 9. 휴지통 → 다른 기기에서 되살리기 ----------
  await nav(A, `#/pilsa/make/table?term=2026-2`);
  const id52 = LA.find((v) => v.no === 52).id;
  await A.click(`#rows tr[data-id="${id52}"] [data-act=del]`);
  await A.waitForFunction(async () => (await import('/js/store.js')).trash('lessons').length === 1);
  await syncNow(A);
  await syncNow(B);
  await nav(B, `#/trash`);
  await B.waitForSelector('.trash-item');
  ok('B 휴지통에 52과', (await B.textContent('.trash-item')).includes('52과'));
  await shot(B, 'phone-9-trash.png', { fullPage: true });
  await B.click('.trash-item [data-act=restore]');
  await B.waitForFunction(async () => (await import('/js/store.js')).trash('lessons').length === 0);
  await syncNow(B);
  await syncNow(A);
  await A.waitForFunction(async () => (await import('/js/store.js')).S.data.items.lessons.length === 12);
  ok('되살린 52과가 A 에도', (await lessonsOf(A)).some((v) => v.no === 52));

  // ---------- 10. B 의 인쇄 미리보기: A 가 올린 그림이 보이는가 ----------
  await nav(B, `#/pilsa/print?term=2026-2&month=11`);
  const up = await B.$$eval('#p-preview .deco.up img', (ims) => ims.map((i) => i.naturalWidth));
  ok('B 미리보기: 4장 + A 가 올린 그림', (await B.$$('#p-preview .page')).length === 4 && up.length === 4 && up.every((w) => w > 0), JSON.stringify(up));
  await shot(B, 'phone-10-print.png');

  // ---------- 11. 잠그기 → 비밀번호로 열기 ----------
  await nav(A, `#/pilsa/make`);
  await A.click('#lock-btn');
  await A.waitForSelector('#f-unlock');
  ok('PC: 이 기기 기억하기 기본 꺼짐', !(await A.isChecked('#f-unlock [name=remember]')));
  await shot(A, 'pc-7-unlock.png');
  await A.fill('#f-unlock [name=pw]', PW);
  await A.click('#f-unlock button[type=submit]');
  await ready(A);
  ok('다시 열면 데이터 그대로', (await lessonsOf(A)).length === 12);
  await nav(A, `#/settings`);
  await A.waitForSelector('details.admin');
  await A.click('details.admin summary');
  await shot(A, 'pc-8-settings.png', { fullPage: true });

  ok('콘솔 오류·CSP 위반 없음', problems.length === 0, problems.join(' | '));
} catch (e) {
  console.error(e);
  results.push({ name: '예외', ok: false, detail: e.message });
} finally {
  await browser.close();
  server.close();
}

const fails = results.filter((r) => !r.ok);
const summary = `${fails.length ? 'FAIL' : 'PASS'} ${results.length - fails.length}/${results.length}`;
await writeFile(join(OUT, 'result.json'), JSON.stringify({ summary, results, problems, shots }, null, 2));
console.log(`\n${summary}  (화면 사진 ${shots.length}장: ${OUT})`);
if (problems.length) console.log('콘솔/CSP:', problems);
process.exit(fails.length ? 1 : 0);
