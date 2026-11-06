// 선물: 종류(전도선물·생일선물·성경암송대회 선물 + 관리자가 더함), 물품, 재고
//   giftTypes { name }                      — 기본 3가지는 늘 있다
//   gifts     { name, type, unit, low, note } — low = 이만큼 이하면 '부족' 표시
//   giftStock { id: <gift id>, qty, at }    — 기준 수량. 다시 셀 때만 고친다
//   giftLog   { gift, qty: +n(입고)|-n(지급), kind: 'in'|'out', date, to, why } — 더하기만
//   재고 = 기준 수량 + (기준을 정한 뒤의 giftLog qty 합계). 동시에 나눠 줘도 기록이 따로 생겨 충돌하지 않는다 (js/schemas.js)
import { col, isWriter, who } from './ctx.js';
import { $, esc, toast, formModal, guard, head, empty, today, won, askTrash, gone } from './kit.js';
import { openModal } from '../ui.js';

// «⋯» 메뉴: 다른 곳을 누르면 닫기
document.addEventListener('click', (e) => {
  for (const d of document.querySelectorAll('details.row-more[open]')) if (!d.contains(e.target)) d.removeAttribute('open');
});

export const BUILTIN_TYPES = ['전도선물', '생일선물', '성경암송대회 선물'];
export const giftTypes = () => [...BUILTIN_TYPES, ...col('giftTypes').list().map((t) => t.name).filter((n) => !BUILTIN_TYPES.includes(n))];

export function stockOf(giftId) {
  const base = col('giftStock').get(giftId);
  const since = base?.at || '';
  let n = Number(base?.qty) || 0;
  for (const r of col('giftLog').list()) if (r.gift === giftId && (!since || (r.createdAt || '') > since)) n += Number(r.qty) || 0;
  return n;
}
export const isLow = (g, n = stockOf(g.id)) => g.low != null && g.low !== '' && n <= Number(g.low);

const itemFields = () => [
  { name: 'name', label: '물품 이름', required: true, placeholder: '예: 비타500 젤리' },
  { name: 'type', label: '종류', type: 'select', options: giftTypes().map((t) => [t, t]) },
  { name: 'unit', label: '단위', placeholder: '개' },
  { name: 'low', label: '부족 알림 (이만큼 이하면)', type: 'number' },
  { name: 'note', label: '메모', type: 'textarea', rows: 2 },
];

export async function renderGifts(el, q) {
  if (gone(el, 'gifts')) return; // 그사이 다른 화면으로 갔으면 그리지 않는다
  const writer = isWriter();
  const tab = q.get('t') || 'stock';
  const types = giftTypes();
  const ftype = q.get('type') || '';
  const items = col('gifts').list().filter((g) => !ftype || g.type === ftype).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const nav = `<nav class="subnav"><a href="#/gifts" class="${tab === 'stock' ? 'on' : ''}">재고</a><a href="#/gifts?t=log" class="${tab === 'log' ? 'on' : ''}">주고받은 기록</a></nav>`;
  const low = col('gifts').list().filter((g) => isLow(g));
  el.innerHTML = head('선물', '전도선물 · 생일선물 · 성경암송대회 선물. 들어온 것(입고)과 나눠 준 것(지급)을 한 줄씩 남기면 재고가 저절로 계산돼요.',
    writer ? '<button class="btn primary" data-act="item" type="button">+ 물품</button><button class="btn" data-act="type" type="button">+ 종류</button>' : '') + nav +
    (low.length ? `<div class="banner bad low-warn">⚠ 재고가 적어요: ${low.map((g) => `<b>${esc(g.name)}</b> ${stockOf(g.id)}${esc(g.unit || '개')}`).join(', ')}</div>` : '') +
    `<div class="row filters"><a class="btn small ${!ftype ? 'on' : ''}" href="#/gifts${tab === 'log' ? '?t=log' : ''}">전체</a>${types.map((t) => `<a class="btn small ${t === ftype ? 'on' : ''}" href="#/gifts?${tab === 'log' ? 't=log&' : ''}type=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>` +
    (tab === 'log' ? logTable(items) : stockTable(items, writer));
  el.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !writer) return;
    b.closest('details.row-more')?.removeAttribute('open');
    const id = b.closest('[data-id]')?.dataset.id;
    const g = id ? col('gifts').get(id) : null;
    await guard(b, async () => {
      const act = b.dataset.act;
      if (act === 'type') {
        const v = await formModal('선물 종류 더하기', [{ name: 'name', label: '종류 이름', required: true, placeholder: '예: 달란트 시장 선물' }], {}, { intro: `기본: ${BUILTIN_TYPES.join(' · ')}` });
        if (!v) return;
        if (types.includes(v.name)) throw new Error('이미 있는 종류예요.');
        await col('giftTypes').put({ name: v.name });
      }
      if (act === 'item' || act === 'edit') {
        const v = await formModal(g ? `${g.name} 고치기` : '새 물품', [...itemFields(), ...(g ? [] : [{ name: 'qty', label: '지금 있는 개수 (처음 재고)', type: 'number', value: 0 }])], g || { type: ftype || types[0], unit: '개' });
        if (!v) return;
        const { qty, ...rest } = v;
        const rec = await col('gifts').put({ ...(g || {}), ...rest });
        if (!g) await col('giftStock').put({ id: rec.id, qty: Number(qty) || 0, at: new Date().toISOString() });
      }
      if (act === 'in' || act === 'out') {
        const out = act === 'out';
        const v = await formModal(`${g.name} ${out ? '지급 (나눠 줌)' : '입고 (들어옴)'}`, [
          { name: 'qty', label: '개수', type: 'number', required: true, value: 1 },
          { name: 'date', label: '날짜', type: 'date', required: true, value: today() },
          ...(out ? [{ name: 'to', label: '누구에게', placeholder: '예: 새 친구 3명, 1학년 1반' }] : []),
          { name: 'why', label: out ? '왜' : '어디서·메모', placeholder: out ? '예: 전도 주일, 생일' : '예: 구입' },
        ]);
        if (!v || !v.qty) return;
        const n = Math.abs(v.qty);
        await col('giftLog').put({ gift: g.id, qty: out ? -n : n, kind: out ? 'out' : 'in', date: v.date, to: v.to || '', why: v.why || '' });
        toast(`${g.name}: ${out ? '−' : '+'}${n} → 재고 ${stockOf(g.id)}${g.unit || '개'}`);
      }
      if (act === 'count') {
        const v = await formModal(`${g.name} 다시 세기`, [{ name: 'qty', label: '지금 실제로 있는 개수', type: 'number', required: true, value: stockOf(g.id) }], {}, { intro: '창고에서 세어 본 개수로 기준을 다시 정해요. 지난 기록은 지우지 않고 그대로 남아요.' });
        if (!v) return;
        await col('giftStock').put({ id: g.id, qty: Number(v.qty), at: new Date().toISOString(), countedBy: who.name });
      }
      if (act === 'hist') return history(g);
      if (act === 'del') { if (!askTrash(g.name)) return; await col('gifts').softDelete(g.id); }
      renderGifts(el, q);
    })();
  };
}

function stockTable(items, writer) {
  if (!items.length) return `<div class="card">${empty('물품이 없어요. «+ 물품»으로 넣거나 관리 → 데이터 → 가져오기를 쓰세요.')}</div>`;
  return `<div class="card"><div class="table-wrap gift-wrap"><table class="grid gift-stock"><thead><tr><th>물품</th><th>종류</th><th>재고</th><th>부족 알림</th>${writer ? '<th></th>' : ''}</tr></thead><tbody>
    ${items.map((g) => {
      const n = stockOf(g.id);
      return `<tr data-id="${esc(g.id)}" class="${isLow(g, n) ? 'low' : ''}"><td><b>${esc(g.name)}</b>${g.note ? `<div class="small muted">${esc(g.note)}</div>` : ''}</td><td>${esc(g.type || '')}</td>
        <td class="stock"><b data-stock>${n}</b> ${esc(g.unit || '개')} ${isLow(g, n) ? '<span class="pill warnpill">⚠ 부족</span>' : ''}</td><td><span class="cell-label">부족 알림</span>${g.low != null && g.low !== '' ? `${esc(g.low)} 이하` : '—'}</td>
        ${writer ? `<td class="act"><div class="act-main"><button class="btn small primary" data-act="out" type="button">지급</button><button class="btn small" data-act="in" type="button">입고</button>
          <details class="row-more"><summary class="btn small ghost" aria-label="더 보기">⋯</summary><div class="row-more-menu">
            <button class="btn small ghost" data-act="hist" type="button">📋 기록</button><button class="btn small ghost" data-act="count" type="button">🔢 다시 세기</button>
            <button class="btn small ghost" data-act="edit" type="button">✏️ 고치기</button><button class="btn small ghost" data-act="del" type="button">🗑 휴지통</button></div></details></div></td>` : ''}</tr>`;
    }).join('')}</tbody></table></div></div>`;
}

function logRows(list) {
  const name = (id) => col('gifts').get(id)?.name || '(휴지통의 물품)';
  return list.map((r) => `<tr><td>${esc(r.date || '')}</td><td>${esc(name(r.gift))}</td><td class="${r.qty < 0 ? 'neg' : 'pos'}">${r.qty < 0 ? '지급' : '입고'} ${won(r.qty)}</td><td>${esc(r.to || '')}</td><td>${esc(r.why || '')}</td><td class="small muted">${esc(r.createdBy || '')}</td></tr>`).join('');
}
function logTable(items) {
  const ids = new Set(items.map((g) => g.id));
  const list = col('giftLog').list().filter((r) => ids.has(r.gift)).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  return `<div class="card"><div class="table-wrap"><table class="grid gift-log"><thead><tr><th>날짜</th><th>물품</th><th>입고/지급</th><th>누구에게</th><th>왜</th><th>기록한 분</th></tr></thead><tbody>${logRows(list) || '<tr><td colspan="6" class="muted">기록이 없어요.</td></tr>'}</tbody></table></div></div>`;
}
function history(g) {
  const base = col('giftStock').get(g.id);
  const list = col('giftLog').list().filter((r) => r.gift === g.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return openModal(`<h2>${esc(g.name)} 기록</h2><p>지금 재고 <b>${stockOf(g.id)}${esc(g.unit || '개')}</b>
    <span class="small muted">= 기준 ${Number(base?.qty) || 0}${base?.at ? ` (${esc(base.at.slice(0, 10))}에 정함)` : ''} + 그 뒤 기록 합계</span></p>
    <div class="table-wrap"><table class="grid"><thead><tr><th>날짜</th><th>물품</th><th>입고/지급</th><th>누구에게</th><th>왜</th><th>기록한 분</th></tr></thead><tbody>${logRows(list)}</tbody></table></div>
    <div class="row end"><button class="btn primary" data-close type="button">닫기</button></div>`);
}
