// 글 + 첨부 파일 목록 (주보 · 정책 · 임원회의 자료 · 회계). 모양은 같고 설정만 다르다.
//   기록 { date, title, kind?, body?, files: [{ id, name, type, size }] }
// 파일은 기록과 같은 등급으로 암호화해 파일 저장소에 올린다 (PDF·엑셀은 줄이지 않음, 95MB까지).
import { col, isWriter } from './ctx.js';
import { $, esc, toast, formModal, guard, head, readOnlyNote, empty, fmtDate, askTrash, uploadFile, today } from './kit.js';
import { fileChips, handleFileClick, isPDF, viewFile } from './files-view.js';
import { nextSunday } from '../ui.js';

export const DOCS = {
  bulletin: {
    col: 'bulletins', title: '주보', desc: '주일마다 주보 PDF. «보기»를 누르면 이 화면에서 보고, «받기»로 내려받아요.',
    add: '+ 이번 주 주보 올리기', accept: 'application/pdf,.pdf', defaults: () => { const d = nextSunday(); return { date: d, title: `${+d.slice(5, 7)}월 ${+d.slice(8)}일 주보` }; },
    fields: [{ name: 'date', label: '주일', type: 'date', required: true }, { name: 'title', label: '제목', required: true }],
    needFile: true, single: true,
  },
  policy: {
    col: 'policies', title: '정책', desc: '유년부 운영 정책과 임원회에서 정한 것. 임원만 보여요.',
    add: '+ 정책·결정 추가', accept: '.pdf,.doc,.docx,.hwp,.hwpx,.xlsx,.xls,image/*',
    fields: [
      { name: 'kind', label: '종류', type: 'select', options: [['정책', '정책 (계속 지키는 것)'], ['결정', '결정 (임원회에서 정한 것)']] },
      { name: 'title', label: '제목', required: true }, { name: 'date', label: '정한 날', type: 'date', required: true },
      { name: 'body', label: '내용', type: 'textarea', rows: 8 },
    ],
    defaults: () => ({ kind: '정책', date: today() }),
  },
  meetings: {
    col: 'meetings', title: '임원회의 자료', desc: '회의 날짜별 안건·회의록과 첨부 파일. 임원만 보여요.',
    add: '+ 회의 자료 추가', accept: '.pdf,.doc,.docx,.hwp,.hwpx,.xlsx,.xls,.pptx,image/*',
    fields: [{ name: 'date', label: '회의 날', type: 'date', required: true }, { name: 'title', label: '제목', required: true }, { name: 'body', label: '안건·회의록', type: 'textarea', rows: 8 }],
    defaults: () => ({ date: today(), title: '임원회의' }),
  },
  accounting: {
    col: 'accounting', title: '회계', desc: '회계 담당 임원과 관리자만 보여요. 결의서·정산 엑셀(xlsx)이나 PDF를 붙여 두는 곳이에요. (사이트가 숫자를 따로 계산하지는 않아요)',
    add: '+ 회계 파일 추가', accept: '.xlsx,.xls,.pdf,.csv',
    fields: [{ name: 'date', label: '날짜', type: 'date', required: true }, { name: 'title', label: '제목', required: true, placeholder: '예: 10월 지출·수입 결의서' }, { name: 'body', label: '메모', type: 'textarea', rows: 3 }],
    defaults: () => ({ date: today() }), needFile: true,
  },
};

export async function renderDocs(el, key) {
  const cfg = DOCS[key];
  const writer = isWriter();
  const list = col(cfg.col).list().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const latest = key === 'bulletin' ? list[0] : null;
  el.innerHTML = head(cfg.title, cfg.desc, writer ? `<button class="btn primary" type="button" data-act="add">${esc(cfg.add)}</button>` : '') + (writer ? '' : readOnlyNote()) +
    (latest ? `<div class="card latest"><span class="pill special">가장 최근</span> <b>${esc(latest.title)}</b> <span class="muted small">${esc(fmtDate(latest.date, { year: true }))}</span>
      <div class="row">${(latest.files || []).filter(isPDF).slice(0, 1).map((f) => `<button class="btn primary" type="button" data-open="${esc(f.id)}" data-name="${esc(f.name)}">📄 바로 보기</button>`).join('')}</div></div>` : '') +
    `<div class="card doc-list">${list.length ? list.map((d) => `<article class="doc" data-id="${esc(d.id)}">
      <div class="row"><div class="grow">${d.kind ? `<span class="pill ${d.kind === '결정' ? 'special' : ''}">${esc(d.kind)}</span> ` : ''}<b>${esc(d.title)}</b>
        <span class="small muted">${esc(fmtDate(d.date, { year: true }))}${d.createdBy ? ` · ${esc(d.createdBy)}` : ''}</span></div>
        ${writer ? '<button class="btn small" data-act="edit" type="button">고치기</button><button class="btn small" data-act="attach" type="button">파일 더하기</button><button class="btn small ghost" data-act="del" type="button" aria-label="휴지통">🗑</button>' : ''}</div>
      ${d.body ? `<div class="doc-body">${esc(d.body)}</div>` : ''}
      <div class="files">${fileChips(d.files)}</div></article>`).join('') : empty('아직 없어요.')}</div>`;
  el.onclick = async (e) => {
    if (handleFileClick(e)) return;
    const o = e.target.closest('[data-open]');
    if (o) return viewFile(o.dataset.open, o.dataset.name);
    const b = e.target.closest('[data-act]');
    if (!b || !writer) return;
    const id = b.closest('[data-id]')?.dataset.id;
    const d = id ? col(cfg.col).get(id) : null;
    await guard(b, async () => {
      if (b.dataset.act === 'del') { if (askTrash(d.title)) { await col(cfg.col).softDelete(id); toast('휴지통으로 옮겼어요. 붙은 파일도 함께 되살릴 수 있어요.'); renderDocs(el, key); } return; }
      if (b.dataset.act === 'attach') {
        const v = await formModal('파일 더하기', [{ name: 'files', label: '파일', type: 'files', accept: cfg.accept, required: true }]);
        if (!v?.files?.length) return;
        const add = await uploadAll(v.files, cfg.col, d);
        await col(cfg.col).patch(id, { files: [...(d.files || []), ...add] });
        toast(`파일 ${add.length}개를 붙였어요.`);
        return renderDocs(el, key);
      }
      const fileField = { name: 'files', label: d ? '파일 더하기 (있는 파일은 그대로)' : '파일', type: cfg.single ? 'file' : 'files', accept: cfg.accept, required: !d && cfg.needFile, hint: '8MB까지. 암호화해서 저장해요.' };
      const v = await formModal(d ? `${cfg.title} 고치기` : cfg.add.replace(/^\+ /, ''), [...cfg.fields, fileField], d || cfg.defaults?.() || {});
      if (!v) return;
      const picked = cfg.single ? (v.files ? [v.files] : []) : v.files || [];
      if (cfg.single && picked.length && !isPDF(picked[0])) throw new Error('PDF 파일만 올릴 수 있어요.');
      const { files, ...rest } = v;
      const add = await uploadAll(picked, cfg.col, { ...(d || {}), ...rest });
      await col(cfg.col).put({ ...(d || {}), ...rest, files: [...(d?.files || []), ...add] });
      toast('저장했어요.');
      renderDocs(el, key);
    })();
  };
}

async function uploadAll(files, colName, rec) {
  const out = [];
  for (const f of files) {
    const m = await uploadFile(f, { col: colName, rec, image: false });
    out.push({ id: m.id, name: f.name, type: m.type || f.type || '', size: m.size });
  }
  return out;
}
