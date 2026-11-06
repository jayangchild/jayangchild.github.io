// 화면 모듈 공통: 입력 대화상자, 사진 넣기, 날짜, 휴지통 확인. (말투: 쉬운 한국어, 무엇이 그대로인지 밝힌다)
import { $, $$, toast, openModal, pickFile } from '../ui.js';
import { esc } from '../pilsa/sheet.js';
import { fileURL, upload } from './ctx.js';

export { $, $$, toast, esc, pickFile };

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function fmtDate(s, { year = false } = {}) {
  if (!s) return '';
  const [y, m, d] = String(s).split('-').map(Number);
  if (!m) return esc(s);
  const dt = new Date(y, m - 1, d || 1);
  return `${year ? `${y}. ` : ''}${m}월 ${d ? `${d}일 (${DOW[dt.getDay()]})` : ''}`.trim();
}
export const won = (n) => `${n > 0 ? '+' : ''}${n}`;
export const telHref = (p) => `tel:${String(p || '').replace(/[^0-9+]/g, '')}`;
export const ytId = (u) => String(u || '').match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([\w-]{11})/)?.[1] || '';

// 휴지통 확인 (진짜로 지우는 일은 없다)
export const askTrash = (what) => confirm(`${what}을(를) 휴지통으로 옮길까요?\n설정 → 휴지통에서 언제든 되살릴 수 있어요.`);

// ---------- 입력 대화상자 ----------
// fields: [{ name, label, type: text|textarea|date|number|tel|select|check|labels|file|files, options, hint, required, accept, placeholder }]
export function formModal(title, fields, values = {}, { submit = '저장', intro = '' } = {}) {
  const f = (x) => {
    const v = values[x.name] ?? x.value ?? '';
    const req = x.required ? 'required' : '';
    const ph = x.placeholder ? `placeholder="${esc(x.placeholder)}"` : '';
    const hint = x.hint ? `<small class="muted">${x.hint}</small>` : '';
    if (x.type === 'textarea') return `<label class="field">${esc(x.label)}${hint}<textarea name="${x.name}" rows="${x.rows || 5}" ${req} ${ph}>${esc(v)}</textarea></label>`;
    if (x.type === 'select') return `<label class="field">${esc(x.label)}${hint}<select name="${x.name}" ${req}>${x.options.map(([k, t]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    if (x.type === 'check') return `<label class="check"><input type="checkbox" name="${x.name}" ${v ? 'checked' : ''}> ${esc(x.label)}</label>${hint}`;
    if (x.type === 'labels') return `<fieldset class="field-set"><legend>${esc(x.label)}</legend><div class="row">${x.options.map((o) => `<label class="check inline"><input type="checkbox" name="${x.name}" value="${esc(o)}" ${(v || []).includes(o) ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div>${hint}</fieldset>`;
    if (x.type === 'file' || x.type === 'files') return `<label class="field">${esc(x.label)}${hint}<input type="file" name="${x.name}" ${x.accept ? `accept="${esc(x.accept)}"` : ''} ${x.type === 'files' ? 'multiple' : ''} ${req}></label>`;
    const type = { date: 'date', number: 'number', tel: 'tel' }[x.type] || 'text';
    return `<label class="field">${esc(x.label)}${hint}<input type="${type}" name="${x.name}" value="${esc(v)}" ${req} ${ph} ${type === 'number' ? 'step="1"' : ''} ${x.max ? `maxlength="${x.max}"` : ''}></label>`;
  };
  return openModal(`<form class="stack form-modal" novalidate>
      <h2>${esc(title)}</h2>${intro ? `<p class="small muted">${intro}</p>` : ''}
      ${fields.map(f).join('')}
      <p class="err" role="alert"></p>
      <div class="row end"><button class="btn" type="button" data-close>닫기</button><button class="btn primary" type="submit">${esc(submit)}</button></div>
    </form>`, (body, close) => {
    const form = $('form', body);
    form.querySelector('input:not([type=checkbox]):not([type=file]),textarea,select')?.focus();
    form.onsubmit = (e) => {
      e.preventDefault();
      const out = {};
      for (const x of fields) {
        const el = form.elements[x.name];
        if (x.type === 'check') out[x.name] = el.checked;
        else if (x.type === 'labels') out[x.name] = $$(`input[name="${x.name}"]:checked`, form).map((i) => i.value);
        else if (x.type === 'file') out[x.name] = el.files[0] || null;
        else if (x.type === 'files') out[x.name] = [...el.files];
        else if (x.type === 'number') out[x.name] = el.value === '' ? null : Number(el.value);
        else out[x.name] = el.value.trim();
        if (x.required && (out[x.name] === '' || out[x.name] == null)) {
          form.querySelector('.err').textContent = `${x.label}을(를) 넣어 주세요.`;
          el.focus?.();
          return;
        }
      }
      close(out);
    };
  });
}

// 파일 올리기: 사진은 이 기기에서 줄이고(긴 변 1600px) 위치 정보(EXIF)를 뺀 뒤, 기록과 같은 등급으로 암호화해 올린다
//   col·rec 로 등급을 정한다 (menus.js tierFor)
export const uploadFile = (file, { col, rec, image = true } = {}) => upload(file, { col, rec, image });

// [data-file] 그림에 주소 넣기 (암호문을 풀어서)
export async function hydrate(el) {
  await Promise.all($$('img[data-file]', el).map(async (img) => {
    const u = await fileURL(img.dataset.file);
    if (u) img.src = u; else img.classList.add('missing');
  }));
}
export const imgTag = (id, cls = '', alt = '') => (id ? `<img class="${cls}" data-file="${esc(id)}" alt="${esc(alt)}">` : '');

export function guard(btn, fn) {
  return async (...a) => {
    if (btn) btn.disabled = true;
    try { return await fn(...a); } catch (e) { console.warn(e); toast(e.message || String(e), 5000); } finally { if (btn && document.contains(btn)) btn.disabled = false; }
  };
}

export const head = (title, desc = '', actions = '') => `<div class="card mod-head"><div class="row"><div class="grow"><h2>${title}</h2>${desc ? `<p class="muted small">${desc}</p>` : ''}</div>${actions}</div></div>`;
export const readOnlyNote = () => '<p class="small muted">보기만 할 수 있어요. 고칠 것은 임원·관리자에게 말해 주세요.</p>';
export const empty = (msg) => `<p class="muted empty">${msg}</p>`;
