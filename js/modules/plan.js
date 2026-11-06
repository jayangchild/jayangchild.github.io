// 연간계획: plan { date, end?, title, place?, note }  — 한 해를 달마다 목록으로
import { col, isWriter } from './ctx.js';
import { $, esc, toast, formModal, guard, head, readOnlyNote, empty, fmtDate, askTrash, gone } from './kit.js';

const fields = [
  { name: 'title', label: '행사', required: true },
  { name: 'date', label: '날짜', type: 'date', required: true },
  { name: 'end', label: '끝나는 날 (여러 날이면)', type: 'date' },
  { name: 'place', label: '장소' },
  { name: 'note', label: '메모', type: 'textarea', rows: 3 },
];

export async function renderPlan(el, q) {
  if (gone(el, 'plan')) return; // 그사이 다른 화면으로 갔으면 그리지 않는다
  const writer = isWriter();
  const all = col('plan').list();
  const years = [...new Set([new Date().getFullYear(), ...all.map((e) => +String(e.date).slice(0, 4)).filter(Boolean)])].sort();
  const year = +(q.get('y') || new Date().getFullYear());
  const evs = all.filter((e) => String(e.date).startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date));
  const nowYM = new Date().toISOString().slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  el.innerHTML = head('연간계획', `${year}년 유년부 행사`, writer ? '<button class="btn primary" type="button" data-act="add">+ 행사 추가</button>' : '') + `
    <div class="row filters"><select id="p-year" aria-label="해">${years.map((y) => `<option ${y === year ? 'selected' : ''} value="${y}">${y}년</option>`).join('')}</select></div>
    ${writer ? '' : readOnlyNote()}
    <div class="year-grid">${months.map((m) => {
      const ym = `${year}-${String(m).padStart(2, '0')}`;
      const list = evs.filter((e) => e.date.startsWith(ym));
      return `<section class="card month ${ym === nowYM ? 'now' : ''}"><h3>${m}월</h3>${list.length ? `<ul class="ev-list">${list.map((e) => `<li data-id="${esc(e.id)}">
        <span class="d">${esc(fmtDate(e.date))}${e.end && e.end !== e.date ? ` ~ ${esc(fmtDate(e.end))}` : ''}</span>
        <b>${esc(e.title)}</b>${e.place ? ` <span class="small muted">· ${esc(e.place)}</span>` : ''}
        ${e.note ? `<div class="small muted">${esc(e.note)}</div>` : ''}
        ${writer ? '<span class="ev-act"><button class="btn small" data-act="edit" type="button">고치기</button><button class="btn small ghost" data-act="del" type="button" aria-label="휴지통">🗑</button></span>' : ''}</li>`).join('')}</ul>` : '<p class="small muted">—</p>'}</section>`;
    }).join('')}</div>${evs.length ? '' : empty('이 해에는 아직 행사가 없어요.')}`;
  $('#p-year', el).onchange = (e) => { location.hash = `#/plan?y=${e.target.value}`; };
  el.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !writer) return;
    const id = b.closest('[data-id]')?.dataset.id;
    const ev = id ? col('plan').get(id) : null;
    await guard(b, async () => {
      if (b.dataset.act === 'del') { if (askTrash(ev.title)) { await col('plan').softDelete(id); toast('휴지통으로 옮겼어요.'); renderPlan(el, q); } return; }
      const v = await formModal(ev ? '행사 고치기' : '행사 추가', fields, ev || { date: `${year}-${new Date().toISOString().slice(5, 10)}` });
      if (!v) return;
      await col('plan').put({ ...(ev || {}), ...v });
      toast('저장했어요.');
      renderPlan(el, q);
    })();
  };
}
