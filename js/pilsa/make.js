// 필사노트 제작: ① 말씀 가져오기(PPTX·CSV) ② 말씀 표(날짜·구절 고치기, 특별한 장) ③ 월별 디자인
import { S, changed, changedSys } from '../store.js';
import { uid } from '../schemas.js';
import { $, $$, toast, openModal, pickFile, addDays, firstSundayOf, nextSunday } from '../ui.js';
import { extractPptx, reflow, squash } from './extract.js';
import { THEMES } from './themes.js';
import { esc, monthOf } from './sheet.js';
import { renderPreviews } from './preview.js';
import { renderDesign } from './design.js';

const LONG = 36; // 이보다 긴 줄이 있으면 따라 쓰기 글자가 작아진다

export const termOf = (v) => v.term || (v.date ? `${v.date.slice(0, 4)}-${+v.date.slice(5, 7) <= 6 ? 1 : 2}` : '');
export const termName = (t) => { const [y, s] = t.split('-'); return `${y}년 ${s}학기`; };
export function terms() {
  const set = new Set(S.data.items.lessons.map(termOf).filter(Boolean));
  return [...set].sort().reverse();
}
export const sortLessons = (list) => [...list].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.no || 0) - (b.no || 0));

export async function renderMake(el, step, q) {
  const has = S.data.items.lessons.length > 0;
  step = step || (has ? 'table' : 'import');
  el.innerHTML = `<nav class="steps">
      <a href="#/pilsa/make/import" class="${step === 'import' ? 'on' : ''}">① <span class="ph-hide">말씀 </span>가져오기</a>
      <a href="#/pilsa/make/table" class="${step === 'table' ? 'on' : ''}">② 날짜·말씀<span class="ph-hide"> 확인</span></a>
      <a href="#/pilsa/make/design" class="${step === 'design' ? 'on' : ''}">③ <span class="ph-hide">월별 </span>디자인</a>
    </nav><div id="step"></div>`;
  const box = $('#step', el);
  if (step === 'import') renderImport(box);
  else if (step === 'design') await renderDesign(box, q);
  else renderTable(box, q);
}

// ───────── ① 말씀 가져오기 ─────────

function renderImport(box) {
  box.innerHTML = `
    <div class="card">
      <h2>말씀카드 파일 가져오기</h2>
      <p class="muted">목사님께 받은 <b>말씀카드 PPT 파일(.pptx)</b>을 고르면 과 번호, 말씀, 성경 장절을 자동으로 꺼내요.
        예전에 만든 말씀 표(CSV)도 돼요.</p>
      <div class="drop" id="drop" tabindex="0">
        <div style="font-size:32px">📄</div>
        <div><b>여기를 눌러 파일 고르기</b><br><span class="small muted">또는 파일을 여기로 끌어다 놓으세요</span></div>
      </div>
    </div>
    <div id="imp-result"></div>`;
  const drop = $('#drop', box);
  const go = (f) => f && readSource(f, $('#imp-result', box));
  drop.onclick = async () => go(await pickFile('.pptx,.csv,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv'));
  drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') drop.click(); };
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); go(e.dataTransfer.files[0]); };
}

// CSV (예전에 손으로 만든 표: 과,구절,성경,설명,라인수,날짜). 한글 엑셀 CSV(CP949)와 UTF-8 둘 다 읽는다
function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head = [], ...body] = rows.filter((r) => r.some((x) => x.trim()));
  const idx = (name) => head.findIndex((h) => h.replace(/^﻿/, '').trim() === name);
  const [iNo, iV, iR, iD] = [idx('과'), idx('구절'), idx('성경'), idx('날짜')];
  if (iNo < 0 || iV < 0) throw new Error('CSV 첫 줄에 "과"와 "구절" 칸이 있어야 해요.');
  return body.map((r) => {
    const lines = (r[iV] || '').split(/\r?\n/).map(squash).filter(Boolean);
    const ref = squash(r[iR] || '').replace(/^\(|\)$/g, '').replace(/~/g, '-');
    const date = /^\d{4}-\d{2}-\d{2}$/.test((r[iD] || '').trim()) ? r[iD].trim() : '';
    const warn = [];
    if (!lines.length) warn.push('구절이 비어 있어요');
    if (!ref) warn.push('성경 장절이 없어요');
    return { no: parseInt(r[iNo], 10) || null, ref, text: lines.join(' '), lines, date, warn };
  }).filter((s) => s.no != null);
}

async function decodeText(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('euc-kr').decode(buf); }
}

async function readSource(file, out) {
  out.innerHTML = '<div class="card">읽는 중…</div>';
  let list;
  try {
    if (/\.csv$/i.test(file.name)) list = parseCsv(await decodeText(file));
    else if (/\.pptx$/i.test(file.name)) {
      if (!window.JSZip) throw new Error('파일을 여는 도구(JSZip)를 불러오지 못했어요. 새로고침해 주세요.');
      list = await extractPptx(await file.arrayBuffer(), window.JSZip);
    } else throw new Error('PPTX 또는 CSV 파일을 골라 주세요. (예전 PPT·한글 파일은 PowerPoint에서 .pptx로 저장해 주세요)');
  } catch (e) {
    out.innerHTML = `<div class="card warn">${esc(e.message || '파일을 읽지 못했어요.')}</div>`;
    return;
  }
  list = list.filter((s) => s.no != null || s.text);
  if (!list.length) { out.innerHTML = '<div class="card warn">말씀을 하나도 찾지 못했어요. 말씀카드 파일이 맞는지 확인해 주세요.</div>'; return; }
  list.sort((a, b) => (a.no ?? 999) - (b.no ?? 999));
  showResult(file.name, list, out);
}

function showResult(name, list, out) {
  const nos = list.map((s) => s.no).filter((n) => n != null);
  const sem = Math.min(...nos) <= 26 ? 1 : 2;
  const now = new Date();
  const csvFirst = list.find((s) => s.date)?.date;
  let year = csvFirst ? +csvFirst.slice(0, 4) : now.getFullYear() + (sem === 1 && now.getMonth() >= 6 ? 1 : 0);
  const firstFor = (y) => csvFirst && +csvFirst.slice(0, 4) === y ? csvFirst : firstSundayOf(y, sem === 1 ? 1 : 7);
  const warns = list.filter((s) => s.warn?.length);
  out.innerHTML = `
    <div class="card">
      <h2>${list.length}과를 찾았어요 <span class="muted small">(${esc(name)})</span></h2>
      <p class="muted">${Math.min(...nos)}과 ~ ${Math.max(...nos)}과 · ${sem}학기. 아래 내용을 확인하고 <b>말씀 표에 넣기</b>를 누르세요. 넣은 뒤에도 고칠 수 있어요.</p>
      ${warns.length ? `<p class="warn">확인이 필요한 과: ${warns.map((s) => `${s.no ?? '?'}과(${s.warn.join(', ')})`).join(' · ')}</p>` : ''}
      <div class="row" style="margin:10px 0">
        <label class="field">연도 <input type="number" id="imp-year" value="${year}" min="2020" max="2100" style="width:100px"></label>
        <label class="field">첫 주일 (첫 과 날짜) <input type="date" id="imp-first" value="${firstFor(year)}"></label>
        <p class="hint grow">첫 주일부터 한 주(7일)씩 날짜가 자동으로 들어가요.</p>
      </div>
      <div class="table-wrap"><table class="grid"><thead><tr><th>과</th><th>날짜</th><th>말씀 (필사지 한 줄씩)</th><th>성경</th></tr></thead><tbody id="imp-rows"></tbody></table></div>
      <div class="row end" style="margin-top:12px"><button class="btn primary" id="imp-save" type="button">말씀 표에 넣기</button></div>
    </div>`;
  const draw = () => {
    const first = $('#imp-first', out).value;
    $('#imp-rows', out).innerHTML = list.map((s, i) => `<tr>
      <td><b>${s.no ?? '?'}과</b></td>
      <td>${first ? addDays(first, 7 * i) : ''}</td>
      <td><div class="verse-lines">${esc(s.lines.join('\n'))}</div>${s.warn?.length ? `<div class="warn">${esc(s.warn.join(', '))}</div>` : ''}</td>
      <td>${esc(s.ref)}</td></tr>`).join('');
  };
  draw();
  $('#imp-first', out).onchange = draw;
  $('#imp-year', out).onchange = (e) => { year = +e.target.value; $('#imp-first', out).value = firstFor(year); draw(); };
  $('#imp-save', out).onclick = async () => {
    const first = $('#imp-first', out).value;
    if (!first) { toast('첫 주일 날짜를 골라 주세요.'); return; }
    const term = `${$('#imp-year', out).value}-${sem}`;
    const L = S.data.items.lessons;
    const dup = list.filter((s) => L.some((x) => x.kind !== 'special' && termOf(x) === term && x.no === s.no));
    if (dup.length && !confirm(`${termName(term)}에 이미 있는 ${dup.length}과(${dup.map((s) => s.no).join(', ')}과)를 새 내용으로 바꿀까요?\n(바꾸지 않으려면 '취소')`)) return;
    list.forEach((s, i) => {
      const item = { kind: 'lesson', term, no: s.no, date: addDays(first, 7 * i), ref: s.ref, lines: s.lines, at: new Date().toISOString() };
      const cur = L.find((x) => x.kind !== 'special' && termOf(x) === term && x.no === s.no);
      if (cur) Object.assign(cur, item); else L.push({ id: uid(), ...item });
    });
    S.data.sys.firstSunday = { ...S.data.sys.firstSunday, [term]: first };
    await changed('lessons');
    await changedSys();
    toast(`${list.length}과를 말씀 표에 넣었어요.`);
    location.hash = `#/pilsa/make/table?term=${term}`;
  };
}

// ───────── ② 날짜·말씀 확인 ─────────

let saveTimer = null;
const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => changed('lessons'), 500); };

function renderTable(box, q) {
  const all = terms();
  if (!all.length) {
    box.innerHTML = `<div class="card"><h2>아직 말씀이 없어요</h2><p class="muted">먼저 <a href="#/pilsa/make/import">① <span class="ph-hide">말씀 </span>가져오기</a>에서 말씀카드 파일을 넣어 주세요. 또는 특별한 장을 직접 만들 수 있어요.</p>
      <button class="btn" id="add-special" type="button">＋ 특별한 장 만들기 (성경학교 등)</button></div>`;
    $('#add-special', box).onclick = () => addSpecial();
    return;
  }
  const term = all.includes(q.get('term')) ? q.get('term') : all[0];
  const list = sortLessons(S.data.items.lessons.filter((v) => termOf(v) === term));
  const first = S.data.sys.firstSunday?.[term] || list.find((v) => v.kind !== 'special')?.date || '';
  box.innerHTML = `
    <div class="card">
      <div class="row">
        <label class="field">학기 <select id="term">${all.map((t) => `<option value="${t}" ${t === term ? 'selected' : ''}>${termName(t)} (${S.data.items.lessons.filter((v) => termOf(v) === t).length}장)</option>`).join('')}</select></label>
        <label class="field">첫 주일 <input type="date" id="first" value="${first}"></label>
        <button class="btn" id="refill" type="button" style="align-self:flex-end">날짜 다시 채우기</button>
        <span class="grow"></span>
        <button class="btn" id="add-special" type="button" style="align-self:flex-end">＋ 특별한 장 (성경학교 등)</button>
      </div>
      <p class="hint">날짜는 첫 주일부터 한 주씩 자동으로 들어가요. 바뀐 주일이 있으면 그 칸만 고치면 돼요.
        말씀 칸의 <b>한 줄 = 필사지의 한 줄</b>이에요. 고치면 바로 저장돼요.</p>
    </div>
    <div class="table-wrap"><table class="grid">
      <thead><tr><th>과</th><th>날짜</th><th>말씀 (필사지 한 줄씩)</th><th>성경</th><th></th></tr></thead>
      <tbody id="rows"></tbody></table></div>`;
  $('#term', box).onchange = (e) => { location.hash = `#/pilsa/make/table?term=${e.target.value}`; };
  $('#add-special', box).onclick = () => addSpecial(term);
  $('#refill', box).onclick = async () => {
    const f = $('#first', box).value;
    if (!f) { toast('첫 주일 날짜를 골라 주세요.'); return; }
    if (!confirm('모든 과의 날짜를 첫 주일부터 한 주씩 다시 넣을까요?\n직접 고친 날짜도 바뀌어요. (특별한 장은 그대로)')) return;
    list.filter((v) => v.kind !== 'special').sort((a, b) => a.no - b.no).forEach((v, i) => { v.date = addDays(f, 7 * i); });
    S.data.sys.firstSunday = { ...S.data.sys.firstSunday, [term]: f };
    await changed('lessons');
    await changedSys();
    toast('날짜를 다시 넣었어요.');
    renderTable(box, q);
  };
  drawRows(box, list, q);
}

function rowHTML(v) {
  const lines = (v.lines || []).join('\n');
  const longest = Math.max(0, ...(v.lines || []).map((l) => l.length));
  const sp = v.kind === 'special';
  return `<tr data-id="${esc(v.id)}">
    <td class="no">${sp ? `<span class="pill special">특별</span><input type="text" data-f="title" value="${esc(v.title)}" placeholder="제목" style="width:100%;margin-top:4px">`
      : `<span class="cell-label">과</span><input type="number" data-f="no" value="${v.no ?? ''}" min="1" max="99">과`}</td>
    <td class="date"><span class="cell-label">날짜</span><input type="date" data-f="date" value="${esc(v.date)}"></td>
    <td><span class="cell-label">말씀 (한 줄 = 필사지 한 줄)</span><textarea data-f="lines" rows="${Math.max(2, (v.lines || []).length)}">${esc(lines)}</textarea>
      <div class="row small"><span class="muted lnfo">${(v.lines || []).length}줄 · 가장 긴 줄 ${longest}자</span>
      ${longest > LONG ? '<span class="warn">줄이 길면 따라 쓰기 글자가 작아져요</span>' : ''}
      <button class="btn small ghost" data-act="reflow" type="button">자동 줄 나눔</button></div></td>
    <td class="ref"><span class="cell-label">성경</span><input type="text" data-f="ref" value="${esc(v.ref)}" placeholder="예: 빌립보서 4:4"></td>
    <td class="act"><div class="row"><button class="btn small" data-act="preview" type="button">미리보기</button>
      <button class="btn small danger" data-act="del" type="button">지우기</button></div></td></tr>`;
}

function drawRows(box, list, q) {
  let html = '';
  let month = null;
  for (const v of list) {
    const m = monthOf(v);
    if (m !== month) {
      month = m;
      html += `<tr class="month-head"><td colspan="5">${THEMES[m].name} <a class="small" href="#/pilsa/make/design?month=${m}">디자인 보기</a></td></tr>`;
    }
    html += rowHTML(v);
  }
  const tb = $('#rows', box);
  tb.innerHTML = html;
  const find = (el) => S.data.items.lessons.find((x) => x.id === el.closest('tr').dataset.id);
  tb.oninput = (e) => {
    const f = e.target.dataset.f;
    const v = f && find(e.target);
    if (!v) return;
    if (f === 'lines') {
      v.lines = e.target.value.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const longest = Math.max(0, ...v.lines.map((l) => l.length));
      const info = e.target.closest('td').querySelector('.lnfo');
      info.textContent = `${v.lines.length}줄 · 가장 긴 줄 ${longest}자`;
    } else if (f === 'no') v.no = parseInt(e.target.value, 10) || null;
    else v[f] = e.target.value;
    saveSoon();
  };
  tb.onchange = (e) => {
    if (e.target.dataset.f === 'date') { changed('lessons'); renderTable(box.closest('#step') || box, q); }
  };
  tb.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const v = find(b);
    if (b.dataset.act === 'reflow') {
      v.lines = reflow((v.lines || []).join(' '));
      await changed('lessons');
      const ta = b.closest('td').querySelector('textarea');
      ta.value = v.lines.join('\n');
      ta.rows = Math.max(2, v.lines.length);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (b.dataset.act === 'del') {
      const name = v.kind === 'special' ? `'${v.title || '특별한 장'}'` : `${v.no}과`;
      if (!confirm(`${name}을(를) 말씀 표에서 지울까요?\n(휴지통으로 가요. 설정 → 휴지통에서 되살릴 수 있어요)`)) return;
      S.data.items.lessons = S.data.items.lessons.filter((x) => x !== v);
      await changed('lessons');
      toast(`${name}을(를) 휴지통으로 옮겼어요.`);
      renderTable(box.closest('#step') || box, q);
    } else if (b.dataset.act === 'preview') {
      clearTimeout(saveTimer);
      await changed('lessons');
      previewOne(v);
    }
  };
}

export async function previewOne(v) {
  await openModal(`<div class="row"><h2 class="grow">미리보기</h2><a class="btn" href="#/pilsa/print?only=${esc(v.id)}">이 장 인쇄하러 가기</a><button class="btn" data-close type="button">닫기</button></div>
    <div id="pv-one" style="margin-top:10px"></div>`, async (body) => {
    await renderPreviews($('#pv-one', body), [v], { max: 0.8 });
  });
}

// 여름/겨울성경학교처럼 한 번만 쓰는 장
function addSpecial(term) {
  const date = nextSunday();
  openModal(`
    <h2>특별한 장 만들기</h2>
    <p class="muted">여름·겨울성경학교처럼 한 번만 쓰는 필사지예요. 말씀은 붙여 넣고 <b>자동 줄 나눔</b>을 누르거나, 직접 한 줄씩 써도 돼요.</p>
    <div class="row" style="margin:8px 0">
      <label class="field grow">제목 (제목 띠에 들어가요) <input type="text" id="sp-title" value="여름성경학교 말씀 필사"></label>
      <label class="field">날짜 <input type="date" id="sp-date" value="${date}"></label>
      <label class="field">디자인 <select id="sp-month">${Object.entries(THEMES).map(([m, t]) => `<option value="${m}">${t.name}</option>`).join('')}</select></label>
    </div>
    <label class="field">말씀 (한 줄 = 필사지 한 줄)<textarea id="sp-lines" rows="4" placeholder="말씀을 붙여 넣으세요"></textarea></label>
    <div class="row" style="margin:6px 0 10px"><button class="btn small" id="sp-reflow" type="button">자동 줄 나눔</button><span class="hint">긴 말씀을 필사지에 맞게 2~4줄로 나눠요.</span></div>
    <label class="field">성경 <input type="text" id="sp-ref" placeholder="예: 시편 23:1"></label>
    <div class="row end" style="margin-top:14px"><button class="btn" data-close type="button">취소</button><button class="btn primary" id="sp-save" type="button">만들기</button></div>`,
  (body, close) => {
    const syncMonth = () => { $('#sp-month', body).value = String(+$('#sp-date', body).value.slice(5, 7) || 1); };
    syncMonth();
    $('#sp-date', body).onchange = syncMonth;
    $('#sp-reflow', body).onclick = () => { const ta = $('#sp-lines', body); ta.value = reflow(ta.value.replace(/\n/g, ' ')).join('\n'); };
    $('#sp-save', body).onclick = async () => {
      const lines = $('#sp-lines', body).value.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (!lines.length) { toast('말씀을 넣어 주세요.'); return; }
      const d = $('#sp-date', body).value;
      const v = { id: uid(), kind: 'special', title: $('#sp-title', body).value.trim() || '말씀 필사', date: d, month: +$('#sp-month', body).value,
        ref: $('#sp-ref', body).value.trim().replace(/^\(|\)$/g, ''), lines, at: new Date().toISOString() };
      v.term = termOf({ date: d }) || term;
      S.data.items.lessons.push(v);
      await changed('lessons');
      close();
      toast('특별한 장을 만들었어요.');
      location.hash = `#/pilsa/make/table?term=${v.term}&t=${Date.now()}`;
    };
  });
}
