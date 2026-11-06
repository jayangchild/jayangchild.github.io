// 필사지 한 장 그리기. 승인된 디자인(pilsa/monthly.html)의 pageHTML·fitTrace 를 옮겼다.
// 바뀐 점: 색과 그림은 달마다의 디자인(themes.js) + 그 달에 올린 그림(PNG)으로 정한다. 특별한 장(성경학교)은 제목을 따로 쓴다.

import { THEMES, SLOTS, ZONES } from './themes.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export function dateLabel(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return `${y}. ${m}. ${d} ${wd === 0 ? '주일' : WEEK[wd] + '요일'}`;
}

// 이 장의 디자인 달 (특별한 장은 직접 고른 달, 아니면 날짜의 달)
export function monthOf(lesson) {
  if (lesson.month) return +lesson.month;
  if (lesson.date) return +lesson.date.split('-')[1];
  return 1;
}

export const titleOf = (lesson) => (lesson.kind === 'special' ? lesson.title || '말씀 필사' : `${lesson.no}과 달달말씀 필사`);

// 올린 그림의 자리 (mm): 칸 안에 비율을 지키며 맞추고(contain), 옮긴 만큼(dx, dy) 더한 뒤, 여백 밖으로 나가지 않게 한다
export function imageRect(img, meta) {
  const s = SLOTS[img.slot] || SLOTS.bl;
  const z = ZONES[img.slot] || ZONES.bl;
  const ar = meta?.w && meta?.h ? meta.w / meta.h : 1;
  let w = Math.min(s.w, s.h * ar) * (img.scale || 1);
  let h = w / ar;
  const fit = Math.min(1, (z.x1 - z.x0) / w, (z.y1 - z.y0) / h);
  w *= fit; h *= fit;
  let x = s.x + (s.w - w) * s.ax + (img.dx || 0);
  let y = s.y + (s.h - h) * s.ay + (img.dy || 0);
  x = Math.min(Math.max(x, z.x0), z.x1 - w);
  y = Math.min(Math.max(y, z.y0), z.y1 - h);
  return { x, y, w, h };
}

const place = (html, x, y, w, rot = 0, op = 1) =>
  `<div class="deco" style="left:${x}mm;top:${y}mm;width:${w}mm;transform:rotate(${rot}deg);opacity:${op}">${html}</div>`;

// ctx = { design: {hideBuiltin, images}, files: {id: meta}, urls: {id: blob주소} }
export function pageHTML(v, ctx = {}) {
  const month = monthOf(v);
  const t = THEMES[month] || THEMES[1];
  const c = t.colors;
  const design = ctx.design || {};
  const imgs = (design.images || []).filter((im) => ctx.urls?.[im.file]);
  const used = new Set(imgs.map((im) => im.slot));
  const builtins = design.hideBuiltin ? [] : t.deco.filter((dd) => !used.has(dd.slot));
  const deco = builtins.map((dd) => place(dd.art, dd.x, dd.y, dd.w, dd.rot, dd.op)).join('')
    + imgs.map((im) => {
      const r = imageRect(im, ctx.files?.[im.file]);
      return `<div class="deco up" data-img="${esc(im.id)}" style="left:${r.x}mm;top:${r.y}mm;width:${r.w}mm;height:${r.h}mm"><img src="${esc(ctx.urls[im.file])}" alt=""></div>`;
    }).join('');
  const lines = (v.lines || []).filter((l) => String(l).trim());
  const block = (n) => `<div class="blk"><span class="no">${'①②③'[n]}</span>${lines.map((l) => `<div class="ln">${esc(l)}</div>`).join('')}</div>`;
  const style = `--frame:${c.frame};--accent:${c.accent};--accent-soft:${c.soft};--tab:${c.tab};--line:${c.line}`;
  const tab = v.tab || dateLabel(v.date);
  return `<section class="page" data-id="${esc(v.id)}" style="${style}">
    <div class="sheet"></div>
    ${tab ? `<div class="tab">${esc(tab)}</div>` : ''}
    <img class="logo" src="assets/logo.png" alt="자양교회 유년부">
    <div class="note">* 필사한 친구에게는 달란트가 지급되어요.</div>
    <table class="who"><tr><th>반</th><td></td></tr><tr><th>이름</th><td></td></tr><tr class="chk"><th>선생님<br>확인</th><td></td></tr></table>
    ${deco}
    <div class="content">
      <div class="title">${t.titleDeco.map(([a, x, y, w, r]) => `<div class="deco" style="${String(x).startsWith('R') ? `right:${x.slice(1)}mm` : `left:${x}mm`};top:${y}mm;width:${w}mm;transform:rotate(${r}deg)">${a}</div>`).join('')}<h1>${esc(titleOf(v))}</h1></div>
      <div class="verse">${lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>
      ${v.ref ? `<div class="ref">(${esc(v.ref)})</div>` : ''}
      <div class="trace">${block(0)}${block(1)}${block(2)}</div>
    </div>
  </section>`;
}

/* 따라 쓰기 글자 크기: 가장 긴 줄이 한 줄에 들어가고, 세 번이 세로로 들어가는 가장 큰 크기 (monthly.html 그대로) */
export function fitTrace(page) {
  const tr = page.querySelector('.trace');
  const lns = [...tr.querySelectorAll('.ln')];
  const n = lns.length / 3;
  if (!n) return;
  const ctx = document.createElement('canvas').getContext('2d');
  const W = tr.querySelector('.blk').clientWidth - 9 * 96 / 25.4 - 6;
  const H = tr.clientHeight;
  let px = 30;
  const longest = (p) => { ctx.font = `${p}px "Gowun Dodum"`; return Math.max(...lns.slice(0, n).map((l) => ctx.measureText(l.textContent).width)); };
  while (px > 12 && (longest(px) > W || 3 * n * px * 1.95 + 3 * 8 > H)) px -= 0.5;
  lns.forEach((l) => { l.style.fontSize = px + 'px'; l.style.height = (px * 1.95) + 'px'; l.style.paddingBottom = (px * 0.28) + 'px'; });
}

// 글꼴을 다 받은 뒤 크기를 맞춘다
export async function fitAll(root) {
  const pages = [...root.querySelectorAll('.page')];
  const text = pages.map((p) => p.textContent).join('');
  try {
    await document.fonts.load('20px "Gowun Dodum"', text || '가');
    await document.fonts.load('20px "Jua"', '0123456789과달말씀필사주일.' + pages.map((p) => p.querySelector('h1')?.textContent || '').join(''));
    await document.fonts.ready;
  } catch {}
  pages.forEach(fitTrace);
}
