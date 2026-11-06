// 앱 틀: 첫 화면은 늘 공개 화면. 오른쪽 위 «로그인»(아이디 + 접속 코드, access-ui loginCard) → 그 역할의 메뉴가 열린다.
//   - 역할은 코드의 자리(slot)가 정한다 (js/core/access.js). 화면 모듈의 데이터는 모두 access 등급에 있다 (js/modules/ctx.js)
//   - 관리자 코드로 들어오면 데이터 저장소(core)도 같이 열린다 (access.openAdmin) → 필사노트·설정·사람 관리
//   - 처음 설정 · 사이트 비밀번호로 열기 · 관리자 기기 QR 연결: 로그인 화면의 작은 «관리자» → 여는 화면(gate.js)
import { S, core, load, unload, migrateLegacy } from './store.js';
import { $, toast } from './ui.js';
import { ensureOpen } from './gate.js';
import { initChrome, updateChrome, renderSettings, renderConflicts } from './settings.js';
import { renderMake } from './pilsa/make.js';
import { renderPrint } from './pilsa/print.js';
import { esc } from './pilsa/sheet.js';
import { access, ROLE_NAME } from './modules/site-access.js';
import { who, setWho, loadAll, clearData, canSee, coreOpen, menuCfg, roleText } from './modules/ctx.js';
import { MENUS, MENU, menuMin } from './modules/menus.js';
import { renderHome, renderLogin, renderMe, checkSetup } from './modules/home.js';
import { renderRoster, renderBirthdays } from './modules/roster.js';
import { renderTalent } from './modules/talent.js';
import { renderPlan } from './modules/plan.js';
import { renderDocs } from './modules/docs.js';
import { renderMedia } from './modules/media.js';
import { renderGifts } from './modules/gifts.js';
import { renderAdmin, setAdminHandle } from './modules/admin.js';
import { renderModuleTrash } from './modules/trash.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'home';
  const [path, query = ''] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(query) };
}

const hrefOf = (m) => (m.key === 'pilsa' ? '#/pilsa/make' : m.key === 'admin' ? '#/admin/people' : `#/${m.key}`);
function renderNav(active) {
  const menus = MENUS.filter((m) => canSee(m.key));
  const html = menus.map((m) => `<a href="${hrefOf(m)}" class="${m.key === active ? 'on' : ''}" data-menu="${m.key}"><span class="ic" aria-hidden="true">${m.icon}</span><span>${m.name}</span></a>`).join('');
  $('#nav-more .nav-more-menu').innerHTML = ''; // 지난번에 더보기로 옮긴 것 비우기
  $('#nav').innerHTML = html;
  $('#tabbar').innerHTML = html;
  $('#tabbar').hidden = menus.length < 2; // 메뉴가 하나뿐이면(방문자) 아래 막대는 빼기
  const tb = $('#tabbar'); // 휴대폰 아래 막대: 고른 메뉴가 보이게
  const on = tb.querySelector('a.on');
  if (on && tb.clientWidth) tb.scrollLeft += on.getBoundingClientRect().left - tb.getBoundingClientRect().left - tb.clientWidth / 2 + on.clientWidth / 2;
  const c = coreOpen();
  for (const id of ['#sync-chip', '#settings-btn', '#lock-btn']) $(id).hidden = !c;
  if (!c) $('#conflict-badge').hidden = true;
  $('#login-btn').hidden = who.role !== 'public';
  const chip = $('#user-chip');
  chip.hidden = who.role === 'public';
  chip.innerHTML = `<span class="ph-hide">${esc(who.name)} · </span>${esc(ROLE_NAME[who.role] || '')}`;
  chip.classList.toggle('on', active === 'me');
  $('#settings-btn').classList.toggle('on', ['settings', 'conflicts'].includes(active));
  fitNav();
}

// PC 위 메뉴: 한 줄에 다 들어가지 않으면 뒤에서부터(필사노트·선물·정책·임원회의·회계·관리) «더보기» 안으로. 잘리는 메뉴가 없다
function fitNav() {
  const nav = $('#nav');
  const more = $('#nav-more');
  const box = more.querySelector('.nav-more-menu');
  for (const a of [...box.children]) nav.append(a);
  more.hidden = true;
  more.open = false;
  if (!nav.clientWidth || nav.scrollWidth <= nav.clientWidth + 1) return;
  more.hidden = false;
  while (nav.children.length > 1 && nav.scrollWidth > nav.clientWidth + 1) box.prepend(nav.lastElementChild);
  const on = box.querySelector('a.on');
  const sum = more.querySelector('summary');
  sum.textContent = on ? on.lastElementChild.textContent : '더보기';
  sum.classList.toggle('on', !!on);
}
let fitTimer = 0;
addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitNav, 120); });
$('#nav-more').addEventListener('click', (e) => { if (e.target.closest('a')) $('#nav-more').open = false; });
document.addEventListener('click', (e) => { if (!e.target.closest('#nav-more')) $('#nav-more').open = false; });

function noAccess(view, key) {
  const m = MENU[key];
  const need = m ? menuMin(key, menuCfg()) : 'officer';
  if (who.role === 'public') {
    view.innerHTML = `<div class="card soon"><div class="big">🔒</div><h2>${esc(m?.name || '이 화면')}</h2><p class="muted">로그인하면 볼 수 있어요.</p><a class="btn primary" href="#/login">로그인</a> <a class="btn" href="#/home">공개 화면</a></div>`;
  } else {
    view.innerHTML = `<div class="card soon no-access"><div class="big">🙈</div><h2>${esc(m?.name || '이 화면')}</h2><p class="muted">${esc(ROLE_NAME[need])}${m?.label ? `(${esc(m.label)})` : ''}부터 볼 수 있어요. 지금은 ${esc(roleText())}(으)로 들어와 있어요.</p><a class="btn" href="#/home">공개 화면</a></div>`;
  }
}

let stale = false;

// 다 그리면 body[data-ready=1] (인쇄 확인·시험 도구가 기다린다)
async function render() {
  if (!$('#gate').hidden) return;
  document.body.dataset.ready = '';
  try {
    await draw();
  } catch (e) {
    console.warn(e);
    $('#view').innerHTML = `<div class="card"><p class="err">화면을 그리지 못했어요: ${esc(e.message || e)}</p></div>`;
  } finally {
    document.body.dataset.ready = '1';
  }
}

async function draw() {
  stale = false;
  const { parts, q } = route();
  const view = $('#view');
  $('#print-root').innerHTML = '';
  const top = parts[0] || 'home';
  renderNav(top);
  window.scrollTo(0, 0);
  if (coreOpen()) updateChrome(); else $('#banner').innerHTML = '';
  view.onclick = view.onsubmit = null;
  view.dataset.screen = top;
  if (top === 'login') {
    if (who.role !== 'public') { location.replace('#/home'); return; }
    return renderLogin(view, { onLogin: loginDone, onAdmin: () => adminOpen() });
  }
  if (top === 'me') return who.role === 'public' ? renderLogin(view, { onLogin: loginDone, onAdmin: () => adminOpen() }) : renderMe(view, { onLogout: logout });
  if (top === 'trash') return who.write || coreOpen() ? renderModuleTrash(view) : noAccess(view, 'admin');
  if (top === 'settings' || top === 'conflicts') {
    if (!coreOpen()) return noAccess(view, 'admin');
    return top === 'settings' ? renderSettings(view) : renderConflicts(view);
  }
  const key = MENU[top] ? top : 'home';
  if (!canSee(key)) return noAccess(view, key);
  if (key === 'home') return renderHome(view, { onLogin: () => { location.hash = '#/login'; }, onSetup: () => adminOpen() });
  if (key === 'photos') return renderMedia(view, q);
  if (key === 'roster') return renderRoster(view, q);
  if (key === 'birthdays') return renderBirthdays(view);
  if (key === 'talent') return renderTalent(view, q);
  if (key === 'plan') return renderPlan(view, q);
  if (key === 'bulletin' || key === 'policy' || key === 'meetings' || key === 'accounting') return renderDocs(view, key);
  if (key === 'gifts') return renderGifts(view, q);
  if (key === 'admin') return renderAdmin(view, parts[1]);
  // 필사노트 (데이터 저장소)
  const sub = parts[1] || 'make';
  const subnav = `<nav class="subnav"><a href="#/pilsa/make" class="${sub === 'make' ? 'on' : ''}">필사노트 제작</a><a href="#/pilsa/print" class="${sub === 'print' ? 'on' : ''}">필사 인쇄</a></nav>`;
  view.innerHTML = subnav + '<div id="sub"></div>';
  const el = $('#sub');
  if (sub === 'print') await renderPrint(el, q);
  else await renderMake(el, parts[2] || '', q);
}

// ───── 다른 기기에서 고친 것(필사노트)이 왔을 때: 입력 중이 아니면 바로 다시 그린다 ─────
const editing = () => {
  const a = document.activeElement;
  return $('#modal').open || (a && $('#view').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
};
const renderIfStale = () => setTimeout(() => { if (stale && !editing()) render(); }, 300);
S.onRemote = (cols) => {
  updateChrome();
  if (!cols.some((c) => ['lessons', 'themes', 'files', 'sys'].includes(c)) || !location.hash.startsWith('#/pilsa')) return;
  if (editing()) { stale = true; return; }
  render();
};
$('#view').addEventListener('focusout', renderIfStale);
$('#modal').addEventListener('close', renderIfStale);

// ───── 저장 상태 · 잠김 ─────
let leaving = false;
S.onStatus = (s) => {
  if (coreOpen() || s.state === 'locked') updateChrome();
  // 데이터 저장소가 잠김(직접 잠금 · 다른 기기에서 비밀번호가 바뀜 · 연결 끊기) → 공개 화면으로
  if (s.state === 'locked' && who.role !== 'public' && who.admin && !leaving) {
    if ($('#modal').open) $('#modal').close();
    toPublic(s.errorCode === 'password-changed' ? s.error : '잠갔어요. 데이터·비밀번호·접속 코드는 그대로예요. 못 올린 것은 다시 들어오면 올라가요.');
  }
};

async function toPublic(msg = '') {
  document.body.dataset.ready = '';
  leaving = true;
  try {
    setAdminHandle(null);
    await access.logout();
    if (coreOpen()) { await core.forgetSession(); await core.lock(); }
    unload();
    clearData();
    setWho(null);
    await loadAll().catch((e) => console.warn(e));
  } finally {
    leaving = false;
  }
  if (msg) toast(msg, 5000);
  if (location.hash !== '#/home') location.hash = '#/home'; else render();
}
const logout = () => toPublic('로그아웃했어요. 데이터와 접속 코드는 그대로예요.');

// 데이터 저장소가 열린 뒤 필사노트 준비
async function enterCore() {
  try {
    const c = await migrateLegacy();
    if (c) toast(`이 기기에 있던 예전 필사노트를 옮겼어요: 말씀 ${c.lessons}장, 디자인 ${c.themes}개, 그림 ${c.files}개`, 5000);
  } catch (e) {
    console.warn(e);
    toast(e.message || '예전 데이터를 옮기지 못했어요. 예전 사본은 그대로 두었어요.', 6000);
  }
  await load();
}

// 로그인한 뒤 (코드 로그인 · 기억한 기기 · 처음 설정 직후)
async function enterAccess(r) {
  setWho(r);
  if (r.isAdmin) {
    try {
      setAdminHandle(await access.openAdmin(core)); // 같은 로그인으로 데이터 저장소까지
      await enterCore();
    } catch (e) {
      console.warn(e);
      toast(`데이터 저장소를 열지 못했어요: ${e.message}`, 6000);
    }
  }
  await loadAll();
}

async function afterLogin(r) {
  document.body.dataset.ready = '';
  try {
    await enterAccess(r);
  } catch (e) {
    if (e.code === 'revoked') return toPublic(e.message);
    throw e;
  }
  toast(`${r.name} 님, 반가워요.`);
  if (location.hash !== '#/home') location.hash = '#/home'; else render();
}

const loginDone = (r) => afterLogin(r).catch((e) => { console.warn(e); toast(e.message || String(e), 6000); render(); });

// 관리자: 처음 설정 · 사이트 비밀번호 · QR 연결 (여는 화면)
async function adminOpen(msg = '') {
  document.body.dataset.ready = ''; // 다 열고 다시 그릴 때까지 (시험 도구가 기다린다)
  const ok = await ensureOpen(msg);
  $('#app').hidden = false;
  if (!ok) { render(); return; }
  const me = access.me();
  if (me?.isAdmin) return loginDone(me);
  // 관리자 코드 없이 사이트 비밀번호로: 필사노트·설정·사람 관리(처음 준비 / 명단 복구)만
  setWho({ role: 'admin', name: core.status().user, canWrite: false, isAdmin: true });
  who.vaultOnly = true;
  await enterCore();
  location.hash = '#/admin/people';
  render();
}
// 관리 → 접속 코드 처음 준비가 끝나면 관리자로 로그인된 상태 (access.setup)
document.addEventListener('access-admin', async () => {
  const me = access.me();
  if (!me) return;
  setWho(me);
  await loadAll();
  renderNav(route().parts[0]);
});

// 처음: 공개 화면을 바로 보여 주고, 기억한 기기면 조용히 다시 들어간다
async function start() {
  $('#gate').hidden = true;
  $('#app').hidden = false;
  initChrome();
  if (core.hasJoinLink(location.hash)) { await core.ready; return adminOpen(); } // 관리자 기기 QR 연결
  // 공개 내용은 GitHub Pages 에서 바로 읽는다 — 이 기기 저장소(IndexedDB, core.ready·기억한 로그인)를 기다리지 않는다.
  // 그래서 IndexedDB 가 느리거나 막힌 브라우저에서도 첫 화면이 뜬다. 공개 내용·keyring.json 이 아직 없으면(처음 설정 전) 404 →
  // 기본 소개 + 관리자용 «처음 설정». 1.5초 안에 못 받으면 기본 소개부터 그리고, 다 받으면 아래에서 다시 그린다
  let pubOk = false;
  const pub = loadAll().then(() => { pubOk = true; }, (e) => console.warn(e)).then(checkSetup);
  await Promise.race([pub, sleep(1500)]);
  await render();
  await Promise.race([pub, sleep(10000)]);
  await core.ready;
  try {
    const r = await access.resume();
    if (r) await enterAccess(r);
    else if (!pubOk) await loadAll();
  } catch (e) {
    console.warn(e);
    if (e.code === 'revoked') toast(e.message, 6000);
    await access.logout().catch(() => {});
    setWho(null);
    await loadAll().catch(() => {});
  }
  await render();
}

// 화면으로 돌아오면 새로 올라온 것을 받는다 (1분에 한 번까지)
let lastPull = Date.now();
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || Date.now() - lastPull < 60000) return;
  lastPull = Date.now();
  try { await loadAll(); if (!editing()) render(); } catch (e) {
    if (e.code === 'revoked') toPublic(e.message);
  }
});

addEventListener('hashchange', () => {
  // 연결 QR 링크를 이미 열린 사이트에서 다시 연 경우 → 처음부터 (연결 화면)
  if (core.hasJoinLink(location.hash)) { location.reload(); return; }
  render();
});
await start();
