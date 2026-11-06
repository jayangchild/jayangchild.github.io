// 역할별 모듈 시험 (사이트는 쓰지 않는다). 가짜 GitHub(js/core/fake-backend.js 의 FakeGitHub)를 Node 에 두고
// 여러 브라우저(방문자·학부모·선생님·임원 둘·관리자)가 같이 쓴다. 헤드리스 Edge(Playwright).
//
//   npm i --no-save playwright-core     (한 번)
//   node tools/e2e-roles.mjs [결과폴더]   SEED=<seed-all.json> 을 주면 마지막에 관리 → 가져오기도 해 본다 (개수만 확인, 화면 사진 없음)
//
// 확인하는 것: access-test 20/20 · core-test 20/20 · 첫 화면은 공개 · 역할마다 메뉴와 데이터가 정확히 그것만 ·
//   선생님은 임원 자료를 못 봄 · 학부모는 연락처를 못 봄 · 공개 저장소에 평문 개인정보 없음 · 사진 EXIF 빠짐 ·
//   선물 재고 계산 · 달란트 잔액 · 막기(열쇠 바꾸기) 뒤 학부모는 못 들어오고 선생님은 그대로 · 콘솔 오류·CSP 위반 없음.
// 화면 사진(휴대폰 400×850 · PC 1280×860): 결과폴더/*.png

import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { FakeGitHub } from '../js/core/fake-backend.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] || join(ROOT, 'tools', '_tmp-e2e-roles'));
const PORT = 8870 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const PW = 'jayang-yunyeon-2026';
await mkdir(OUT, { recursive: true });

const results = [];
const problems = [];
const notFound = [];
const shots = [];
const ok = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!cond) throw new Error(`실패: ${name} ${detail}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 가짜 GitHub ----------
const gh = new FakeGitHub({ owner: 'jayangchild', tokens: ['core-tok', 'pub-tok'], creators: ['pub-tok'] });
gh.repo('jayangchild-data', { isPublic: false });
const site = gh.repo('jayangchild.github.io', { isPublic: true });
site.files.set('index.html', { sha: 'sha0', bytes: new TextEncoder().encode('<!doctype html>') });
site.addCommit('init', ['index.html']);

const b64 = (u8) => Buffer.from(u8).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));
async function ghCall(op, token, repo, ...a) {
  const c = gh.client(token, repo);
  try {
    if (op === 'check') return { v: await c.check() };
    if (op === 'tree') return { v: await c.tree() };
    if (op === 'get') { const r = await c.get(a[0]); return { v: r ? { sha: r.sha, b64: b64(r.bytes) } : null }; }
    if (op === 'put') return { v: await c.put(a[0], unb64(a[1]), a[2], a[3]) };
    if (op === 'head') return { v: await c.head() };
    if (op === 'commit') return { v: await c.commit(a[0].map((f) => ({ path: f.path, bytes: unb64(f.b64) })), a[1], a[2]) };
    if (op === 'createRepo') return { v: await c.createRepo(a[0], a[1]) };
    return { err: 400, msg: `bad op ${op}` };
  } catch (e) {
    return { err: e.status ?? 500, msg: e.message };
  }
}

const ENV = `// 시험용 (tools/e2e-roles.mjs 가 js/modules/access-env.js 대신 준다)
import { BackendError } from '../core/github.js';
import { b64, unb64 } from '../core/crypto.js';
const call = async (...a) => { const r = await window.__gh(...a); if (r && r.err != null) throw new BackendError(r.err, r.msg); return r.v; };
export const backendFor = (token, r) => ({
  token,
  check: () => call('check', token, r.repo),
  tree: () => call('tree', token, r.repo),
  get: async (p) => { const x = await call('get', token, r.repo, p); return x ? { sha: x.sha, bytes: unb64(x.b64) } : null; },
  put: (p, bytes, sha, m) => call('put', token, r.repo, p, b64(bytes), sha || null, m),
  head: () => call('head', token, r.repo),
  commit: (files, m, parent) => call('commit', token, r.repo, files.map((f) => ({ path: f.path, b64: b64(f.bytes) })), m, parent),
  createRepo: (name, o) => call('createRepo', token, r.repo, name, o),
});
export default { opts: { backendFor } };
`;
const TEST_INDEX = `// 시험용 core
import { createCore } from './core.js';
import { backendFor } from '../modules/access-env.js';
export * from './core.js';
const core = createCore({ backend: (token, dev) => backendFor(token, { repo: dev?.repo || 'jayangchild-data' }), syncDelay: 200, pollMs: 1500, siteUrl: location.origin + '/' });
export default core;
`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const PHONE = { width: 400, height: 850 };
const PC = { width: 1280, height: 860 };

async function device(name, { phone = false } = {}) {
  const ctx = await browser.newContext(phone ? { viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: PC });
  await ctx.exposeFunction('__gh', (...a) => ghCall(...a));
  await ctx.route('**/js/modules/access-env.js', (r) => r.fulfill({ body: ENV, contentType: 'text/javascript; charset=utf-8' }));
  await ctx.route('**/js/core/index.js', (r) => r.fulfill({ body: TEST_INDEX, contentType: 'text/javascript; charset=utf-8' }));
  // 공개 사이트(Pages)에서 읽기: keyring.json · access/…  → 가짜 공개 저장소
  const fromSite = async (r) => {
    const path = new URL(r.request().url()).pathname.slice(1);
    const bytes = site.read(decodeURIComponent(path));
    if (!bytes) return r.fulfill({ status: 404, body: 'not found' });
    return r.fulfill({ body: Buffer.from(bytes), contentType: 'application/json' });
  };
  await ctx.route(`${BASE}/keyring.json*`, fromSite);
  await ctx.route(`${BASE}/access/**`, fromSite);
  // 파일 저장소 (raw.githubusercontent.com/jayangchild/<repo>/main/<path>)
  await ctx.route('https://raw.githubusercontent.com/**', (r) => {
    const [, owner, repo, , ...rest] = new URL(r.request().url()).pathname.split('/');
    const rp = gh.repos.has(repo) ? gh.repo(repo) : null;
    const bytes = owner === 'jayangchild' && rp?.isPublic ? rp.read(rest.join('/')) : null;
    return bytes ? r.fulfill({ body: Buffer.from(bytes), contentType: 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.fulfill({ status: 404, body: 'nf', headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await ctx.addInitScript(() => {
    addEventListener('securitypolicyviolation', (e) => console.error(`CSP 위반: ${e.violatedDirective} ${e.blockedURI}`));
  });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/status of 404/.test(m.text()) && /\/(keyring\.json|access\/)|raw\.githubusercontent|api\.github/.test(m.location()?.url || '')) { notFound.push(m.location().url); return; }
    problems.push(`[${name}] console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  page.name = name;
  return page;
}

const ready = (page) => page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60000 });
async function nav(page, hash) {
  await page.evaluate((h) => { document.body.dataset.ready = ''; if (location.hash === h) dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = h; }, hash);
  await ready(page);
}
async function until(page, fn, arg, ms = 60000) {
  const t0 = Date.now();
  while (!(await page.evaluate(fn, arg).catch(() => false))) {
    if (Date.now() - t0 > ms) throw new Error('기다리다 시간이 다 됐어요');
    await sleep(150);
  }
}
async function shot(page, file, opts = {}) {
  const p = join(OUT, file);
  await page.screenshot({ path: p, ...opts });
  shots.push(p);
}
// 같은 화면을 휴대폰(400×850)과 PC(1280×860) 폭으로
async function shotBoth(page, name) {
  const vp = page.viewportSize();
  await page.evaluate(() => { document.querySelector('#toast').hidden = true; });
  for (const [tag, size] of [['phone', PHONE], ['pc', PC]]) {
    await page.setViewportSize(size);
    await sleep(250);
    await shot(page, `${name}-${tag}.png`, { fullPage: true });
  }
  await page.setViewportSize(vp);
}
const menusOf = (page) => page.$$eval('#nav a[data-menu], #nav-more a[data-menu]', (as) => as.map((a) => a.dataset.menu)); // 위 메뉴 + 더보기
const ctxEval = (page, fn, arg) => page.evaluate(fn, arg);
async function modalSubmit(page, fill) {
  await page.waitForSelector('#modal[open] form');
  await fill();
  await page.click('#modal[open] button[type=submit]');
  await page.waitForFunction(() => !document.querySelector('#modal[open]'), null, { timeout: 60000 });
}
async function login(page, id, code, { remember = true } = {}) {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('.hero');
  await page.click('#login-btn');
  await page.waitForSelector('form.ax-login');
  await page.fill('form.ax-login input[name=identifier]', id);
  await page.fill('form.ax-login input[name=code]', code);
  if (remember) await page.check('form.ax-login input[name=remember]');
  await page.click('form.ax-login button[type=submit]');
  await page.waitForFunction(() => document.querySelector('#user-chip') && !document.querySelector('#user-chip').hidden && document.body.dataset.ready === '1', null, { timeout: 60000 });
  await ready(page);
}

// 그림: 가짜 EXIF(위치 정보 흉내)가 붙은 JPEG
async function makeJPEG(page, color) {
  const b = await page.evaluate(async (color) => {
    const c = Object.assign(document.createElement('canvas'), { width: 640, height: 480 });
    const g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, 640, 480);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(320, 240, 120, 0, Math.PI * 2); g.fill();
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, color);
  const jpg = Buffer.from(b, 'base64');
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), Buffer.from('MM\0*\0\0\0\x08GPS-LAT-37.5-LNG-127.0', 'binary')]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 255]), exif]);
  return Buffer.concat([jpg.subarray(0, 2), app1, jpg.subarray(2)]);
}
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
const XLSX = Buffer.concat([Buffer.from('PK\x03\x04', 'binary'), Buffer.alloc(200, 7)]);

// 시험 데이터 (가짜 이름·번호. 진짜 개인정보 없음)
const KIDS = [
  { name: '가나다', grade: '1', cls: '1', teacher: '홍선생', parentName: '가부모', parentPhone: '010-5550-0001' },
  { name: '라마바', grade: '1', cls: '1', teacher: '홍선생', parentName: '라부모', parentPhone: '010-5550-0002' },
  { name: '사아자', grade: '2', cls: '1', teacher: '김선생', parentName: '사부모', parentPhone: '010-5550-0003' },
  { name: '차카타', grade: '2', cls: '1', teacher: '김선생', parentName: '차부모', parentPhone: '010-5550-0004' },
];
const SECRET_MEETING = '임원회의-비밀안건-7731';
const SECRET_POLICY = '정책-내부결정-4410';

const server = await serve(PORT, { onReport: (r) => { reported.push(r); } });
const reported = [];

try {
  // ---------- 1. core-test · access-test ----------
  for (const t of ['core-test.html', 'access-test.html']) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/${t}?report`);
    await p.waitForFunction(() => document.body.dataset.done, null, { timeout: 300000 });
    const done = await p.evaluate(() => document.body.dataset.done);
    ok(t, done.startsWith('PASS'), done);
    await ctx.close();
  }

  // ---------- 2. 관리자 (PC): 공개 화면 → 로그인 → 관리자 → 처음 설정 → 접속 코드 준비 ----------
  const A = await device('admin');
  await A.goto(`${BASE}/`);
  await A.waitForSelector('.hero');
  ok('첫 화면은 공개 화면 (여는 화면·잠금 화면 아님)', await A.isHidden('#gate') && await A.isVisible('#login-btn'));
  await A.click('#login-btn');
  await A.waitForSelector('form.ax-login');
  ok('로그인 화면: 역할 고르기 없음 (아이디 + 코드)', !(await A.$('form.ax-login select')) && !!(await A.$('form.ax-login input[name=identifier]')));
  await A.click('.admin-link');
  await A.waitForSelector('#gate-card h1');
  await A.click('details.admin summary');
  await A.click('[data-g=setup]');
  await A.fill('#f-setup [name=token]', 'core-tok');
  await A.fill('#f-setup [name=pw]', PW);
  await A.fill('#f-setup [name=pw2]', PW);
  await A.fill('#f-setup [name=user]', '관리자');
  await A.click('#f-setup button[type=submit]');
  await A.waitForSelector('#rc-text', { timeout: 60000 });
  const rc = await A.textContent('#rc-text');
  await A.check('#rc-ok');
  await A.fill('#rc-last', rc.replace(/[^A-Z0-9]/gi, '').slice(-4));
  await A.click('#rc-next');
  await A.waitForSelector('#acc-f', { timeout: 60000 });
  await A.fill('#acc-f [name=token]', 'pub-tok');
  await A.fill('#acc-f [name=identifier]', 'yunyeon-admin');
  await A.click('#acc-f button[type=submit]');
  await A.waitForSelector('#admin-code', { timeout: 120000 });
  const adminCode = (await A.textContent('#admin-code')).trim();
  ok('접속 코드 준비: 관리자 코드 (60비트 모양)', /^[A-Z0-9]{4}(-[A-Z0-9]{4}){2}$/.test(adminCode), adminCode.replace(/./g, (c, i) => (i < 4 ? c : '•')));
  ok('공개 저장소에 keyring.json', site.files.has('keyring.json'));

  // 관리자 코드로 다시 로그인 (데이터 저장소까지 같은 로그인으로 열림)
  await A.click('#lock-btn');
  await A.waitForSelector('.hero');
  await login(A, 'yunyeon-admin', adminCode, { remember: false });
  ok('관리자 코드 로그인 → 데이터 저장소도 열림', await A.evaluate(async () => (await import('/js/store.js')).core.status().open));
  ok('관리자 메뉴: 모두', JSON.stringify(await menusOf(A)) === JSON.stringify(['home', 'photos', 'roster', 'birthdays', 'talent', 'plan', 'bulletin', 'pilsa', 'gifts', 'policy', 'meetings', 'accounting', 'admin']), (await menusOf(A)).join(','));

  // 사람 추가 (access-ui peopleTable)
  await nav(A, '#/admin/people');
  await A.waitForSelector('.ax-people');
  const codes = {};
  for (const [name, id, role] of [['홍선생', 'hong-t', 'teacher|'], ['가부모', 'ga-parent', 'parent|'], ['회계임원', 'acc-officer', 'officer|회계'], ['서기임원', 'sec-officer', 'officer|서기']]) {
    const add = await A.$('.ax-add');
    const inputs = await add.$$('input');
    await inputs[0].fill(name);
    await inputs[1].fill(id);
    await (await add.$('select')).selectOption(role);
    await (await add.$('button')).click();
    await A.waitForFunction((n) => document.querySelector('.ax-msg')?.value.includes(n), name, { timeout: 120000 });
    codes[id] = (await A.$eval('.ax-msg', (t) => t.value)).match(/접속 코드: (\S+)/)[1];
  }
  ok('사람 4명 추가 + 코드', Object.values(codes).every((c) => /^[A-Z0-9-]{14}$/.test(c)));
  await A.waitForFunction(() => document.querySelectorAll('.ax-table tbody tr').length === 5);

  // ---------- 3. 관리자가 시험 데이터 넣기 ----------
  // 공개 페이지 (사진 1장)
  const jpg = await makeJPEG(A, '#3a7bd5');
  await nav(A, '#/admin/pages');
  await A.click('[data-act=add]');
  await modalSubmit(A, async () => {
    await A.fill('#modal [name=title]', '예배 시간·장소');
    await A.fill('#modal [name=body]', '주일 오전 9시 · 교육관 2층');
    await A.setInputFiles('#modal [name=files]', { name: 'event.jpg', mimeType: 'image/jpeg', buffer: jpg });
  });
  await A.waitForSelector('#adm .doc');
  // 명단 (학생 4 + 선생님 1), 계획, 영상, 정책, 회계 — 화면 모듈과 같은 길(ctx.col)로
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const nm = String(((now.getMonth() + 1) % 12) + 1).padStart(2, '0');
  await ctxEval(A, async ({ KIDS, mm, nm, SECRET_POLICY }) => {
    const { col, upload } = await import('/js/modules/ctx.js');
    for (const [i, k] of KIDS.entries()) await col('members').put({ ...k, type: 'student', birthday: `2019-${i % 2 ? nm : mm}-0${i + 3}`, note: '' });
    await col('members').put({ type: 'teacher', name: '홍선생', phone: '010-5550-0099', cls: '1-1', birthday: `1980-${mm}-20`, labels: [] });
    const y = new Date().getFullYear();
    for (const [d, t] of [[`${y}-03-01`, '새 학년 예배'], [`${y}-07-25`, '여름성경학교'], [`${y}-12-25`, '성탄 발표회']]) await col('plan').put({ date: d, title: t, place: '본당' });
    await col('videos').put({ title: '부활절 찬양', url: 'https://youtu.be/dQw4w9WgXcQ', date: `${y}-04-05`, vis: 'parent' });
    await col('policies').put({ kind: '결정', title: SECRET_POLICY, date: `${y}-02-01`, body: '임원만 보는 내용' });
    const xl = new File([new Uint8Array(300).fill(7)], '10월결의서.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const f = await upload(xl, { col: 'accounting', rec: {}, image: false });
    await col('accounting').put({ date: `${y}-10-31`, title: '10월 지출·수입 결의서', files: [f] });
  }, { KIDS, mm, nm, SECRET_POLICY });

  // 임원회의 자료 (UI, 파일 첨부)
  await nav(A, '#/meetings');
  await A.click('[data-act=add]');
  await modalSubmit(A, async () => {
    await A.fill('#modal [name=title]', SECRET_MEETING);
    await A.fill('#modal [name=body]', '1. 여름성경학교 예산\n2. 교사 수련회');
    await A.setInputFiles('#modal [name=files]', [{ name: '회의록.pdf', mimeType: 'application/pdf', buffer: PDF }]);
  });
  await A.waitForSelector('.doc .file-chip');

  // 주보 (UI, PDF)
  await nav(A, '#/bulletin');
  await A.click('[data-act=add]');
  await modalSubmit(A, async () => { await A.setInputFiles('#modal [name=files]', { name: '주보.pdf', mimeType: 'application/pdf', buffer: PDF }); });
  await A.waitForSelector('.card.latest');

  // 앨범 (UI): 학부모부터 · 사진 2장 (EXIF 붙은 JPEG)
  await nav(A, '#/photos');
  await A.click('[data-act=album]');
  await modalSubmit(A, async () => {
    await A.fill('#modal [name=title]', '가을 소풍');
    await A.setInputFiles('#modal [name=files]', [{ name: 'a.jpg', mimeType: 'image/jpeg', buffer: jpg }, { name: 'b.jpg', mimeType: 'image/jpeg', buffer: await makeJPEG(A, '#e07b39') }]);
  });
  await A.waitForSelector('.photo-grid img[src^="blob:"]', { timeout: 60000 });
  // 선생님만 보는 앨범
  await ctxEval(A, async () => { const { col } = await import('/js/modules/ctx.js'); await col('albums').put({ title: '교사 수련회', date: '2026-02-10', vis: 'teacher', photos: [] }); });
  // EXIF: 올린 사진에 'Exif'·위치 글자가 없어야
  const exif = await ctxEval(A, async () => {
    const { col, fileBlob } = await import('/js/modules/ctx.js');
    const a = col('albums').list().find((x) => x.title === '가을 소풍');
    const u8 = new Uint8Array(await (await fileBlob(a.photos[0])).arrayBuffer());
    const s = Array.from(u8.subarray(0, 4096), (b) => String.fromCharCode(b)).join('');
    return { exif: s.includes('Exif') || s.includes('GPS-LAT'), jpeg: u8[0] === 0xff && u8[1] === 0xd8, tier: a._tier };
  });
  ok('사진: 줄여서 다시 저장 → EXIF·위치 정보 없음', exif.jpeg && !exif.exif, JSON.stringify(exif));
  ok('앨범은 학부모 등급에', exif.tier === 'parent');

  // 달란트: 화면의 +1/−1 (가나다 +1 +1 +1 −1 → 2, 라마바 +1 +1 → 2) + 기록… 으로 +5 → 가나다 7
  await nav(A, '#/talent');
  const kidId = await ctxEval(A, async () => (await import('/js/modules/ctx.js')).col('members').list().find((m) => m.name === '가나다').id);
  const kid2 = await ctxEval(A, async () => (await import('/js/modules/ctx.js')).col('members').list().find((m) => m.name === '라마바').id);
  const tap = async (id, act) => {
    await A.click(`li[data-id="${id}"] [data-act=${act}]`);
    await A.waitForFunction(([i, a]) => !document.querySelector(`li[data-id="${i}"] [data-act=${a}]`).disabled, [id, act], { timeout: 60000 });
  };
  for (const act of ['plus', 'plus', 'plus', 'minus']) await tap(kidId, act);
  for (const act of ['plus', 'plus']) await tap(kid2, act);
  await A.click(`li[data-id="${kidId}"] [data-act=more]`);
  await modalSubmit(A, async () => { await A.fill('#modal [name=qty]', '5'); await A.fill('#modal [name=why]', '암송'); });
  await A.waitForFunction((id) => document.querySelector(`li[data-id="${id}"] [data-bal]`)?.textContent === '7', kidId, { timeout: 30000 }).catch(() => {});
  const bal = await A.$eval(`li[data-id="${kidId}"] [data-bal]`, (e) => e.textContent);
  ok('달란트 잔액: +1+1+1−1+5 = 7', bal === '7', bal);

  // 선물 재고 (UI): 처음 50 → 입고 20 → 지급 3 → 지급 2 = 65 → 지급 60 = 5 (부족 10 이하 → 경고)
  await nav(A, '#/gifts');
  await A.click('[data-act=item]');
  await modalSubmit(A, async () => { await A.fill('#modal [name=name]', '젤리'); await A.fill('#modal [name=low]', '10'); await A.fill('#modal [name=qty]', '50'); });
  await A.waitForSelector('tr[data-id] [data-stock]');
  const giftOp = async (act, n, to = '') => {
    const before = await A.$eval('[data-stock]', (e) => e.textContent);
    await A.click(`tr[data-id] [data-act=${act}]`);
    await modalSubmit(A, async () => { await A.fill('#modal [name=qty]', String(n)); if (to) await A.fill('#modal [name=to]', to); });
    await A.waitForFunction((b) => document.querySelector('[data-stock]')?.textContent !== b, before, { timeout: 60000 });
  };
  await giftOp('in', 20);
  await giftOp('out', 3, '새 친구');
  await giftOp('out', 2, '생일');
  let stock = await A.$eval('[data-stock]', (e) => e.textContent);
  ok('선물 재고: 50 + 20 − 3 − 2 = 65', stock === '65', stock);
  ok('재고가 넉넉하면 부족 경고 없음', !(await A.$('.low-warn')));
  await giftOp('out', 60, '전도 주일');
  stock = await A.$eval('[data-stock]', (e) => e.textContent);
  ok('선물 재고: 65 − 60 = 5 → 부족 경고', stock === '5' && !!(await A.$('.low-warn')), stock);
  await shotBoth(A, '8-gift-stock');
  // «⋯» 메뉴: 기록 보기가 열리는가 (휴대폰 폭에서도)
  for (const size of [PHONE, PC]) {
    await A.setViewportSize(size);
    await A.click('tr[data-id] details.row-more > summary');
    await A.waitForSelector('tr[data-id] details.row-more[open] [data-act=hist]');
    if (size === PHONE) await shot(A, '8b-gift-more-phone.png', { fullPage: true });
    await A.click('tr[data-id] [data-act=hist]');
    await A.waitForSelector('#modal[open] h2');
    ok(`선물 «⋯» → 기록 (${size.width}px)`, (await A.textContent('#modal[open] h2')).includes('기록'));
    await A.click('#modal[open] [data-close]');
  }
  // PC 위 메뉴: 1280·1024 에서 잘리는 메뉴 없음, 넘치는 것은 «더보기»
  for (const w of [1280, 1024]) {
    await A.setViewportSize({ width: w, height: 860 });
    await sleep(400);
    const fit = await A.evaluate(() => {
      const nav = document.querySelector('#nav');
      const r = nav.getBoundingClientRect();
      const brand = document.querySelector('.brand').getBoundingClientRect();
      const items = [...nav.querySelectorAll('a')].map((a) => a.getBoundingClientRect());
      const more = document.querySelector('#nav-more');
      return { clipped: items.filter((b) => b.left < r.left - 0.5 || b.right > r.right + 0.5).length, overlapBrand: items.some((b) => b.left < brand.right), scroll: nav.scrollLeft,
        inline: items.length, more: more.hidden ? 0 : more.querySelectorAll('a').length, total: 13 };
    });
    ok(`PC 메뉴 ${w}px: 잘림·로고 겹침 없음, 나머지는 더보기`, !fit.clipped && !fit.overlapBrand && fit.scroll === 0 && fit.inline + fit.more === fit.total && fit.inline >= 5, JSON.stringify(fit));
    await A.click('#nav-more > summary');
    await A.waitForSelector('#nav-more[open] .nav-more-menu a');
    await shot(A, `9-admin-nav-${w}.png`);
    const pick = await A.$eval('#nav-more .nav-more-menu a[data-menu=meetings]', (a) => a.lastElementChild.textContent);
    await A.evaluate(() => { document.body.dataset.ready = ''; });
    await A.click('#nav-more .nav-more-menu a[data-menu=meetings]');
    await A.waitForFunction(() => location.hash === '#/meetings' && document.body.dataset.ready === '1');
    ok(`더보기 → 임원회의 (${w}px), 더보기 자리에 고른 메뉴 이름`, (await A.textContent('#nav-more > summary')).includes(pick) && !(await A.$('#nav-more[open]')), `${pick} / ${await A.textContent('#nav-more > summary')} / open=${!!(await A.$('#nav-more[open]'))} / hidden=${await A.isHidden('#nav-more')} / ${await A.evaluate(() => [...document.querySelectorAll('#nav a, #nav-more a')].map((a) => (a.closest('#nav-more') ? 'M:' : 'N:') + a.dataset.menu + (a.classList.contains('on') ? '*' : '')).join(','))}`);
    await nav(A, '#/gifts');
  }
  await A.setViewportSize(PC);

  // 공개 저장소·파일 저장소에 평문 개인정보가 없는가
  const plain = [...gh.repos.values()].filter((r) => r.isPublic).flatMap((r) => [...r.files.values()].map((f) => Buffer.from(f.bytes).toString('utf8'))).join('\n');
  const leaks = ['010-5550', '가나다', '가부모', SECRET_MEETING, SECRET_POLICY, '결의서', 'hong-t', '홍선생'].filter((s) => plain.includes(s));
  ok('공개 저장소에 평문 개인정보·임원 자료 없음 (아이디도 없음)', !leaks.length, leaks.join(','));
  ok('공개 페이지는 평문으로 공개 등급에', plain.includes('예배 시간·장소'));
  ok('파일은 파일 저장소(jayangchild-files-1)에', gh.repos.has('jayangchild-files-1') && gh.repo('jayangchild-files-1').files.size > 2);

  await nav(A, '#/admin/people');
  await A.waitForSelector('.ax-table tbody tr');
  await shotBoth(A, '7-admin-people');

  // ---------- 4. 방문자 (휴대폰) ----------
  const V = await device('visitor', { phone: true });
  await V.goto(`${BASE}/`);
  await V.waitForSelector('#pg-' + (await ctxEval(A, async () => (await import('/js/modules/ctx.js')).col('pages').list()[0].id)), { timeout: 60000 });
  await ready(V);
  ok('방문자 메뉴: 유년부 소개만', JSON.stringify(await menusOf(V)) === '["home"]', (await menusOf(V)).join(','));
  await V.waitForFunction(() => [...document.querySelectorAll('.pub-photos img')].some((i) => i.naturalWidth > 0), null, { timeout: 30000 });
  await shotBoth(V, '1-public-home');
  await nav(V, '#/roster');
  ok('방문자: 명단 → 로그인 필요', (await V.textContent('#view')).includes('로그인하면 볼 수 있어요') && !(await V.textContent('#view')).includes('010-'));

  // ---------- 5. 학부모 (휴대폰) ----------
  const P = await device('parent', { phone: true });
  await login(P, 'ga-parent', codes['ga-parent']);
  ok('학부모 메뉴: 소개 · 사진·영상', JSON.stringify(await menusOf(P)) === '["home","photos"]', (await menusOf(P)).join(','));
  await nav(P, '#/photos');
  const albums = await P.$$eval('.album b', (b) => b.map((x) => x.textContent));
  ok('학부모: 학부모 앨범만 (선생님 앨범 안 보임)', albums.includes('가을 소풍') && !albums.includes('교사 수련회'), albums.join(','));
  ok('학부모: 영상 링크', (await P.textContent('#view')).includes('부활절 찬양'));
  const aid = await P.$eval('.album', (a) => a.dataset.id);
  await nav(P, `#/photos?a=${aid}`);
  await P.waitForFunction(() => { const ims = [...document.querySelectorAll('.photo-grid img')]; return ims.length === 2 && ims.every((i) => i.naturalWidth > 0); }, null, { timeout: 60000 });
  ok('학부모: 앨범 사진을 풀어서 봄 (2장)', true);
  await shotBoth(P, '2-parent-photos');
  const pdata = await ctxEval(P, async () => {
    const { col } = await import('/js/modules/ctx.js');
    return { members: col('members').list().length, meetings: col('meetings').list().length, talent: col('talentLog').list().length, plan: col('plan').list().length };
  });
  ok('학부모: 명단·연락처·임원 자료 데이터 자체가 없음', pdata.members === 0 && pdata.meetings === 0 && pdata.talent === 0, JSON.stringify(pdata));
  await nav(P, '#/roster');
  ok('학부모: 명단 → 볼 수 없음, 전화번호 없음', !!(await P.$('.no-access')) && !(await P.content()).includes('010-5550'));
  ok('학부모: 선생님 등급은 못 읽음', await ctxEval(P, async () => { const { access } = await import('/js/modules/site-access.js'); try { await access.list('teacher'); return false; } catch (e) { return e.code === 'no-access'; } }));

  // ---------- 6. 선생님 (휴대폰) ----------
  const T = await device('teacher', { phone: true });
  await login(T, 'hong-t', codes['hong-t']);
  ok('선생님 메뉴', JSON.stringify(await menusOf(T)) === JSON.stringify(['home', 'photos', 'roster', 'birthdays', 'talent', 'plan', 'bulletin']), (await menusOf(T)).join(','));
  await nav(T, '#/roster');
  const tels = await T.$$eval('#r-list a.call', (as) => as.map((a) => a.getAttribute('href')));
  ok('선생님: 명단 카드 + 누르면 전화 (부모님 연락처)', tels.length === 4 && tels.includes('tel:01055500001'), tels.join(','));
  await shotBoth(T, '3-teacher-roster');
  await nav(T, '#/talent');
  const tbal = await T.$eval(`li[data-id="${kidId}"] [data-bal]`, (e) => e.textContent);
  ok('선생님: 달란트 잔액 같음 (7), 고치기 버튼 없음', tbal === '7' && !(await T.$('[data-act=plus]')), tbal);
  await shotBoth(T, '4-talent');
  await nav(T, '#/talent?t=month');
  ok('달란트 한 달 정리: 받음 +10 · 씀 −1', (await T.textContent('#view')).includes('+10') && (await T.textContent('#view')).includes('−1'));
  await nav(T, '#/birthdays');
  ok('생일: 이번 달·다음 달 (학생·선생님)', (await T.$$('.bday-list li')).length === 5, String((await T.$$('.bday-list li')).length));
  await nav(T, '#/photos');
  ok('선생님: 선생님 앨범도 보임', (await T.textContent('#view')).includes('교사 수련회'));
  await nav(T, '#/bulletin');
  await T.waitForSelector('.card.latest [data-open]');
  await shotBoth(T, '5-bulletin');
  await T.click('.card.latest [data-open]');
  await T.waitForSelector('#modal[open] iframe.pdf-frame[src^="blob:"]');
  ok('주보: PDF 를 풀어서 화면 안에서 보기 (blob)', true);
  await T.click('#modal[open] [data-close]');
  for (const k of ['meetings', 'policy', 'accounting', 'gifts', 'admin']) {
    await nav(T, `#/${k}`);
    ok(`선생님: ${k} → 볼 수 없음`, !!(await T.$('.no-access')));
  }
  const tdata = await ctxEval(T, async () => {
    const { col } = await import('/js/modules/ctx.js');
    const { access } = await import('/js/modules/site-access.js');
    let officer = 'readable';
    try { await access.list('officer'); } catch (e) { officer = e.code; }
    let write = 'ok';
    try { await col('talentLog').put({ member: 'x', qty: 1 }); } catch (e) { write = e.message; }
    return { meetings: col('meetings').list().length, policies: col('policies').list().length, gifts: col('gifts').list().length, officer, write };
  }, null);
  ok('선생님: 임원 자료 데이터 없음 · 임원 등급 못 읽음 · 쓰기 안 됨', tdata.meetings === 0 && tdata.policies === 0 && tdata.gifts === 0 && tdata.officer === 'no-access' && tdata.write !== 'ok', JSON.stringify(tdata));
  ok('선생님 화면에도 임원 자료 글자 없음', !(await T.content()).includes(SECRET_MEETING));

  // ---------- 7. 임원 (회계, PC) ----------
  const O = await device('officer');
  await login(O, 'acc-officer', codes['acc-officer']);
  ok('임원(회계) 메뉴: 선물·정책·임원회의·회계 (관리·필사노트 없음)', JSON.stringify(await menusOf(O)) === JSON.stringify(['home', 'photos', 'roster', 'birthdays', 'talent', 'plan', 'bulletin', 'gifts', 'policy', 'meetings', 'accounting']), (await menusOf(O)).join(','));
  await nav(O, '#/meetings');
  ok('임원: 임원회의 자료 + 첨부 파일', (await O.textContent('#view')).includes(SECRET_MEETING) && !!(await O.$('.file-chip')));
  await shotBoth(O, '6-officer-meetings');
  await nav(O, '#/accounting');
  ok('회계 직분: 회계 파일', (await O.textContent('#view')).includes('결의서'));
  // 임원은 올릴 수 있다: 달란트 +1 → 8
  await nav(O, '#/talent');
  await O.click(`li[data-id="${kidId}"] [data-act=plus]`);
  await O.waitForFunction((id) => document.querySelector(`li[data-id="${id}"] [data-bal]`).textContent === '8', kidId, { timeout: 60000 });
  ok('임원: 달란트 +1 올리기 → 8', true);
  ok('임원: 데이터 저장소(core)는 열지 않음', !(await O.evaluate(async () => (await import('/js/store.js')).core.status().open)));

  // ---------- 8. 임원 (서기) — 회계 메뉴 없음 ----------
  const O2 = await device('officer2');
  await login(O2, 'sec-officer', codes['sec-officer']);
  const m2 = await menusOf(O2);
  ok('임원(서기): 회계 메뉴 없음', m2.includes('meetings') && !m2.includes('accounting'), m2.join(','));
  await nav(O2, '#/accounting');
  ok('임원(서기): 회계 → 볼 수 없음', !!(await O2.$('.no-access')));

  // ---------- 9. 학부모 막기 → 열쇠 바뀜. 학부모는 못 들어오고 선생님은 그대로 ----------
  await nav(A, '#/admin/people');
  await A.waitForSelector('.ax-table tbody tr');
  const row = await A.$('.ax-table tbody tr:has-text("가부모")');
  await (await row.$('button.ax-danger')).click();
  await A.waitForSelector('dialog.ax-dialog[open]');
  ok('막기 확인 창: 이미 받은 것은 남을 수 있다고 말함', (await A.textContent('dialog.ax-dialog')).includes('남아 있을 수 있어요'));
  await A.click('dialog.ax-dialog button.ax-danger');
  await A.waitForFunction(() => document.querySelector('.ax-table tbody tr.ax-revoked'), null, { timeout: 120000 });
  // 관리자가 새 사진을 올림 (새 열쇠로)
  await ctxEval(A, async () => { const { col } = await import('/js/modules/ctx.js'); await col('videos').put({ title: '막은 뒤 영상', url: 'https://youtu.be/dQw4w9WgXcQ', date: '2026-11-01', vis: 'parent' }); });
  await P.evaluate(() => { location.hash = '#/home'; });
  await P.reload();
  await P.waitForSelector('.hero');
  await ready(P);
  await sleep(1500);
  ok('막힌 학부모: 기억한 기기도 공개 화면으로 (로그인 풀림)', await P.isVisible('#login-btn') && JSON.stringify(await menusOf(P)) === '["home"]');
  const relog = await (async () => {
    await P.click('#login-btn');
    await P.waitForSelector('form.ax-login');
    await P.fill('form.ax-login input[name=identifier]', 'ga-parent');
    await P.fill('form.ax-login input[name=code]', codes['ga-parent']);
    await P.click('form.ax-login button[type=submit]');
    await P.waitForFunction(() => document.querySelector('form.ax-login .ax-err')?.textContent.trim(), null, { timeout: 60000 });
    return P.textContent('form.ax-login .ax-err');
  })();
  ok('막힌 학부모: 예전 코드로 로그인 안 됨', !!relog.trim(), relog.trim());
  await T.reload();
  await T.waitForSelector('#user-chip:not([hidden])', { timeout: 60000 });
  await ready(T);
  await nav(T, '#/photos');
  ok('선생님: 막기 뒤에도 그대로 (새 열쇠 받음, 새 영상 보임)', (await T.textContent('#view')).includes('막은 뒤 영상'));

  // ---------- 10. 휴지통 ----------
  await nav(A, '#/plan');
  await A.click('.ev-list li [data-act=del]');
  await until(A, async () => (await import('/js/modules/ctx.js')).col('plan').list().length === 2);
  await nav(A, '#/trash');
  ok('휴지통에 연간계획 기록', (await A.textContent('#mt')).includes('연간계획'));
  await A.click('#mt [data-act=restore]');
  await A.waitForFunction(() => document.querySelector('#mt')?.textContent.includes('비어 있어요'), null, { timeout: 60000 });
  ok('되살리기', (await ctxEval(A, async () => (await import('/js/modules/ctx.js')).col('plan').list().length)) === 3);

  // ---------- 11. 가져오기 (진짜 seed, 개수만) ----------
  if (process.env.SEED) {
    const buf = await readFile(process.env.SEED);
    const seed = JSON.parse(buf.toString('utf8'));
    await nav(A, '#/admin/data');
    const [fc] = await Promise.all([A.waitForEvent('filechooser'), A.click('[data-d=seed]')]);
    await fc.setFiles({ name: 'seed.json', mimeType: 'application/json', buffer: buf });
    await A.waitForFunction(() => document.querySelector('#seed-res')?.dataset.done, null, { timeout: 600000 });
    const r = JSON.parse(await A.$eval('#seed-res', (e) => e.dataset.done));
    ok('가져오기: 개수가 파일과 같음', r.members === seed.members.length && r.giftItems === seed.giftItems.length && r.giftLog === seed.giftLog.length, JSON.stringify({ members: r.members, giftItems: r.giftItems, giftLog: r.giftLog }));
    const stock = await ctxEval(A, async () => { const { col } = await import('/js/modules/ctx.js'); const g = col('gifts').list().find((x) => x.seedKey); return col('giftLog').list().filter((l) => l.gift === g.id).reduce((s, l) => s + l.qty, 0); });
    ok('가져온 선물 재고 = 엑셀의 남은 개수', stock === seed.giftLog.reduce((s, l) => s + l.qty, 0), String(stock));
  }

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
await writeFile(join(OUT, 'result.json'), JSON.stringify({ summary, results, problems, notFound: notFound.length, shots }, null, 2));
console.log(`\n${summary}  (화면 사진 ${shots.length}장: ${OUT}) · access 의 '아직 없음' 404: ${notFound.length}번`);
if (problems.length) console.log('콘솔/CSP:', problems);
process.exit(fails.length ? 1 : 0);
