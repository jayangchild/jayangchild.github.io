// 앱 틀: 여는 화면(gate) → 메뉴, 화면 바꾸기(#/주소), 저장 상태, 설정·휴지통·충돌 화면
import { S, core, load, unload, migrateLegacy } from './store.js';
import { $, toast } from './ui.js';
import { ensureOpen } from './gate.js';
import { initChrome, updateChrome, renderSettings, renderTrash, renderConflicts } from './settings.js';
import { renderMake } from './pilsa/make.js';
import { renderPrint } from './pilsa/print.js';

const MENUS = [
  { key: 'pilsa', name: '필사노트', href: '#/pilsa/make' },
  { key: 'members', name: '멤버', href: '#/members' },
  { key: 'gifts', name: '선물', href: '#/gifts' },
];

function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'pilsa/make';
  const [path, query = ''] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(query) };
}

function renderNav(active) {
  const html = MENUS.map((m) => `<a href="${m.href}" class="${m.key === active ? 'on' : ''}">${m.name}</a>`).join('');
  $('#nav').innerHTML = html;
  $('#tabbar').innerHTML = html;
  $('#settings-btn').classList.toggle('on', ['settings', 'trash', 'conflicts'].includes(active));
}

function soon(title, items) {
  return `<div class="card soon"><div class="big">🌱</div><h2>${title}</h2><p class="muted">준비 중이에요. 곧 열어요.</p>
    <p class="small muted">${items}</p></div>`;
}

let shown = false;
let stale = false;

// 다 그리면 body[data-ready=1] (인쇄 확인·시험 도구가 기다린다)
async function render() {
  if (!shown || !S.data) return;
  document.body.dataset.ready = '';
  try {
    await draw();
  } finally {
    if (shown) document.body.dataset.ready = '1';
  }
}

async function draw() {
  stale = false;
  const { parts, q } = route();
  const view = $('#view');
  $('#print-root').innerHTML = '';
  const top = parts[0] || 'pilsa';
  renderNav(top);
  window.scrollTo(0, 0);
  updateChrome();
  view.onclick = view.onsubmit = null;
  if (top === 'settings') return renderSettings(view);
  if (top === 'trash') return renderTrash(view);
  if (top === 'conflicts') return renderConflicts(view);
  if (top === 'members') { view.innerHTML = soon('멤버', '학생·선생님 명단, 사진, 학년·반, 담임, 부모님 연락처, 생일'); return; }
  if (top === 'gifts') { view.innerHTML = soon('선물', '전도 선물 · 생일 선물 · 성경암송대회 선물'); return; }
  const sub = parts[1] || 'make';
  const subnav = `<nav class="subnav"><a href="#/pilsa/make" class="${sub === 'make' ? 'on' : ''}">필사노트 제작</a><a href="#/pilsa/print" class="${sub === 'print' ? 'on' : ''}">필사 인쇄</a></nav>`;
  view.innerHTML = subnav + '<div id="sub"></div>';
  const el = $('#sub');
  if (sub === 'print') await renderPrint(el, q);
  else await renderMake(el, parts[2] || '', q);
}

// ───── 다른 기기에서 고친 것이 왔을 때: 입력 중이 아니면 바로 다시 그린다 ─────
const editing = () => {
  const a = document.activeElement;
  return $('#modal').open || (a && $('#view').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
};
const renderIfStale = () => setTimeout(() => { if (stale && !editing()) render(); }, 300);
S.onRemote = (cols) => {
  updateChrome();
  if (!shown || !cols.some((c) => ['lessons', 'themes', 'files', 'sys'].includes(c))) return;
  if (editing()) { stale = true; return; }
  render();
};
$('#view').addEventListener('focusout', renderIfStale);
$('#modal').addEventListener('close', renderIfStale);

// ───── 저장 상태 · 잠김 ─────
S.onStatus = (s) => {
  updateChrome();
  // 잠금(직접 잠금 · 다른 기기에서 비밀번호가 바뀜 · 연결 끊기) → 여는 화면으로
  if (shown && s.state === 'locked') {
    shown = false;
    unload();
    if ($('#modal').open) $('#modal').close();
    start(s.errorCode === 'password-changed' ? s.error : '');
  }
};

async function start(msg = '') {
  $('#app').hidden = true;
  document.body.dataset.ready = '';
  await ensureOpen(msg);
  try {
    const c = await migrateLegacy();
    if (c) toast(`이 기기에 있던 예전 필사노트를 옮겼어요: 말씀 ${c.lessons}장, 디자인 ${c.themes}개, 그림 ${c.files}개`, 5000);
  } catch (e) {
    console.error(e);
    toast(e.message || '예전 데이터를 옮기지 못했어요. 예전 사본은 그대로 두었어요.', 6000);
  }
  await load();
  shown = true;
  $('#app').hidden = false;
  await render();
  document.body.dataset.ready = '1';
}

addEventListener('hashchange', () => {
  // 연결 QR 링크를 이미 열린 사이트에서 다시 연 경우 → 처음부터 (연결 화면)
  if (core.hasJoinLink(location.hash)) { location.reload(); return; }
  render();
});
initChrome();
await start();
