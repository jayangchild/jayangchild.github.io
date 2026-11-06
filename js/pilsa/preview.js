// 필사지 미리보기: 저장된 디자인·그림을 모아 장을 그리고, 화면 폭에 맞게 줄여 보여준다
import { S, fileURL } from '../store.js';
import { pageHTML, fitAll, monthOf, esc } from './sheet.js';
import { fitScale } from '../ui.js';

export const designOf = (m) => S.data.items.themes.find((t) => t.id === `m${m}`) || { id: `m${m}`, hideBuiltin: false, images: [] };

// 장마다 필요한 디자인·그림 주소
export async function sheetCtx(month) {
  const design = designOf(month);
  const files = Object.fromEntries(S.data.items.files.map((f) => [f.id, f]));
  const urls = {};
  for (const im of design.images || []) urls[im.file] = await fileURL(im.file);
  return { design, files, urls };
}

export async function pagesHTML(lessons) {
  const out = [];
  const cache = {};
  for (const v of lessons) {
    const m = monthOf(v);
    cache[m] ||= await sheetCtx(m);
    out.push(pageHTML(v, cache[m]));
  }
  return out;
}

// box 안에 미리보기 목록을 그린다. bar(v) = 각 장 아래의 버튼 HTML
export async function renderPreviews(box, lessons, { bar, max = 0.9, fitHeight = false } = {}) {
  const pages = await pagesHTML(lessons);
  const s = fitScale(box, max, fitHeight);
  box.innerHTML = `<div class="pv-list">${pages.map((p, i) => `<div class="pv-item" data-id="${esc(lessons[i].id)}"><div class="pv" style="--s:${s}">${p}</div>${bar ? `<div class="pv-bar">${bar(lessons[i])}</div>` : ''}</div>`).join('')}</div>`;
  await fitAll(box);
  return s;
}

// 화면 크기가 바뀌면 배율만 다시
export function rescale(box, max = 0.9, fitHeight = false) {
  const s = fitScale(box, max, fitHeight);
  box.querySelectorAll('.pv').forEach((p) => p.style.setProperty('--s', s));
  return s;
}
