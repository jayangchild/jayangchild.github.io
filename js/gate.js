// 여는 화면들: 처음 설정(관리자) · 비밀번호로 열기 · QR로 들어온 새 기기 · 복구 코드 · 이름 정하기.
// ensureOpen() 은 데이터가 열리고 이 기기 사용자 이름이 정해지면 끝난다. 그 전까지 앱 화면(#app)은 숨긴다.
// 말투·흐름은 personal-hub(js/app.js 의 잠금 화면)와 같게: 무엇이 그대로인지(데이터·비밀번호·복구 코드) 늘 밝힌다.

import { core, legacyInfo } from './store.js';
import { $, toast, download } from './ui.js';
import { esc } from './pilsa/sheet.js';

const MIN_PW = 8;
const card = () => $('#gate-card');

function show(html) {
  $('#app').hidden = true;
  $('#gate').hidden = false;
  card().innerHTML = `<div class="gate-logo"><img src="assets/logo.png" alt=""><span>자양교회 유년부</span></div>${html}`;
  card().querySelector('input:not([type=hidden]):not(.sr-only):not([type=checkbox])')?.focus();
  window.scrollTo(0, 0);
}

function hide() {
  $('#gate').hidden = true;
  card().innerHTML = '';
}

// 버튼을 잠깐 막고, 오류는 그 화면의 .err 에 보여 준다
async function busy(form, label, fn) {
  const btn = form.querySelector('button[type=submit]');
  const err = form.querySelector('.err');
  const text = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  if (err) err.textContent = '';
  try {
    await fn();
  } catch (ex) {
    console.warn(ex);
    if (err && document.contains(err)) err.textContent = ex.message || String(ex);
    else toast(ex.message || String(ex));
  } finally {
    if (document.contains(btn)) { btn.disabled = false; btn.textContent = text; }
  }
}

// 비밀번호 관리 앱이 사이트 비밀번호를 기억할 수 있게 (화면에는 안 보임)
const userField = () => '<input class="sr-only" type="text" name="username" autocomplete="username" value="자양교회 유년부" tabindex="-1" aria-hidden="true">';

export const REMEMBER_HTML = `
  <label class="check"><input type="checkbox" name="remember"> 이 기기 기억하기(30일)</label>
  <p class="hint">켜면 30일 동안 이 기기에서는 비밀번호 없이 열려요. <b>나만 쓰는 휴대폰·PC에서만</b> 켜세요. 교회 공용 PC에서는 켜지 마세요.</p>`;

// 토큰 만드는 방법 (README 와 같은 내용)
export const TOKEN_HELP = `
  <details class="help">
    <summary>토큰 만드는 방법 (관리자)</summary>
    <ol>
      <li>GitHub에 <b>jayangchild</b> 계정으로 로그인한 뒤 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">새 토큰 만들기</a>를 여세요.
        <span class="muted">(오른쪽 위 사진 → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token)</span></li>
      <li><b>Token name</b>: jayangchild-site (날짜를 붙여도 좋아요)</li>
      <li><b>Expiration</b>: 고를 수 있는 것 중 <b>가장 긴 것</b> (No expiration이 있으면 그것, 없으면 Custom으로 1년 뒤). 만료일을 아래 칸과 달력에 적어 두세요.</li>
      <li><b>Repository access</b>: <b>Only select repositories</b> → <b>jayangchild-data</b> 하나만</li>
      <li><b>Permissions → Repository permissions</b>: <b>Contents</b> = Read and write, <b>Metadata</b> = Read-only (자동으로 정해져요). 나머지는 그대로(No access)</li>
      <li><b>Generate token</b> → 나온 토큰(github_pat_…)을 복사해 여기에 붙여 넣기. 토큰은 따로 보관하지 않아도 돼요 (사이트가 암호화해서 보관해요).</li>
    </ol>
  </details>`;

// 토큰 만료일 칸 (personal-hub 와 같음). '만료 없음'이면 'none'
export const expField = (name, cur = '') => {
  const none = cur === 'none';
  const inAYear = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  return `<div class="exp-field">
    <label class="field">토큰 만료일 <small class="muted">(GitHub에 나온 날짜. 만료 2주 전부터 알려 드려요)</small>
      <input type="date" name="${name}" value="${none ? '' : esc(cur || inAYear)}" ${none ? 'disabled' : ''}></label>
    <label class="check small"><input type="checkbox" data-no-exp="${name}" ${none ? 'checked' : ''}> 만료 없음 (No expiration)</label></div>`;
};
export const expValue = (input) => (input.disabled ? 'none' : input.value || '');
document.addEventListener('change', (e) => {
  const n = e.target.dataset?.noExp;
  if (!n) return;
  const inp = e.target.form?.elements[n];
  if (inp) inp.disabled = e.target.checked;
});

// 토큰 만료일은 암호화된 설정(sys 의 'token' 기록)에 둔다 → 모든 기기에 보인다
export async function saveTokenExp(exp) {
  if (exp === undefined) return;
  await core.collection('sys').put({ id: 'token', exp, setAt: new Date().toISOString() });
}

// ---------- 복구 코드 (꼭 보관하게) ----------

// 복구 코드를 보여 주고, 저장했다는 확인(체크 + 마지막 4글자)을 받아야 다음으로 간다.
// box: 넣을 곳, onDone: 확인한 뒤
export function recoveryCodeBox(box, code, onDone, { doneLabel = '보관했어요. 계속' } = {}) {
  const last4 = code.replace(/[^A-Z0-9]/gi, '').slice(-4).toUpperCase();
  box.innerHTML = `
    <div class="danger-box">
      <b>⚠ 이 코드는 지금 한 번만 보여요.</b>
      사이트 비밀번호를 모두 잊었을 때 데이터를 여는 <b>유일한 방법</b>이에요. 이 코드도 잃어버리면
      아무도(GitHub 직원도) 데이터를 열 수 없어요.
    </div>
    <div class="code-box" id="rc-text">${esc(code)}</div>
    <div class="row center">
      <button class="btn small" type="button" data-rc="copy">복사</button>
      <button class="btn small" type="button" data-rc="save">파일로 저장</button>
      <button class="btn small" type="button" data-rc="print">인쇄</button>
    </div>
    <ul class="small muted tight">
      <li><b>종이에 적어</b> 인수인계 봉투에 넣거나, 저장한 파일을 안전한 곳(관리자 PC·USB)에 두세요.</li>
      <li>선생님들과 공유하지 마세요. 카카오톡 단체방·메일에 올리지 마세요.</li>
      <li>사이트 비밀번호와 따로 보관하세요.</li>
    </ul>
    <label class="check"><input type="checkbox" id="rc-ok"> 복구 코드를 종이에 적었거나 파일로 저장했어요</label>
    <label class="field"><span>확인: 복구 코드의 <b>마지막 4글자</b>를 넣어 주세요</span>
      <input type="text" id="rc-last" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" style="max-width:140px"></label>
    <button class="btn primary wide" type="button" id="rc-next" disabled>${esc(doneLabel)}</button>`;
  const ok = box.querySelector('#rc-ok');
  const last = box.querySelector('#rc-last');
  const next = box.querySelector('#rc-next');
  const check = () => { next.disabled = !(ok.checked && last.value.trim().toUpperCase() === last4); };
  ok.onchange = check;
  last.oninput = check;
  box.querySelector('[data-rc=copy]').onclick = async () => {
    try { await navigator.clipboard.writeText(code); toast('복사했어요. 메모장 등에 붙여 저장하세요.'); } catch { toast('복사하지 못했어요. 종이에 직접 적어 두세요.'); }
  };
  box.querySelector('[data-rc=save]').onclick = () => download('자양교회유년부_복구코드.txt',
    `자양교회 유년부 사이트 — 복구 코드\n\n${code}\n\n만든 날: ${new Date().toLocaleString('ko-KR')}\n\n` +
    '사이트 비밀번호를 모두 잊었을 때 이 코드로 새 비밀번호를 정할 수 있어요.\n' +
    '선생님들과 공유하지 말고, 관리자만 안전한 곳에 보관하세요.\n', 'text/plain');
  box.querySelector('[data-rc=print]').onclick = () => {
    const root = $('#print-root');
    root.innerHTML = `<div class="print-code"><h1>자양교회 유년부 사이트 — 복구 코드</h1><p class="code">${esc(code)}</p>
      <p>만든 날: ${esc(new Date().toLocaleString('ko-KR'))}</p><p>사이트 비밀번호를 모두 잊었을 때 이 코드로 새 비밀번호를 정할 수 있어요. 관리자만 보관하세요.</p></div>`;
    const done = () => { removeEventListener('afterprint', done); root.innerHTML = ''; };
    addEventListener('afterprint', done);
    window.print();
  };
  next.onclick = () => onDone();
}

// ---------- 화면들 ----------

let finish = null; // ensureOpen 의 resolve

async function opened() {
  if (!core.status().user) return nameScreen();
  hide();
  const f = finish;
  finish = null;
  f?.();
}

async function welcomeScreen(err = '') {
  const legacy = await legacyInfo();
  show(`
    <h1>이 기기 연결</h1>
    <p class="muted">이 기기는 아직 연결되지 않았어요. 필사노트 같은 데이터는 비공개 GitHub 저장소에 <b>암호화되어</b> 있고, 연결하면 그대로 보여요.</p>
    ${err ? `<p class="err" role="alert">${esc(err)}</p>` : ''}
    ${legacy ? `<div class="info-box">이 기기(브라우저)에 예전에 저장한 필사노트가 있어요 (${legacy.items}개${legacy.files ? `, 그림 ${legacy.files}개` : ''}). 연결해서 열면 자동으로 옮겨요. 옮기기 전에는 지우지 않아요.</div>` : ''}
    <div class="info-box">
      <b>선생님이라면 — QR로 연결해요</b>
      <ol class="steps-list">
        <li>이미 쓰고 있는 선생님(또는 관리자)께 <b>설정 → 새 기기 연결(QR)</b> 을 열어 달라고 하세요.</li>
        <li>이 휴대폰의 <b>카메라</b>로 그 QR을 찍고, 뜨는 링크를 누르세요.</li>
        <li>열린 화면에서 <b>사이트 비밀번호</b>와 이름을 넣으면 끝이에요.</li>
      </ol>
      <details class="help"><summary>QR을 찍을 수 없을 때 (연결 링크 붙여 넣기)</summary>
        <form id="f-link" class="stack" autocomplete="off">
          <input type="text" name="link" placeholder="https://jayangchild.github.io/#join=…" required>
          <button class="btn" type="submit">연결</button>
          <p class="err" role="alert"></p>
        </form>
      </details>
    </div>
    <details class="help admin">
      <summary>관리자(임원)용</summary>
      <div class="stack">
        <button class="btn" type="button" data-g="setup">처음 설정하기 (한 번만)</button>
        <p class="hint">비어 있는 데이터 저장소(jayangchild-data)에 처음으로 사이트 비밀번호를 정해요.</p>
        <button class="btn" type="button" data-g="token">GitHub 토큰으로 이 기기 연결</button>
        <p class="hint">이미 설정했는데, 연결된 기기가 하나도 없을 때 (데이터·비밀번호·복구 코드는 그대로예요).</p>
        <button class="btn" type="button" data-g="recover">비밀번호를 모두 잊었어요 (복구 코드)</button>
      </div>
    </details>`);
  $('#f-link').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f, '연결 중…', async () => {
      const v = f.link.value.trim();
      if (!core.hasJoinLink(v)) throw new Error('연결 링크가 아니에요. 링크 전체(…#join=…)를 붙여 넣어 주세요.');
      await core.joinFromQR(v);
      joinScreen();
    });
  };
  card().querySelector('[data-g=setup]').onclick = () => setupScreen();
  card().querySelector('[data-g=token]').onclick = () => tokenScreen();
  card().querySelector('[data-g=recover]').onclick = () => recoverScreen();
}

function setupScreen() {
  show(`
    <h1>처음 설정하기</h1>
    <p class="muted">관리자가 한 번만 해요. 끝나면 <b>복구 코드</b>를 드려요.</p>
    <form id="f-setup" class="stack" autocomplete="off">
      ${userField()}
      <h3>① GitHub 토큰 붙여 넣기</h3>
      <input type="password" name="token" placeholder="github_pat_…" required autocomplete="off" spellcheck="false">
      ${TOKEN_HELP}
      ${expField('exp')}
      <h3>② 사이트 비밀번호 정하기</h3>
      <p class="hint">선생님들이 모두 함께 쓰는 비밀번호예요. ${MIN_PW}자 이상, 짐작하기 어렵게 (예: 띄어쓰기 없는 짧은 문장 + 숫자).</p>
      <input type="password" name="pw" placeholder="사이트 비밀번호 (${MIN_PW}자 이상)" autocomplete="new-password" required minlength="${MIN_PW}">
      <input type="password" name="pw2" placeholder="한 번 더" autocomplete="new-password" required>
      <h3>③ 내 이름</h3>
      <input type="text" name="user" placeholder="예: 이민경" maxlength="40" required autocomplete="off">
      <button class="btn primary wide" type="submit">설정하기</button>
      <p class="err" role="alert"></p>
    </form>
    <div class="gate-links"><button class="btn ghost small" type="button" data-g="back">돌아가기</button></div>`);
  card().querySelector('[data-g=back]').onclick = () => welcomeScreen();
  $('#f-setup').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f, '설정하는 중…', async () => {
      if (f.pw.value.length < MIN_PW) throw new Error(`사이트 비밀번호는 ${MIN_PW}자 이상으로 정해 주세요.`);
      if (f.pw.value !== f.pw2.value) throw new Error('비밀번호 두 칸이 서로 달라요.');
      let code;
      try {
        code = await core.setup(f.token.value.trim(), f.pw.value, { user: f.user.value.trim() });
      } catch (ex) {
        if (ex.code === 'already-setup') throw new Error('이미 설정된 저장소예요. 돌아가서 "GitHub 토큰으로 이 기기 연결"을 쓰세요.');
        throw ex;
      }
      await saveTokenExp(expValue(f.exp)).catch(() => {});
      codeScreen(code);
    });
  };
}

function codeScreen(code) {
  show(`<h1>복구 코드 — 꼭 보관하세요</h1><div id="rc-box"></div>`);
  recoveryCodeBox($('#rc-box'), code, () => opened(), { doneLabel: '보관했어요. 시작하기' });
}

function tokenScreen() {
  show(`
    <h1>토큰으로 이 기기 연결</h1>
    <p class="muted">관리자용이에요. 이미 설정한 데이터 저장소에 이 기기를 연결해요. <b>데이터·사이트 비밀번호·복구 코드는 그대로</b>예요.</p>
    <form id="f-token" class="stack" autocomplete="off">
      ${userField()}
      <input type="password" name="token" placeholder="GitHub 토큰 (github_pat_…)" required autocomplete="off">
      <input type="password" name="pw" placeholder="사이트 비밀번호" autocomplete="current-password" required>
      ${REMEMBER_HTML}
      <button class="btn primary wide" type="submit">연결하고 열기</button>
      <p class="err" role="alert"></p>
    </form>
    ${TOKEN_HELP}
    <div class="gate-links"><button class="btn ghost small" type="button" data-g="back">돌아가기</button></div>`);
  card().querySelector('[data-g=back]').onclick = () => welcomeScreen();
  $('#f-token').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f, '연결 중…', async () => {
      await core.connectWithToken(f.token.value.trim(), f.pw.value);
      if (f.remember.checked) await core.rememberDevice(30);
      opened();
    });
  };
}

function joinScreen() {
  const s = core.status();
  show(`
    <h1>이 기기를 연결했어요</h1>
    <p class="muted">이제 <b>사이트 비밀번호</b>를 넣어 주세요. (선생님들이 함께 쓰는 비밀번호예요. 모르면 관리자에게 물어보세요)</p>
    <form id="f-join" class="stack">
      ${userField()}
      <input type="password" name="pw" placeholder="사이트 비밀번호" autocomplete="current-password" required>
      <label class="field">내 이름 <small class="muted">(누가 고쳤는지 보여 줄 때 써요)</small>
        <input type="text" name="user" value="${esc(s.user)}" placeholder="예: 김은혜" maxlength="40" required autocomplete="off"></label>
      ${REMEMBER_HTML}
      <button class="btn primary wide" type="submit">열기</button>
      <p class="err" role="alert"></p>
    </form>`);
  $('#f-join').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f, '여는 중…', async () => {
      await core.open(f.pw.value, { remember: f.remember.checked });
      await core.setUser(f.user.value.trim());
      toast('연결했어요. 이제 이 기기에서도 쓸 수 있어요.');
      opened();
    });
  };
}

function unlockScreen(msg = '') {
  const s = core.status();
  show(`
    <h1>${s.user ? `${esc(s.user)} 님, 반가워요` : '비밀번호로 열기'}</h1>
    <p class="muted">사이트 비밀번호를 넣어 주세요.</p>
    <form id="f-unlock" class="stack">
      ${userField()}
      <input type="password" name="pw" placeholder="사이트 비밀번호" autocomplete="current-password" required>
      ${REMEMBER_HTML}
      <button class="btn primary wide" type="submit">열기</button>
      <p class="err" role="alert">${esc(msg)}</p>
    </form>
    <div class="gate-links">
      <button class="btn ghost small" type="button" data-g="recover">비밀번호를 잊었어요</button>
      <button class="btn ghost small" type="button" data-g="reqr">QR로 다시 연결</button>
    </div>
    <div id="reqr" class="info-box" hidden>
      연결된 다른 기기에서 <b>설정 → 새 기기 연결(QR)</b>을 열고, 이 기기 카메라로 QR을 찍으세요.
      다시 연결해도 <b>이 기기에 저장한 것·데이터·비밀번호·복구 코드는 그대로</b>예요.
    </div>`);
  $('#f-unlock').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f, '여는 중…', async () => {
      await core.open(f.pw.value, { remember: f.remember.checked });
      opened();
    });
  };
  card().querySelector('[data-g=recover]').onclick = () => recoverScreen();
  card().querySelector('[data-g=reqr]').onclick = () => { $('#reqr').hidden = !$('#reqr').hidden; };
}

function recoverScreen() {
  const s = core.status();
  const needToken = !s.connected;
  show(`
    <h1>복구 코드로 열기</h1>
    <p class="muted">사이트 비밀번호를 모두 잊었을 때 써요. 복구 코드를 넣고 <b>새 사이트 비밀번호</b>를 정하세요.
      <b>데이터와 복구 코드는 그대로</b>예요. 다른 기기들은 다음에 열 때 새 비밀번호를 넣으면 돼요.</p>
    <form id="f-recover" class="stack" autocomplete="off">
      ${userField()}
      <input type="text" name="code" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" required autocapitalize="characters" spellcheck="false">
      ${needToken ? '<input type="password" name="token" placeholder="GitHub 토큰 (이 기기는 연결된 적이 없어서 필요해요)" required>' : ''}
      <input type="password" name="pw" placeholder="새 사이트 비밀번호 (${MIN_PW}자 이상)" autocomplete="new-password" required minlength="${MIN_PW}">
      <input type="password" name="pw2" placeholder="한 번 더" autocomplete="new-password" required>
      ${needToken ? '<input type="text" name="user" placeholder="내 이름" maxlength="40" required autocomplete="off">' : ''}
      <button class="btn primary wide" type="submit">새 비밀번호로 열기</button>
      <p class="err" role="alert"></p>
    </form>
    ${needToken ? TOKEN_HELP : ''}
    <div class="gate-links"><button class="btn ghost small" type="button" data-g="back">돌아가기</button></div>`);
  card().querySelector('[data-g=back]').onclick = () => (core.status().connected ? unlockScreen() : welcomeScreen());
  $('#f-recover').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f, '확인하는 중…', async () => {
      if (f.pw.value.length < MIN_PW) throw new Error(`새 비밀번호는 ${MIN_PW}자 이상으로 정해 주세요.`);
      if (f.pw.value !== f.pw2.value) throw new Error('새 비밀번호 두 칸이 서로 달라요.');
      await core.recover(f.code.value, f.pw.value, f.token?.value.trim() || undefined);
      if (f.user?.value.trim()) await core.setUser(f.user.value.trim());
      toast('새 비밀번호로 바꿨어요. 선생님들께 새 비밀번호를 알려 주세요.', 5000);
      opened();
    });
  };
}

function nameScreen() {
  show(`
    <h1>누가 쓰시나요?</h1>
    <p class="muted">이름을 넣어 주세요. 고친 내용·휴지통에 <b>누가 고쳤는지</b> 보여 줄 때 써요. 이 기기에만 저장돼요.</p>
    <form id="f-name" class="stack" autocomplete="off">
      <input type="text" name="user" placeholder="예: 김은혜" maxlength="40" required>
      <button class="btn primary wide" type="submit">확인</button>
      <p class="err" role="alert"></p>
    </form>`);
  $('#f-name').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f, '저장 중…', async () => {
      const n = f.user.value.trim();
      if (!n) throw new Error('이름을 넣어 주세요.');
      await core.setUser(n);
      opened();
    });
  };
}

// 데이터가 열리고 이름이 정해질 때까지 여는 화면을 보여 준다. msg = 잠금 화면에 보일 말 (예: 다른 기기에서 비밀번호가 바뀜)
export async function ensureOpen(msg = '') {
  await core.ready;
  let joinErr = '';
  let joined = false;
  if (core.hasJoinLink(location.hash)) {
    try {
      await core.joinFromQR(location.hash);
      joined = true;
    } catch (e) {
      joinErr = e.message;
    }
    history.replaceState(null, '', location.pathname); // 주소창에서 연결 링크 지우기
  }
  const done = new Promise((res) => { finish = res; });
  const s = core.status();
  if (s.open) opened();
  else if (!s.connected) welcomeScreen(joinErr);
  else if (joined) joinScreen();
  else if (await core.resume()) opened();
  else unlockScreen(msg || joinErr);
  return done;
}
