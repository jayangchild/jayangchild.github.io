// 휴지통 (모듈 기록). 지운 기록은 access 목록에서 '휴지통' 표시만 붙고 암호문·파일은 그대로라 언제든 되살린다.
// 필사노트(데이터 저장소)의 휴지통은 settings.js 의 renderTrash 가 그 아래에 그린다.
import { moduleTrash, restoreItem, isWriter, coreOpen } from './ctx.js';
import { esc, toast, guard } from './kit.js';
import { renderTrash as renderCoreTrash } from '../settings.js';

const NAME = {
  members: '명단', talentLog: '달란트 기록', plan: '연간계획', bulletins: '주보', albums: '앨범', videos: '영상', pages: '공개 페이지', sys: '설정',
  gifts: '선물 물품', giftTypes: '선물 종류', giftStock: '선물 기준 수량', giftLog: '선물 기록', policies: '정책', meetings: '임원회의 자료', accounting: '회계',
};
const when = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const label = (c, r) => r.name || r.title || (c === 'talentLog' || c === 'giftLog' ? `${r.date || ''} ${r.qty > 0 ? '+' : ''}${r.qty ?? ''} ${r.why || ''}` : '') || r.id;

export async function renderModuleTrash(el) {
  const list = isWriter() ? moduleTrash() : [];
  el.innerHTML = `<div class="card"><h2>휴지통</h2>
      <p class="muted">사이트에서 지운 것은 모두 여기로 와요. <b>저절로 없어지지 않고</b>, 되살리기를 누르면 원래 자리로 돌아가요.</p></div>
    <div class="card" id="mt">${list.map(({ col, rec }) => `<div class="trash-item" data-col="${esc(col)}" data-id="${esc(rec.id)}">
      <div class="grow"><b>${esc(NAME[col] || col)} · ${esc(label(col, rec))}</b><br><span class="small muted">${esc(when(rec.deletedAt))}에 휴지통으로 옮김</span></div>
      <button class="btn small" type="button" data-act="restore">되살리기</button></div>`).join('') || '<p class="muted">휴지통이 비어 있어요.</p>'}</div>
    <div id="core-trash"></div>`;
  el.querySelector('#mt').onclick = async (e) => {
    const b = e.target.closest('[data-act=restore]');
    if (!b) return;
    const it = b.closest('.trash-item');
    await guard(b, async () => { await restoreItem(it.dataset.col, it.dataset.id); toast('되살렸어요.'); renderModuleTrash(el); })();
  };
  if (coreOpen()) {
    const box = el.querySelector('#core-trash');
    await renderCoreTrash(box);
    box.querySelector('h2').textContent = '휴지통 — 필사노트';
  }
}
