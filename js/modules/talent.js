// 달란트: 학생마다 장부 (더하기만 하는 기록 + 계산한 잔액)
//   talentLog { member, qty: +n|-n, date, why }   — 고치지 않고 한 줄씩 더한다. 잘못 넣었으면 반대 기록을 넣거나 휴지통
//   잔액 = 그 학생 기록 qty 합계. 두 선생님이 동시에 눌러도 기록이 따로 생겨서 서로 덮어쓰지 않는다.
// 나중에: 필사노트 확인(필사 체크)에서 달란트를 주는 고리 — addTalent(member, qty, why) 를 부르면 된다.
import { col, isWriter } from './ctx.js';
import { $, esc, toast, formModal, hydrate, imgTag, guard, head, readOnlyNote, empty, today, won } from './kit.js';
import { students, classOf } from './roster.js';

export function balances() {
  const out = new Map();
  for (const r of col('talentLog').list()) out.set(r.member, (out.get(r.member) || 0) + (Number(r.qty) || 0));
  return out;
}
export const addTalent = (member, qty, why = '', date = today()) => col('talentLog').put({ member, qty: Number(qty), why, date });

export function monthSummary(ym) {
  const out = new Map();
  for (const r of col('talentLog').list()) {
    if (!String(r.date || '').startsWith(ym)) continue;
    const s = out.get(r.member) || { plus: 0, minus: 0 };
    if (r.qty > 0) s.plus += r.qty; else s.minus += -r.qty;
    out.set(r.member, s);
  }
  return out;
}

export async function renderTalent(el, q) {
  const writer = isWriter();
  const tab = q.get('t') || 'class';
  const bal = balances();
  const list = students();
  const nav = `<nav class="subnav"><a href="#/talent" class="${tab === 'class' ? 'on' : ''}">반별 잔액</a><a href="#/talent?t=month" class="${tab === 'month' ? 'on' : ''}">한 달 정리</a></nav>`;
  if (tab === 'month') return renderMonth(el, q, nav);
  const groups = new Map();
  for (const m of list) { const k = classOf(m) || '반 없음'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
  el.innerHTML = head('달란트', '학생마다 받은 것·쓴 것을 한 줄씩 남기고, 잔액은 그 합계예요.' + (writer ? ' +1 / −1 은 오늘 날짜로 바로 기록돼요.' : '')) + nav + (writer ? '' : readOnlyNote()) +
    (list.length ? [...groups].map(([g, ms]) => `<section class="card"><h3>${esc(g)} <span class="muted small">${ms.length}명 · 합계 ${ms.reduce((s, m) => s + (bal.get(m.id) || 0), 0)}</span></h3>
      <ul class="talent-list">${ms.map((m) => `<li data-id="${esc(m.id)}">
        ${m.photo ? imgTag(m.photo, 'avatar sm', m.name) : '<span class="avatar sm ph">🙂</span>'}
        <button class="linkish" type="button" data-act="ledger"><b>${esc(m.name)}</b></button>
        <span class="bal" data-bal>${bal.get(m.id) || 0}</span>
        ${writer ? `<span class="quick"><button class="btn small" type="button" data-act="minus" aria-label="${esc(m.name)} 1 빼기">−1</button><button class="btn small primary" type="button" data-act="plus" aria-label="${esc(m.name)} 1 더하기">+1</button><button class="btn small ghost" type="button" data-act="more">기록…</button></span>` : ''}
      </li>`).join('')}</ul></section>`).join('') : empty('명단에 학생이 없어요.'));
  hydrate(el);
  el.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const li = b.closest('[data-id]');
    const id = li?.dataset.id;
    const m = col('members').get(id);
    await guard(b, async () => {
      if (b.dataset.act === 'ledger') return ledger(m);
      if (!writer) return;
      if (b.dataset.act === 'plus' || b.dataset.act === 'minus') {
        await addTalent(id, b.dataset.act === 'plus' ? 1 : -1);
        li.querySelector('[data-bal]').textContent = balances().get(id) || 0;
        toast(`${m.name}: ${b.dataset.act === 'plus' ? '+1' : '−1'} (잔액 ${balances().get(id) || 0})`, 1500);
      }
      if (b.dataset.act === 'more') {
        const v = await formModal(`${m.name} 달란트 기록`, [
          { name: 'qty', label: '몇 개 (빼면 앞에 −)', type: 'number', required: true, value: 1 },
          { name: 'date', label: '날짜', type: 'date', required: true, value: today() },
          { name: 'why', label: '이유', placeholder: '예: 출석, 암송, 필사, 달란트 시장' },
        ]);
        if (v && v.qty) { await addTalent(id, v.qty, v.why, v.date); toast('기록했어요.'); renderTalent(el, q); }
      }
    })();
  };
}

async function ledger(m) {
  const rows = col('talentLog').list().filter((r) => r.member === m.id).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const total = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const { openModal } = await import('../ui.js');
  await openModal(`<h2>${esc(m.name)} 달란트 장부</h2><p>잔액 <b class="bal">${total}</b></p>
    <div class="table-wrap"><table class="grid"><thead><tr><th>날짜</th><th>개수</th><th>이유</th><th>누가</th>${isWriter() ? '<th></th>' : ''}</tr></thead><tbody>
    ${rows.map((r) => `<tr data-id="${esc(r.id)}"><td>${esc(r.date || '')}</td><td class="${r.qty < 0 ? 'neg' : 'pos'}">${won(r.qty)}</td><td>${esc(r.why || '')}</td><td class="small muted">${esc(r.createdBy || '')}</td>${isWriter() ? '<td><button class="btn small ghost" data-del type="button" title="휴지통 (되살릴 수 있어요)">🗑</button></td>' : ''}</tr>`).join('') || '<tr><td colspan="5" class="muted">기록이 없어요.</td></tr>'}
    </tbody></table></div><div class="row end"><button class="btn primary" data-close type="button">닫기</button></div>`, (body) => {
    body.addEventListener('click', async (e) => {
      const d = e.target.closest('[data-del]');
      if (!d || !confirm('이 기록을 휴지통으로 옮길까요? (잔액에서 빠지고, 휴지통에서 되살릴 수 있어요)')) return;
      await col('talentLog').softDelete(d.closest('tr').dataset.id);
      d.closest('tr').remove();
      toast('휴지통으로 옮겼어요.');
    });
  });
}

function renderMonth(el, q, nav) {
  const now = new Date();
  const ym = q.get('m') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const sum = monthSummary(ym);
  const bal = balances();
  const rows = students().map((m) => ({ m, s: sum.get(m.id) || { plus: 0, minus: 0 } }));
  const tot = rows.reduce((a, { s }) => ({ plus: a.plus + s.plus, minus: a.minus + s.minus }), { plus: 0, minus: 0 });
  el.innerHTML = head('달란트', '한 달 동안 받은 것·쓴 것과 지금 잔액') + nav + `<div class="card">
    <div class="row"><label class="field">달 <input type="month" id="t-month" value="${esc(ym)}"></label>
      <span class="grow"></span><span>받음 <b class="pos">+${tot.plus}</b> · 씀 <b class="neg">−${tot.minus}</b></span></div>
    <div class="table-wrap"><table class="grid month-sum"><thead><tr><th>반</th><th>이름</th><th>받음</th><th>씀</th><th>지금 잔액</th></tr></thead><tbody>
    ${rows.map(({ m, s }) => `<tr><td>${esc(classOf(m))}</td><td>${esc(m.name)}</td><td class="pos">${s.plus ? `+${s.plus}` : ''}</td><td class="neg">${s.minus ? `−${s.minus}` : ''}</td><td><b>${bal.get(m.id) || 0}</b></td></tr>`).join('')}
    </tbody></table></div></div>`;
  $('#t-month', el).onchange = (e) => { location.hash = `#/talent?t=month&m=${e.target.value}`; };
}
