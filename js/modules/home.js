// 공개 화면(누구나 보는 첫 화면)과 로그인 화면, 내 정보.
//   pages { title, body, photos: [파일 id], order, show } — 공개 등급(평문). 관리자가 관리 → 공개 페이지에서 고친다.
//   로그인은 하나: access-ui 의 loginCard (아이디 + 접속 코드, 역할 고르기 없음)
import { col, who, fileURL, isOffline, roleText } from './ctx.js';
import { $, $$, esc, head, empty } from './kit.js';
import { access } from './site-access.js';
import { loginCard } from '../core/access-ui.js';
import { core } from '../store.js';

// 관리자가 공개 페이지를 아직 올리지 않았을 때(처음 설정 전 포함) 보이는 기본 소개.
// 사실(시간·장소·학년)은 넣지 않는다 — 그건 관리자가 관리 → 공개 페이지에서 쓴다
const DEFAULT_PAGES = [
  { id: 'intro', title: '유년부 소개', body: '자양교회 유년부 어린이들과 선생님들의 공간이에요. 함께 예배하고 말씀을 배우는 이야기를 이곳에서 나눠요.', order: 1 },
  { id: 'notice', title: '안내', body: '예배 시간·장소와 소식은 준비되는 대로 이곳에 올려 드릴게요.', order: 2 },
];

// 처음 설정 전인지 (keyring.json 이 아직 없음) → 공개 화면 아래에 관리자용 «처음 설정».
// 공개 페이지가 하나도 없을 때만 확인한다 (설정이 끝난 사이트는 keyring 을 받지 않음)
let preSetup = false;
export async function checkSetup() {
  if (col('pages').list().length) { preSetup = false; return; }
  try { preSetup = !(await access.keyring()); } catch (e) { if (e.code !== 'offline') console.warn(e); }
}

export function pagesForView() {
  const list = col('pages').list().filter((p) => p.show !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return list.length ? list : DEFAULT_PAGES;
}

export async function renderHome(el, { onLogin, onSetup } = {}) {
  const pages = pagesForView();
  el.innerHTML = `<section class="hero"><img src="assets/logo.png" alt=""><div><h1>자양교회 유년부</h1><p>하나님을 사랑하고 친구를 사랑하는 어린이</p></div>
      ${who.role === 'public' ? '<button class="btn primary big login-cta" type="button" data-login>로그인</button>' : `<p class="small hello">${esc(who.name)} 님 · ${esc(roleText())}</p>`}</section>
    ${isOffline() ? '<div class="banner">인터넷이 없어서 기본 소개만 보여요.</div>' : ''}
    ${who.admin ? '<p class="small muted">고친 내용은 공개 사이트에 1~2분 뒤 보여요. <a href="#/admin/pages">공개 페이지 고치기</a></p>' : ''}
    <div class="page-list">${pages.map((p) => `<article class="card pub-page" id="pg-${esc(p.id)}"><h2>${esc(p.title)}</h2>
      <div class="pub-body">${esc(p.body || '')}</div>
      ${(p.photos || []).length ? `<div class="pub-photos">${p.photos.map((f) => `<img data-file="${esc(f)}" alt="${esc(p.title)}">`).join('')}</div>` : ''}</article>`).join('') || empty('아직 소개 글이 없어요.')}</div>
    ${who.role === 'public' ? `<div class="card login-hint"><b>학부모님·선생님</b><p class="small muted">관리자에게 받은 <b>아이디와 접속 코드</b>로 로그인하면 사진·명단 같은 내용을 볼 수 있어요.</p><button class="btn" type="button" data-login>로그인</button></div>` : ''}
    ${who.role === 'public' && preSetup ? '<p class="small muted setup-hint">관리자(임원)이신가요? 사이트를 아직 처음 설정하지 않았어요. <button class="btn ghost small" type="button" data-setup>처음 설정</button></p>' : ''}`;
  for (const img of $$('img[data-file]', el)) fileURL(img.dataset.file).then((u) => { if (u) img.src = u; });
  for (const b of $$('[data-login]', el)) b.onclick = () => onLogin?.();
  for (const b of $$('[data-setup]', el)) b.onclick = () => onSetup?.();
}

// ---------- 로그인 (한 화면, 역할 고르기 없음) ----------
export function renderLogin(el, { onLogin, onAdmin }) {
  const adminDevice = core.status().connected;
  el.innerHTML = `<div class="login-wrap"><div class="login-col">
    <p class="muted small center">학부모·선생님·임원·관리자 모두 여기서 들어와요. 관리자에게 받은 <b>아이디</b>와 <b>접속 코드</b>를 넣으세요.</p>
    <div id="login-slot"></div>
    ${adminDevice ? '<div class="info-box">이 기기는 <b>관리자 기기</b>로 연결되어 있어요. 관리자 코드가 없으면 <button class="btn small" type="button" data-admin>사이트 비밀번호로 열기</button></div>' : ''}
    <div class="gate-links"><a class="btn ghost small" href="#/home">← 공개 화면</a><button class="btn ghost small admin-link" type="button" data-admin title="처음 설정 · 사이트 비밀번호 · 관리자 기기 연결(QR)">관리자</button></div>
  </div></div>`;
  const card = loginCard({ access, onLogin, onCancel: () => { location.hash = '#/home'; } });
  $('#login-slot', el).append(card);
  card.querySelector('input')?.focus();
  for (const b of $$('[data-admin]', el)) b.onclick = () => onAdmin();
}

export function renderMe(el, { onLogout }) {
  el.innerHTML = head('내 정보') + `<div class="card"><dl class="kv"><dt>이름</dt><dd>${esc(who.name)}</dd><dt>역할</dt><dd>${esc(roleText())}</dd>
</dl>
    <p class="small muted">${who.write ? '임원·관리자는 내용을 고칠 수 있어요. 고친 것은 바로 올라가고, 공개 사이트에는 1~2분 뒤 보여요.' : '보기만 할 수 있어요. 사이트는 누가 언제 들어왔는지 기록하지 않아요 (서버가 없어서 기록할 곳이 없어요).'}</p>
    <div class="row"><a class="btn" href="#/home">공개 화면 보기</a>${core.status().open ? '<a class="btn" href="#/settings">설정</a>' : ''}<button class="btn primary" type="button" id="me-out">로그아웃</button></div>
    <p class="hint">로그아웃해도 데이터와 접속 코드는 그대로예요. ${core.status().open ? '데이터 저장소에서 아직 못 올린 것은 이 기기에 남아 있다가 다시 들어오면 올라가요.' : ''}</p></div>`;
  $('#me-out', el).onclick = () => onLogout();
}
