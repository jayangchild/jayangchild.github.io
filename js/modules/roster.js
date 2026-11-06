// 명단 (학생·선생님) · 생일
// members: { type: 'student'|'teacher', name, photo, gender, grade, cls, teacher(담임), parentName, parentPhone, phone, birthday, labels, note }
// 부모님 연락처는 선생님 이상만 (학부모 칸에는 명단 자체가 올라가지 않는다 — menus.js 의 floor)
import { col, has, isWriter } from './ctx.js';
import { $, esc, toast, formModal, uploadFile, hydrate, imgTag, guard, head, readOnlyNote, empty, telHref, askTrash, gone } from './kit.js';
import { LABELS } from './site-access.js';

const pref = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
export const classOf = (m) => [m.grade ? `${m.grade}학년` : '', m.cls ? `${m.cls}반` : ''].filter(Boolean).join(' ');
const sortKey = (m) => `${String(m.grade || '9').padStart(2, '0')}|${String(m.cls || '99').padStart(3, '0')}|${m.name}`;
export const students = () => col('members').list().filter((m) => m.type !== 'teacher').sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'ko'));
export const teachers = () => col('members').list().filter((m) => m.type === 'teacher').sort((a, b) => a.name.localeCompare(b.name, 'ko'));

// 'YYYY-MM-DD' 또는 'MM-DD' → { m, d }
export function bday(s) {
  const p = String(s || '').match(/(?:(\d{4})[-./])?(\d{1,2})[-./](\d{1,2})/);
  return p ? { y: p[1] ? +p[1] : null, m: +p[2], d: +p[3] } : null;
}

const memberFields = (type) => [
  { name: 'name', label: '이름', required: true, max: 40 },
  ...(type === 'student' ? [
    { name: 'grade', label: '학년', placeholder: '예: 1' },
    { name: 'cls', label: '반', placeholder: '예: 1' },
    { name: 'teacher', label: '담임', placeholder: '선생님 이름' },
    { name: 'gender', label: '성별', type: 'select', options: [['', '—'], ['여', '여'], ['남', '남']] },
    { name: 'parentName', label: '부모님 이름' },
    { name: 'parentPhone', label: '부모님 연락처', type: 'tel', placeholder: '010-0000-0000' },
  ] : [
    { name: 'phone', label: '연락처', type: 'tel', placeholder: '010-0000-0000' },
    { name: 'cls', label: '맡은 반', placeholder: '예: 1-1' },
    { name: 'labels', label: '임원 직분 (있으면)', type: 'labels', options: LABELS },
  ]),
  { name: 'birthday', label: '생일', type: 'date', hint: '연도를 모르면 아무 해나 넣어도 돼요 (달·날만 써요)' },
  { name: 'photo', label: '사진', type: 'file', accept: 'image/*', hint: '이 기기에서 줄이고 위치 정보(EXIF)를 뺀 뒤 올려요' },
  { name: 'note', label: '비고', type: 'textarea', rows: 3 },
];

async function editMember(m, type) {
  const v = await formModal(m ? `${m.name} 고치기` : (type === 'teacher' ? '선생님 추가' : '학생 추가'), memberFields(type), m || {});
  if (!v) return false;
  const { photo, ...rest } = v;
  const rec = { ...(m || {}), ...rest, type };
  if (photo) rec.photo = (await uploadFile(photo, { col: 'members', rec })).id;
  await col('members').put(rec);
  toast('저장했어요.');
  return true;
}

function card(m, contacts, writer) {
  const initial = esc((m.name || '?').slice(-2));
  const phone = m.type === 'teacher' ? m.phone : m.parentPhone;
  return `<article class="person-card" data-id="${esc(m.id)}">
    <div class="pc-photo">${m.photo ? imgTag(m.photo, 'avatar', m.name) : `<span class="avatar ph">${initial}</span>`}</div>
    <div class="pc-body">
      <div class="pc-name"><b>${esc(m.name)}</b> ${(m.labels || []).map((l) => `<span class="pill label">${esc(l)}</span>`).join(' ')}
        <span class="small muted">${esc(m.type === 'teacher' ? (m.cls ? `${m.cls}반 담당` : '선생님') : classOf(m))}</span></div>
      ${m.type !== 'teacher' && m.teacher ? `<div class="small">담임 ${esc(m.teacher)}</div>` : ''}
      ${m.birthday ? `<div class="small">🎂 ${esc(fmtB(m.birthday))}</div>` : ''}
      ${contacts && m.type !== 'teacher' && (m.parentName || m.parentPhone) ? `<div class="small contact">👪 ${esc(m.parentName || '부모님')} ${m.parentPhone ? `<span class="muted">${esc(m.parentPhone)}</span>` : ''}</div>` : ''}
      ${m.note ? `<div class="small muted note">${esc(m.note)}</div>` : ''}
    </div>
    <div class="pc-act">
      ${contacts && phone ? `<a class="btn call" href="${esc(telHref(phone))}" aria-label="${esc(m.name)} ${m.type === 'teacher' ? '' : '부모님께 '}전화">📞<span class="ph-hide"> 전화</span></a>` : ''}
      ${writer ? `<button class="btn small" type="button" data-act="edit">고치기</button><button class="btn small ghost" type="button" data-act="del" aria-label="휴지통">🗑</button>` : ''}
    </div>
  </article>`;
}
const fmtB = (s) => { const b = bday(s); return b ? `${b.m}월 ${b.d}일` : s; };

export async function renderRoster(el, q) {
  if (gone(el, 'roster')) return; // 그사이 다른 화면으로 갔으면 그리지 않는다
  const writer = isWriter();
  const contacts = has('teacher');
  const tab = q.get('t') === 'teacher' ? 'teacher' : 'student';
  const view = pref.get('rosterView', 'card');
  const list = tab === 'teacher' ? teachers() : students();
  const classes = [...new Set(students().map(classOf).filter(Boolean))];
  const fcls = q.get('c') || '';
  const shown = list.filter((m) => !fcls || classOf(m) === fcls);
  el.innerHTML = head('명단', `학생 ${students().length}명 · 선생님 ${teachers().length}명. ${contacts ? '전화 버튼을 누르면 바로 전화가 걸려요.' : ''}`,
    writer ? `<button class="btn primary" type="button" data-act="add">+ ${tab === 'teacher' ? '선생님' : '학생'} 추가</button>` : '') + `
    <nav class="subnav"><a href="#/roster" class="${tab === 'student' ? 'on' : ''}">학생</a><a href="#/roster?t=teacher" class="${tab === 'teacher' ? 'on' : ''}">선생님</a></nav>
    <div class="row filters">
      ${tab === 'student' ? `<select id="r-cls" aria-label="반 고르기"><option value="">모든 반</option>${classes.map((c) => `<option ${c === fcls ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : ''}
      <input type="search" id="r-q" placeholder="이름 찾기" aria-label="이름 찾기">
      <span class="grow"></span>
      <span class="ph-hide"><button class="btn small ${view === 'card' ? 'on' : ''}" data-view="card" type="button">카드</button><button class="btn small ${view === 'table' ? 'on' : ''}" data-view="table" type="button">표</button></span>
    </div>
    ${writer ? '' : readOnlyNote()}
    <div id="r-list" class="${view === 'table' ? 'table-view' : 'card-grid'}">${shown.length ? (view === 'table' ? table(shown, contacts, writer, tab) : shown.map((m) => card(m, contacts, writer)).join('')) : empty(tab === 'teacher' ? '아직 선생님이 없어요.' : '아직 학생이 없어요. 관리 → 데이터 → 가져오기로 명단을 넣을 수 있어요.')}</div>`;
  hydrate(el);
  $('#r-cls', el)?.addEventListener('change', (e) => { location.hash = `#/roster${e.target.value ? `?c=${encodeURIComponent(e.target.value)}` : ''}`; });
  $('#r-q', el).oninput = (e) => {
    const s = e.target.value.trim();
    for (const c of el.querySelectorAll('[data-id]')) c.hidden = !!s && !(col('members').get(c.dataset.id)?.name || '').includes(s);
  };
  el.onclick = async (e) => {
    const v = e.target.closest('[data-view]');
    if (v) { pref.set('rosterView', v.dataset.view); return renderRoster(el, q); }
    const b = e.target.closest('[data-act]');
    if (!b || !writer) return;
    const id = b.closest('[data-id]')?.dataset.id;
    const m = id ? col('members').get(id) : null;
    await guard(b, async () => {
      if (b.dataset.act === 'add' && (await editMember(null, tab))) renderRoster(el, q);
      if (b.dataset.act === 'edit' && (await editMember(m, m.type === 'teacher' ? 'teacher' : 'student'))) renderRoster(el, q);
      if (b.dataset.act === 'del' && askTrash(m.name)) { await col('members').softDelete(id); toast('휴지통으로 옮겼어요.'); renderRoster(el, q); }
    })();
  };
}

function table(list, contacts, writer, tab) {
  const rows = list.map((m) => `<tr data-id="${esc(m.id)}"><td>${m.photo ? imgTag(m.photo, 'avatar sm', m.name) : ''}</td><td><b>${esc(m.name)}</b> ${(m.labels || []).map((l) => `<span class="pill label">${esc(l)}</span>`).join(' ')}</td>
    ${tab === 'student' ? `<td>${esc(m.grade || '')}</td><td>${esc(m.cls || '')}</td><td>${esc(m.teacher || '')}</td>${contacts ? `<td>${esc(m.parentName || '')}</td><td>${m.parentPhone ? `<a href="${esc(telHref(m.parentPhone))}">${esc(m.parentPhone)}</a>` : ''}</td>` : ''}`
      : `<td>${esc(m.cls || '')}</td>${contacts ? `<td>${m.phone ? `<a href="${esc(telHref(m.phone))}">${esc(m.phone)}</a>` : ''}</td>` : ''}`}
    <td>${esc(fmtB(m.birthday))}</td><td class="small">${esc(m.note || '')}</td>${writer ? '<td class="act"><button class="btn small" data-act="edit" type="button">고치기</button> <button class="btn small ghost" data-act="del" type="button">🗑</button></td>' : ''}</tr>`).join('');
  const th = tab === 'student' ? `<th>학년</th><th>반</th><th>담임</th>${contacts ? '<th>부모님</th><th>연락처</th>' : ''}` : `<th>맡은 반</th>${contacts ? '<th>연락처</th>' : ''}`;
  return `<div class="table-wrap"><table class="grid roster"><thead><tr><th>사진</th><th>이름</th>${th}<th>생일</th><th>비고</th>${writer ? '<th></th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ---------- 생일 ----------
export function birthdaysIn(month) {
  return col('members').list().map((m) => ({ m, b: bday(m.birthday) })).filter((x) => x.b && x.b.m === month).sort((a, b) => a.b.d - b.b.d);
}
export async function renderBirthdays(el) {
  const now = new Date();
  const months = [now.getMonth() + 1, ((now.getMonth() + 1) % 12) + 1];
  const block = (mo, i) => {
    const list = birthdaysIn(mo);
    return `<section class="card"><h3>${i ? '다음 달' : '이번 달'} · ${mo}월 <span class="muted small">${list.length}명</span></h3>
      ${list.length ? `<ul class="bday-list">${list.map(({ m, b }) => `<li class="${i === 0 && b.d === now.getDate() ? 'today' : ''}">
        ${m.photo ? imgTag(m.photo, 'avatar sm', m.name) : '<span class="avatar sm ph">🎂</span>'}
        <span class="d">${b.m}/${b.d}</span><b>${esc(m.name)}</b>
        <span class="small muted">${m.type === 'teacher' ? '선생님' : esc(classOf(m))}</span>${i === 0 && b.d === now.getDate() ? ' <span class="pill special">오늘!</span>' : ''}</li>`).join('')}</ul>` : empty('생일인 사람이 없어요.')}
    </section>`;
  };
  el.innerHTML = head('생일', '이번 달과 다음 달 생일 (학생·선생님). 생일은 명단에서 넣어요. 생일 선물은 선물 메뉴에서 지급 기록을 남겨요.') + months.map(block).join('');
  hydrate(el);
}
