// 위 막대의 저장 상태·충돌 표시, 알림 띠(토큰 만료 등), 설정 · 휴지통 · 같은 때 고친 내용 화면.
// 바꾸는 일은 모두 core(js/core) 를 거친다. 지우는 일은 없다(휴지통만).

import { S, core, restore, trash, conflicts, resolveConflict, backupJSON, restoreJSON, COLS } from './store.js';
import { COLLECTIONS } from './core/core.js';
import { $, toast, openModal, download, pickFile } from './ui.js';
import { esc } from './pilsa/sheet.js';
import { THEMES } from './pilsa/themes.js';
import { recoveryCodeBox, expField, expValue, saveTokenExp, TOKEN_HELP } from './gate.js';

const ALL_COLS = [...new Set([...COLS, ...COLLECTIONS])];
const COL_NAME = {
  members: '명단', talentLog: '달란트 기록', plan: '연간계획', bulletins: '주보', albums: '앨범', videos: '영상', pages: '공개 페이지',
  gifts: '선물 물품', giftTypes: '선물 종류', giftStock: '선물 기준 수량', giftLog: '선물 기록', policies: '정책', meetings: '임원회의 자료', accounting: '회계', people: '사람',
};
const ymd = (d = new Date()) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const when = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const daysUntil = (day) => Math.round((new Date(`${day}T00:00:00`) - new Date(new Date().toDateString())) / 864e5);

// ---------- 저장 상태 표시 ----------

const CHIP = {
  saved: ['✓ 저장됨', 'ok', '다 올렸어요. 다른 선생님 기기에도 보여요.'],
  pending: ['올리는 중…', 'busy', '이 기기에 저장했고, 곧 올려요.'],
  syncing: ['올리는 중…', 'busy', '올리고 받는 중이에요.'],
  offline: ['오프라인', 'off', '인터넷이 없어요. 고친 것은 이 기기에 저장했고, 인터넷이 연결되면 저절로 올려요.'],
  error: ['오류', 'bad', '올리지 못했어요. 이 기기에 저장한 것은 그대로예요.'],
  locked: ['잠김', 'off', ''],
};

export function updateChrome() {
  const s = core.status();
  const [text, cls, tip] = CHIP[s.state] || CHIP.saved;
  const chip = $('#sync-chip');
  if (chip) {
    chip.textContent = text;
    chip.className = `chip ${cls}`;
    chip.title = s.error && s.state === 'error' ? `${tip}\n${s.error}` : tip;
  }
  if (!S.data || !s.open) return;
  const n = conflictList().length;
  const badge = $('#conflict-badge');
  if (badge) {
    badge.hidden = !n;
    badge.querySelector('span').textContent = n;
    badge.title = `같은 때 고친 내용 ${n}개 — 눌러서 확인하세요`;
  }
  drawBanner();
}

function drawBanner() {
  const el = $('#banner');
  if (!el) return;
  const s = core.status();
  const out = [];
  if (s.state === 'error' && s.errorCode === 'token') {
    out.push(`<div class="banner bad"><b>이 기기의 연결 열쇠(GitHub 토큰)가 만료되었거나 바뀌었어요.</b>
      이 기기에 저장한 것은 그대로이고, 다시 연결하면 올라가요. 연결된 다른 기기에서 <b>설정 → 새 기기 연결(QR)</b>을 열어 이 기기로 찍으세요.
      모든 기기가 이렇다면 관리자가 새 토큰을 만들어 <b>설정 → 관리자용 → 토큰 바꾸기</b>를 해 주세요 (데이터·비밀번호·복구 코드는 그대로예요).</div>`);
  } else if (s.state === 'error' && s.error) {
    out.push(`<div class="banner bad">올리지 못했어요: ${esc(s.error)} <span class="muted">(이 기기에 저장한 것은 그대로예요. 잠시 뒤 다시 올려요)</span></div>`);
  }
  if (s.memoryOnly) out.push('<div class="banner bad">이 브라우저(사생활 보호 모드 등)는 이 기기에 저장할 수 없어요. 고친 것은 올라가기 전에 창을 닫으면 사라져요. 보통 창으로 열어 주세요.</div>');
  const exp = core.collection('sys').get('token')?.exp;
  if (exp && exp !== 'none') {
    const d = daysUntil(exp);
    if (d <= 14) {
      out.push(`<div class="banner ${d <= 3 ? 'bad' : ''}">GitHub 토큰이 ${d < 0 ? '만료됐어요' : d === 0 ? '오늘 만료돼요' : `${d}일 뒤 만료돼요`} (${esc(exp)}).
        관리자는 새 토큰을 만들어 <a href="#/settings">설정 → 관리자용 → 토큰 바꾸기</a>를 해 주세요. 데이터·비밀번호·복구 코드는 그대로예요.</div>`);
    }
  }
  el.innerHTML = out.join('');
}

function conflictList() {
  const out = [];
  for (const c of ALL_COLS) {
    try { for (const r of conflicts(c)) out.push({ col: c, rec: r }); } catch {}
  }
  return out;
}

function trashList() {
  const out = [];
  for (const c of ALL_COLS) {
    try { for (const r of trash(c)) out.push({ col: c, rec: r }); } catch {}
  }
  return out.sort((a, b) => (b.rec.deletedAt || '').localeCompare(a.rec.deletedAt || ''));
}

export function initChrome() {
  $('#sync-chip').onclick = () => {
    const s = core.status();
    const [text, , tip] = CHIP[s.state] || CHIP.saved;
    openModal(`<h2>저장 상태: ${esc(text)}</h2>
      <p>${esc(tip)}</p>
      ${s.error ? `<p class="warn">${esc(s.error)}</p>` : ''}
      <p class="small muted">마지막으로 맞춘 때: ${esc(when(s.lastSync) || '아직 없음')} · 아직 못 올린 것: ${s.pending ?? 0}개<br>
        고친 것은 먼저 이 기기에 암호화해 저장하고, 몇 초 뒤 비공개 GitHub 저장소에 올려요. 2분마다, 그리고 화면을 다시 볼 때 다른 선생님이 고친 것을 받아요.</p>
      <div class="row end"><button class="btn" type="button" id="sync-now">지금 올리고 받기</button><button class="btn primary" data-close type="button">닫기</button></div>`, (body) => {
      body.querySelector('#sync-now').onclick = async (e) => {
        e.target.disabled = true;
        const r = await core.sync();
        toast(r.state === 'saved' ? '다 올렸어요.' : r.state === 'offline' ? '인터넷이 없어요. 이 기기에 저장해 두었어요.' : r.error || '다시 해 볼게요.');
        e.target.disabled = false;
      };
    });
  };
  $('#lock-btn').onclick = lockNow;
}

async function lockNow() {
  await core.forgetSession();
  await core.lock(); // app.js 가 잠금 화면을 연다
  toast('잠갔어요. 데이터·비밀번호·복구 코드는 그대로예요.');
}

// ---------- 이름 붙이기 (휴지통·충돌 화면용) ----------

const FIELD = { lines: '말씀', date: '날짜', ref: '성경', no: '과', title: '제목', month: '디자인 달', term: '학기', kind: '종류', images: '올린 그림', hideBuiltin: '기본 그림 숨기기', name: '이름', deletedAt: '휴지통' };

function label(col, r) {
  if (col === 'lessons') return r.kind === 'special' ? `특별한 장 '${r.title || '말씀 필사'}' · ${r.date || ''}` : `${r.no ?? '?'}과 · ${r.date || ''} · ${r.ref || ''}`;
  if (col === 'themes') { const m = +String(r.id).slice(1); return `${THEMES[m]?.name || r.id} 디자인`; }
  if (col === 'files') return `그림 '${r.name || '이름 없음'}'${r.lastUse?.month ? ` (${r.lastUse.month}월 디자인에 있던 것)` : ''}`;
  if (col === 'sys') return r.id === 'firstSunday' ? '학기 첫 주일 설정' : `설정 (${r.id})`;
  const name = r.name || r.title || (col === 'talentLog' ? `${r.date || ''} ${r.qty > 0 ? '+' : ''}${r.qty ?? ''} ${r.why || ''}` : '') || (col === 'giftLog' ? `${r.date || ''} ${r.qty ?? ''}` : '') || '';
  return `${COL_NAME[col] || col} · ${name || r.id}`;
}

function showValue(v) {
  if (v == null || v === '') return '<span class="muted">(비어 있음)</span>';
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return esc(v.join('\n'));
  if (Array.isArray(v)) return `${v.length}개`;
  if (typeof v === 'boolean') return v ? '예' : '아니요';
  if (typeof v === 'object') return esc(JSON.stringify(v));
  return esc(v);
}

// ---------- 휴지통 ----------

export async function renderTrash(el) {
  const list = trashList();
  const rows = [];
  for (const { col, rec } of list) {
    let thumb = '';
    if (col === 'files') {
      const u = await core.files.url(rec.id).catch(() => '');
      thumb = u ? `<img class="thumb" src="${esc(u)}" alt="">` : '';
    }
    rows.push(`<div class="trash-item" data-col="${esc(col)}" data-id="${esc(rec.id)}">${thumb}
      <div class="grow"><b>${esc(label(col, rec))}</b><br><span class="small muted">${esc(rec.deletedBy || '누군가')} 님이 ${esc(when(rec.deletedAt))}에 휴지통으로 옮김</span></div>
      <button class="btn small" type="button" data-act="restore">되살리기</button></div>`);
  }
  el.innerHTML = `<div class="card">
      <h2>휴지통</h2>
      <p class="muted">사이트에서 지운 것은 모두 여기로 와요. <b>저절로 없어지지 않고</b>, 되살리기를 누르면 원래 자리로 돌아가요.</p>
    </div>
    <div class="card">${rows.join('') || '<p class="muted">휴지통이 비어 있어요.</p>'}</div>`;
  el.onclick = async (e) => {
    const b = e.target.closest('[data-act=restore]');
    if (!b) return;
    const it = b.closest('.trash-item');
    b.disabled = true;
    try {
      await restore(it.dataset.col, it.dataset.id);
      toast('되살렸어요.');
      renderTrash(el);
      updateChrome();
    } catch (ex) {
      toast(ex.message || '되살리지 못했어요.');
      b.disabled = false;
    }
  };
}

// ---------- 같은 때 고친 내용 ----------

export function renderConflicts(el) {
  const list = conflictList();
  const cards = list.map(({ col, rec }, i) => {
    // 칸마다 가장 최근 것 하나 (같은 칸에 여러 번이면 다 보여 줄 필요 없음)
    const byField = new Map();
    for (const c of rec._conflicts || []) byField.set(c.field, c);
    const parts = [...byField.values()].map((c) => {
      if (c.field === 'deletedAt' && c.note === 'kept') {
        return `<fieldset class="cf"><legend>휴지통</legend>
          <p class="small">${esc(c.by || '다른 선생님')} 님이 ${esc(when(c.at))}에 휴지통으로 옮겼지만, 같은 때 다른 분이 고쳐서 <b>남겨 두었어요</b>.</p>
          <label class="check"><input type="radio" name="f${i}-deletedAt" value="keep" checked> 남겨 두기</label>
          <label class="check"><input type="radio" name="f${i}-deletedAt" value="trash"> 휴지통으로 옮기기</label></fieldset>`;
      }
      const cur = rec[c.field];
      return `<fieldset class="cf"><legend>${esc(FIELD[c.field] || c.field)}</legend>
        <label class="check pick"><input type="radio" name="f${i}-${esc(c.field)}" value="cur" checked>
          <span><b>지금 값</b> <span class="small muted">(${esc(rec.updatedBy || '')} · ${esc(when(rec.updatedAt))})</span><span class="val">${showValue(cur)}</span></span></label>
        <label class="check pick"><input type="radio" name="f${i}-${esc(c.field)}" value="other">
          <span><b>다른 값</b> <span class="small muted">(${esc(c.by || '')} · ${esc(when(c.at))})</span><span class="val">${showValue(c.value)}</span></span></label></fieldset>`;
    });
    return `<form class="card cf-card" data-i="${i}">
      <h3>${esc(label(col, rec))}</h3>
      <p class="small muted">두 분이 같은 때 고쳤어요. 남길 값을 고르고 <b>이대로 정하기</b>를 누르세요. 고르지 않은 값도 GitHub 이력에는 남아 있어요.</p>
      ${parts.join('')}
      <div class="row end"><button class="btn primary" type="submit">이대로 정하기</button></div></form>`;
  });
  el.innerHTML = `<div class="card"><h2>같은 때 고친 내용</h2>
      <p class="muted">두 선생님이 같은 것을 거의 같은 때 다르게 고치면, 나중에 고친 값이 보이고 다른 값은 여기에 남아요. 아무것도 사라지지 않아요.</p></div>
    ${cards.join('') || '<div class="card"><p class="muted">확인할 것이 없어요.</p></div>'}`;
  el.onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const { col, rec } = list[+form.dataset.i];
    const fields = {};
    let trashIt = false;
    for (const c of rec._conflicts || []) {
      const pick = form.querySelector(`input[name="f${form.dataset.i}-${CSS.escape(c.field)}"]:checked`)?.value;
      if (c.field === 'deletedAt') { if (pick === 'trash') trashIt = true; continue; }
      if (pick === 'other') fields[c.field] = c.value;
    }
    form.querySelector('button[type=submit]').disabled = true;
    try {
      await resolveConflict(col, rec.id, fields, { trashIt });
      toast('정했어요.');
      updateChrome();
      renderConflicts(el);
    } catch (ex) {
      toast(ex.message || '저장하지 못했어요.');
      form.querySelector('button[type=submit]').disabled = false;
    }
  };
}

// ---------- 설정 ----------

export async function renderSettings(el) {
  const s = core.status();
  const sess = await core.sessionInfo();
  const tok = core.collection('sys').get('token');
  const exp = tok?.exp || '';
  const expText = !exp ? '모름 (토큰 바꾸기에서 적어 둘 수 있어요)' : exp === 'none' ? '없음' : `${exp} (${daysUntil(exp) >= 0 ? `${daysUntil(exp)}일 남음` : '만료됨'})`;
  const nTrash = trashList().length;
  const nConf = conflictList().length;
  el.innerHTML = `
    <div class="card"><h2>설정</h2>
      <p class="muted">데이터는 비공개 GitHub 저장소(${esc(s.repo)})에 <b>암호화되어</b> 안전하게 있어요. 이 기기에도 암호화된 사본이 있어서 인터넷이 없어도 열려요.</p></div>

    <section class="card set">
      <h3>이 기기</h3>
      <form id="s-name" class="row">
        <label class="field grow">내 이름 <small class="muted">(누가 고쳤는지 보여 줄 때 써요)</small>
          <input type="text" name="user" value="${esc(s.user)}" maxlength="40" required></label>
        <button class="btn" type="submit" style="align-self:flex-end">이름 바꾸기</button>
      </form>
      <label class="check" style="margin-top:12px"><input type="checkbox" id="s-remember" ${sess ? 'checked' : ''}> 이 기기 기억하기(30일)</label>
      <p class="hint">${sess ? `켜져 있어요: ${esc(new Date(sess.until).toLocaleDateString('ko-KR'))}까지 이 기기에서는 비밀번호 없이 열려요 (쓸 때마다 늘어나요).` : '꺼져 있어요: 열 때마다 사이트 비밀번호를 물어요.'}
        나만 쓰는 휴대폰·PC에서만 켜세요.</p>
    </section>

    <section class="card set">
      <h3>새 기기 연결 (QR)</h3>
      <p class="small muted">새 선생님 휴대폰이나 다른 PC를 연결할 때 써요.</p>
      <ol class="small steps-list">
        <li>아래 <b>QR 보여 주기</b>를 누르세요.</li>
        <li>새 휴대폰의 <b>카메라</b>로 QR을 찍고 뜨는 링크를 누르세요.</li>
        <li>새 휴대폰에서 <b>사이트 비밀번호</b>와 이름을 넣으면 끝이에요.</li>
      </ol>
      <div class="row"><button class="btn" type="button" data-s="qr">QR 보여 주기</button></div>
      <div id="qr-box" class="qr-box" hidden></div>
    </section>

    <section class="card set">
      <h3>휴지통 · 같은 때 고친 내용</h3>
      <div class="row">
        <a class="btn" href="#/trash">휴지통 (${nTrash})</a>
        <a class="btn" href="#/conflicts">같은 때 고친 내용 (${nConf})</a>
      </div>
    </section>

    <section class="card set">
      <h3>백업</h3>
      <p class="small muted">GitHub에 이미 저장되고 이력도 남지만, 만약을 위해 가끔(한 학기에 한 번쯤) 관리자 PC에도 받아 두세요.</p>
      <div class="row"><button class="btn" type="button" data-s="bk-enc">백업 받기 (암호화)</button></div>
      <p class="hint">말씀·디자인·설정이 <b>암호화된 그대로</b> 들어가요. 받을 때의 사이트 비밀번호나 복구 코드로만 열려요. (그림은 빠져요 — 그림은 GitHub에 따로 있어요)</p>
      <div class="row" style="margin-top:10px"><button class="btn" type="button" data-s="bk-plain">필사노트 백업 받기 (그림 포함, 암호화 안 됨)</button>
        <button class="btn" type="button" data-s="bk-load">필사노트 백업 불러오기</button></div>
      <p class="hint">다른 곳으로 옮기거나 예전 내용을 다시 넣을 때 써요. 불러와도 지금 있는 것은 지우지 않아요 (같은 항목은 백업 쪽 내용으로 바뀌고, 없는 것은 더해져요).</p>
    </section>

    <section class="card set">
      <h3>잠그기</h3>
      <p class="small muted">자리를 비우거나 다른 사람이 이 기기를 쓸 때 누르세요. 다시 열 때 사이트 비밀번호가 필요해요 ('이 기기 기억하기'도 꺼져요).
        <b>데이터·사이트 비밀번호·복구 코드는 그대로</b>이고, 이 기기에 저장한 것(아직 못 올린 것도)은 남아 있다가 다시 열면 올라가요.</p>
      <div class="row"><button class="btn" type="button" data-s="lock">🔒 지금 잠그기</button></div>
    </section>

    <details class="card set admin">
      <summary><b>관리자용</b> <span class="small muted">비밀번호 · 복구 코드 · 토큰 · 연결 끊기</span></summary>
      <p class="small warn">관리자(임원)만 쓰세요. 누를 때마다 한 번 더 물어요.</p>

      <h4>사이트 비밀번호 바꾸기</h4>
      <p class="small muted"><b>데이터와 복구 코드는 그대로</b>예요 (다시 암호화할 필요 없음). 다른 선생님들 기기는 다음에 열 때 "비밀번호가 바뀌었어요"가 뜨고 새 비밀번호를 넣으면 돼요.
        그 기기에서 아직 못 올린 것도 지워지지 않고, 새 비밀번호로 열면 올라가요. 새 비밀번호를 선생님들께 직접 알려 주세요.</p>
      <form id="s-pw" class="stack narrow" autocomplete="off">
        <input class="sr-only" type="text" name="username" autocomplete="username" value="자양교회 유년부" tabindex="-1" aria-hidden="true">
        <input type="password" name="cur" placeholder="지금 비밀번호" autocomplete="current-password" required>
        <input type="password" name="pw" placeholder="새 비밀번호 (8자 이상)" autocomplete="new-password" required minlength="8">
        <input type="password" name="pw2" placeholder="새 비밀번호 한 번 더" autocomplete="new-password" required>
        <button class="btn" type="submit">비밀번호 바꾸기</button>
      </form>

      <h4>새 복구 코드 받기</h4>
      <p class="small muted">복구 코드를 잃어버렸거나 남에게 보였을 때. <b>예전 복구 코드는 바로 못 쓰게</b> 되고, <b>데이터와 사이트 비밀번호는 그대로</b>예요. 새 코드는 꼭 종이에 적어 보관하세요.</p>
      <div class="row"><button class="btn" type="button" data-s="rc">새 복구 코드 받기</button></div>
      <div id="rc-box"></div>

      <h4>GitHub 토큰 바꾸기</h4>
      <p class="small muted">토큰(연결 열쇠)이 곧 만료되거나 새로 만들었을 때. <b>데이터·사이트 비밀번호·복구 코드는 그대로</b>예요.
        다른 기기들은 다음에 열 때 <b>저절로</b> 새 토큰으로 바뀌어요. 그래서 예전 토큰은 1~2주 뒤에 GitHub 토큰 목록에서 지우세요.
        그사이 한 번도 열지 않은 기기는 "연결 열쇠가 만료되었어요"가 뜨는데, QR로 다시 연결하면 되고 그 기기에 남은 것도 올라가요.</p>
      <p class="small">지금 토큰 만료일: <b>${esc(expText)}</b></p>
      <form id="s-token" class="stack narrow" autocomplete="off">
        <input type="password" name="token" placeholder="새 토큰 (github_pat_…)" required>
        ${expField('exp', exp)}
        <button class="btn" type="submit">토큰 바꾸기</button>
      </form>
      ${TOKEN_HELP}

      <h4>이 기기 연결 끊기</h4>
      <p class="small muted">이 기기를 더 안 쓸 때. 이 기기에서만 연결과 사본을 지워요. <b>GitHub의 데이터는 지워지지 않고, 사이트 비밀번호·복구 코드도 그대로</b>예요.
        QR로 다시 연결하면 모두 돌아와요. 아직 못 올린 변경이 있으면 끊지 않아요.</p>
      <div class="row"><button class="btn danger" type="button" data-s="forget">이 기기 연결 끊기</button></div>

      <h4>연결 정보</h4>
      <dl class="kv small">
        <dt>데이터 저장소</dt><dd>${esc(s.repo)} (비공개)</dd>
        <dt>토큰 만료일</dt><dd>${esc(expText)}</dd>
        <dt>마지막으로 맞춘 때</dt><dd>${esc(when(s.lastSync) || '아직 없음')}</dd>
        <dt>못 올린 것</dt><dd>${s.pending ?? 0}개</dd>
      </dl>
    </details>`;

  $('#s-name', el).onsubmit = async (e) => {
    e.preventDefault();
    await core.setUser(e.target.user.value.trim());
    toast('이름을 바꿨어요.');
  };
  $('#s-remember', el).onchange = async (e) => {
    if (e.target.checked) {
      if (!confirm('이 기기에서는 30일 동안 비밀번호 없이 열리게 할까요?\n나만 쓰는 기기에서만 켜세요. 잠그기를 누르면 다시 꺼져요.')) { e.target.checked = false; return; }
      await core.rememberDevice(30);
      toast('이 기기를 30일 동안 기억해요.');
    } else {
      await core.forgetSession();
      toast('이제 열 때마다 비밀번호를 물어요.');
    }
    renderSettings(el);
  };
  $('#s-pw', el).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector('button');
    btn.disabled = true;
    try {
      if (f.pw.value.length < 8) throw new Error('새 비밀번호는 8자 이상으로 정해 주세요.');
      if (f.pw.value !== f.pw2.value) throw new Error('새 비밀번호 두 칸이 서로 달라요.');
      if (!(await core.checkPassword(f.cur.value))) throw new Error('지금 비밀번호가 맞지 않아요.');
      if (!confirm('사이트 비밀번호를 바꿀까요?\n데이터와 복구 코드는 그대로예요. 다른 선생님들은 다음에 열 때 새 비밀번호를 넣어야 해요.')) return;
      await core.changePassword(f.pw.value);
      f.reset();
      toast('비밀번호를 바꿨어요. 선생님들께 새 비밀번호를 알려 주세요.', 5000);
    } catch (ex) {
      toast(ex.message);
    } finally {
      btn.disabled = false;
    }
  };
  $('#s-token', el).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const t = f.token.value.trim();
      if (!confirm('GitHub 토큰을 바꿀까요?\n데이터·사이트 비밀번호·복구 코드는 그대로예요. 다른 기기들은 다음에 열 때 저절로 새 토큰으로 바뀌어요.')) return;
      await core.rotateToken(t);
      await saveTokenExp(expValue(f.exp));
      toast('토큰을 바꿨어요. 예전 토큰은 1~2주 뒤 GitHub에서 지우세요.', 5000);
      renderSettings(el);
      updateChrome();
    } catch (ex) {
      toast(ex.message);
    } finally {
      btn.disabled = false;
    }
  };
  el.onclick = async (e) => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    const act = b.dataset.s;
    b.disabled = true;
    try {
      if (act === 'qr') {
        if (!confirm('새 기기 연결 QR을 보여 줄까요?\n이 QR과 사이트 비밀번호가 있으면 데이터를 열 수 있어요. 연결할 기기에만 직접 보여 주세요 (사진을 찍어 단체방에 올리지 마세요).')) return;
        const { link, svg } = await core.connectDeviceQR();
        const box = $('#qr-box', el);
        box.innerHTML = `<div class="qr">${svg}</div>
          <p class="small muted">이 화면을 다른 사람에게 보여 주지 마세요. 다 찍었으면 닫으세요.</p>
          <div class="row center"><button class="btn small" type="button" data-s="copy-link">연결 링크 복사 (QR을 못 찍을 때)</button><button class="btn small" type="button" data-s="qr-close">닫기</button></div>`;
        box.dataset.link = link;
        box.hidden = false;
      } else if (act === 'copy-link') {
        if (!confirm('연결 링크를 복사할까요?\n링크가 남에게 가면 위험해요. 연결할 본인에게만 보내고, 연결한 뒤 메시지를 지우세요.')) return;
        await navigator.clipboard.writeText($('#qr-box', el).dataset.link);
        toast('연결 링크를 복사했어요.');
      } else if (act === 'qr-close') {
        const box = $('#qr-box', el);
        box.hidden = true;
        box.innerHTML = '';
        delete box.dataset.link;
      } else if (act === 'bk-enc') {
        download(`유년부_암호화백업_${ymd()}.json`, await core.exportBackup());
        toast('암호화된 백업 파일을 받았어요.');
      } else if (act === 'bk-plain') {
        if (!confirm('이 파일은 암호화되지 않아요. 관리자 PC 같은 안전한 곳에만 보관하세요. 받을까요?')) return;
        download(`유년부_필사노트백업_${ymd()}.json`, await backupJSON());
        toast('백업 파일을 받았어요.');
      } else if (act === 'bk-load') {
        const f = await pickFile('.json,application/json');
        if (!f) return;
        const c = await restoreJSON(JSON.parse(await f.text()));
        toast(`불러왔어요: 말씀 ${c.lessons}장, 디자인 ${c.themes}개, 그림 ${c.files}개`);
      } else if (act === 'lock') {
        await lockNow();
      } else if (act === 'rc') {
        if (!confirm('새 복구 코드를 만들까요?\n예전 복구 코드는 바로 못 쓰게 돼요. 데이터와 사이트 비밀번호는 그대로예요. 다음 화면의 새 코드를 꼭 보관하세요.')) return;
        const code = await core.newRecoveryCode();
        const box = $('#rc-box', el);
        recoveryCodeBox(box, code, () => { box.innerHTML = '<p class="small ok">새 복구 코드를 보관했어요.</p>'; });
        box.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } else if (act === 'forget') {
        if (!confirm('이 기기의 연결을 끊을까요?\nGitHub의 데이터는 지워지지 않고, 사이트 비밀번호·복구 코드도 그대로예요. QR로 다시 연결하면 모두 돌아와요.\n(아직 못 올린 변경이 있으면 끊지 않아요)')) return;
        await core.forgetDevice(); // app.js 가 연결 화면을 연다
      }
    } catch (ex) {
      toast(ex.message || String(ex), 5000);
    } finally {
      if (document.contains(b)) b.disabled = false;
    }
  };
}
