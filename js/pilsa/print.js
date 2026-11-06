// 필사 인쇄: 과(장)나 달을 골라 A4 미리보기 → 인쇄 (인쇄 창에서 'PDF로 저장'을 고르면 PDF)
import { S } from '../store.js';
import { $, toast } from '../ui.js';
import { THEMES } from './themes.js';
import { esc, monthOf, titleOf } from './sheet.js';
import { renderPreviews, rescale } from './preview.js';
import { terms, termOf, termName, sortLessons } from './make.js';
import { iso } from '../ui.js';

let picked = new Set();

export async function renderPrint(el, q) {
  const all = terms();
  if (!all.length) {
    el.innerHTML = '<div class="card"><h2>인쇄할 말씀이 없어요</h2><p class="muted">먼저 <a href="#/pilsa/make/import">필사노트 제작</a>에서 말씀을 넣어 주세요.</p></div>';
    return;
  }
  const L = S.data.items.lessons;
  const only = q.get('only') && L.find((v) => v.id === q.get('only'));
  const qm = +(q.get('month') || 0);
  let term = all.includes(q.get('term')) ? q.get('term') : only ? termOf(only) : null;
  if (!term && qm) term = all.find((t) => L.some((v) => termOf(v) === t && monthOf(v) === qm));
  term ||= all.find((t) => L.some((v) => termOf(v) === t && v.date >= iso(new Date()))) || all[0];
  const list = sortLessons(L.filter((v) => termOf(v) === term));
  const months = [...new Set(list.map(monthOf))];

  if (only) picked = new Set([only.id]);
  else if (qm) picked = new Set(list.filter((v) => monthOf(v) === qm).map((v) => v.id));
  else {
    // 기본: 다가오는 주일이 있는 달
    const next = list.find((v) => v.date >= iso(new Date())) || list[0];
    picked = new Set(list.filter((v) => monthOf(v) === monthOf(next)).map((v) => v.id));
  }

  el.innerHTML = `
    <div class="print-layout">
      <div class="card sticky-side">
        <label class="field">학기 <select id="p-term">${all.map((t) => `<option value="${t}" ${t === term ? 'selected' : ''}>${termName(t)}</option>`).join('')}</select></label>
        <div class="row" style="margin:10px 0 6px"><b class="grow">인쇄할 장 고르기</b><button class="btn small ghost" id="p-none" type="button">모두 빼기</button></div>
        <div class="pick-list" id="p-list">${months.map((m) => `
          <div class="m"><span>${THEMES[m].name}</span><button class="btn small ghost" data-month="${m}" type="button">이 달 모두</button></div>
          ${list.filter((v) => monthOf(v) === m).map((v) => `<label><input type="checkbox" value="${esc(v.id)}" ${picked.has(v.id) ? 'checked' : ''}>
            <span><b>${esc(v.kind === 'special' ? titleOf(v) : v.no + '과')}</b> <span class="small muted">${esc(v.date || '')}</span><br><span class="small muted">${esc(v.ref || '')}</span></span></label>`).join('')}`).join('')}
        </div>
        <button class="btn primary" id="p-print" type="button" style="width:100%;margin-top:12px">고른 장 인쇄</button>
        <p class="hint">인쇄 창에서 <b>대상(프린터)</b>을 <b>PDF로 저장</b>으로 고르면 PDF 파일이 돼요.
          용지 <b>A4</b>, 배율 <b>기본(100%)</b>, 여백 <b>없음</b>, <b>배경 그래픽</b> 켜기로 인쇄하세요.</p>
      </div>
      <div class="card"><div class="row" style="margin-bottom:10px"><b class="grow" id="p-count"></b></div><div id="p-preview"></div></div>
    </div>`;

  $('#p-term', el).onchange = (e) => { location.hash = `#/pilsa/print?term=${e.target.value}`; };
  const listEl = $('#p-list', el);
  listEl.onchange = () => { picked = new Set([...listEl.querySelectorAll('input:checked')].map((i) => i.value)); draw(); };
  listEl.onclick = (e) => {
    const b = e.target.closest('[data-month]');
    if (!b) return;
    const ids = list.filter((v) => monthOf(v) === +b.dataset.month).map((v) => v.id);
    const allOn = ids.every((id) => picked.has(id));
    ids.forEach((id) => (allOn ? picked.delete(id) : picked.add(id)));
    listEl.querySelectorAll('input').forEach((i) => { i.checked = picked.has(i.value); });
    draw();
  };
  $('#p-none', el).onclick = () => { picked.clear(); listEl.querySelectorAll('input').forEach((i) => { i.checked = false; }); draw(); };
  $('#p-print', el).onclick = () => {
    if (!picked.size) { toast('인쇄할 장을 골라 주세요.'); return; }
    printNow();
  };

  // 고른 달이 목록에서 바로 보이게
  const firstOn = listEl.querySelector('input:checked')?.closest('label');
  if (firstOn) listEl.scrollTop = firstOn.offsetTop - listEl.offsetTop - 40;

  const pv = $('#p-preview', el);
  pv.onclick = (e) => {
    const b = e.target.closest('[data-one]');
    if (b) printNow(b.dataset.one);
  };
  onresize = () => { if (pv.isConnected) rescale(pv, 0.9); };

  let seq = 0;
  async function draw() {
    const my = ++seq;
    const sel = list.filter((v) => picked.has(v.id));
    $('#p-count', el).textContent = sel.length ? `${sel.length}장 미리보기 (A4)` : '고른 장이 없어요';
    document.body.dataset.ready = '';
    await renderPreviews(pv, sel, { max: 0.9, bar: (v) => `<span class="small muted">${esc(v.kind === 'special' ? titleOf(v) : v.no + '과')} · ${esc(v.date || '')}</span><button class="btn small" data-one="${esc(v.id)}" type="button">이 장만 인쇄</button>` });
    if (my !== seq) return;
    fillPrintRoot();
    document.body.dataset.ready = '1';
  }
  await draw();
}

// 미리보기에서 크기를 맞춘 장을 그대로 복사해 인쇄용 자리에 둔다 (id 를 주면 그 장만)
function fillPrintRoot(id) {
  const root = $('#print-root');
  root.innerHTML = '';
  document.querySelectorAll('#p-preview .page').forEach((p) => {
    if (!id || p.dataset.id === id) root.append(p.cloneNode(true));
  });
}

function printNow(id) {
  fillPrintRoot(id);
  const restore = () => { removeEventListener('afterprint', restore); fillPrintRoot(); };
  addEventListener('afterprint', restore);
  window.print();
}
