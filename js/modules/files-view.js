// 파일 보기·내려받기 (주보 PDF, 임원회의 자료, 회계 파일). PDF 는 이 화면 안에서 보고, 나머지는 내려받는다.
import { esc, toast } from './kit.js';
import { openModal } from '../ui.js';
import { fileBlob } from './ctx.js';

const urls = new Map();
async function blobURL(id) {
  if (urls.has(id)) return urls.get(id);
  const u = URL.createObjectURL(await fileBlob(id));
  urls.set(id, u);
  return u;
}
export const isPDF = (f) => /pdf$/i.test(f?.type || '') || /\.pdf$/i.test(f?.name || '');
export const fileIcon = (f) => (isPDF(f) ? '📄' : /\.(xlsx?|csv)$/i.test(f?.name || '') ? '📊' : /^image\//.test(f?.type || '') ? '🖼️' : '📎');
export const sizeText = (n) => (!n ? '' : n > 1e6 ? `${(n / 1e6).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1e3))}KB`);

export async function downloadFile(id, name) {
  try {
    const a = Object.assign(document.createElement('a'), { href: await blobURL(id), download: name || '파일' });
    document.body.append(a);
    a.click();
    a.remove();
  } catch (e) { toast(e.message || '받지 못했어요.'); }
}

export async function viewFile(id, name, title = '') {
  let u;
  try { u = await blobURL(id); } catch (e) { toast(e.message || '받지 못했어요.'); return; }
  await openModal(`<div class="row"><h2 class="grow">${esc(title || name || '파일')}</h2>
      <a class="btn" href="${esc(u)}" download="${esc(name || 'file.pdf')}">내려받기</a>
      <a class="btn" href="${esc(u)}" target="_blank" rel="noopener">새 창에서 보기</a>
      <button class="btn primary" data-close type="button">닫기</button></div>
    <iframe class="pdf-frame" src="${esc(u)}" title="${esc(name || 'PDF')}"></iframe>
    <p class="small muted">휴대폰에서 안 보이면 «새 창에서 보기»나 «내려받기»를 누르세요.</p>`);
}

// 파일 목록 한 줄 (files: [{ id, name, type, size }])
export const fileChips = (files = []) => files.map((f) => `<span class="file-chip" data-file-id="${esc(f.id)}" data-name="${esc(f.name || '')}">
  ${fileIcon(f)} <span class="fname">${esc(f.name || '파일')}</span> <span class="small muted">${sizeText(f.size)}</span>
  ${isPDF(f) ? '<button class="btn small" type="button" data-fv="view">보기</button>' : ''}<button class="btn small" type="button" data-fv="down">받기</button></span>`).join('');

// 목록 화면의 onclick 에 붙인다
export function handleFileClick(e) {
  const b = e.target.closest('[data-fv]');
  if (!b) return false;
  const chip = b.closest('[data-file-id]');
  if (b.dataset.fv === 'view') viewFile(chip.dataset.fileId, chip.dataset.name);
  else downloadFile(chip.dataset.fileId, chip.dataset.name);
  return true;
}
