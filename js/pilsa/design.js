// ③ 월별 디자인: 달마다 기본 그림 + 직접 올린 그림(PNG 등). 올린 그림은 자리 칸에 자동으로 맞춰 넣고, 끌어서 옮길 수 있다.
import { S, changed, addImage, deleteFile, fileURL } from '../store.js';
import { uid } from '../schemas.js';
import { $, toast, pickFile, MM, firstSundayOf } from '../ui.js';
import { THEMES, SLOTS } from './themes.js';
import { esc, monthOf, imageRect } from './sheet.js';
import { renderPreviews, designOf, rescale } from './preview.js';

function ensureDesign(m) {
  let d = S.data.items.themes.find((t) => t.id === `m${m}`);
  if (!d) { d = { id: `m${m}`, hideBuiltin: false, images: [] }; S.data.items.themes.push(d); }
  d.images ||= [];
  return d;
}

function sampleFor(m) {
  const real = S.data.items.lessons.filter((v) => monthOf(v) === m).sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0];
  if (real) return real;
  const y = new Date().getFullYear();
  return { id: 'sample', kind: 'lesson', no: 1, date: firstSundayOf(y, m), ref: '시편 119:105', lines: ['주의 말씀은 내 발에 등이요', '내 길에 빛이니이다'] };
}

let sel = null; // 고른 그림 id

export async function renderDesign(box, q) {
  let m = +(q.get('month') || 0);
  if (!(m >= 1 && m <= 12)) m = new Date().getMonth() + 1;
  box.innerHTML = `
    <div class="card">
      <h2>월별 디자인</h2>
      <p class="muted">달을 고르면 그 달의 필사지 모양이 보여요. 그림은 여백과 모서리에만 들어가서 따라 쓰기 글자를 가리지 않아요.</p>
      <div class="months">${Object.entries(THEMES).map(([k, t]) => `<button type="button" data-m="${k}" class="${+k === m ? 'on' : ''}" style="background:${t.colors.accent}">${k}월</button>`).join('')}</div>
    </div>
    <div class="design">
      <div class="card sticky-side"><div id="d-preview" class="designing"></div></div>
      <div class="card" id="d-side"></div>
    </div>`;
  box.querySelector('.months').onclick = (e) => {
    const b = e.target.closest('[data-m]');
    if (b) location.hash = `#/pilsa/make/design?month=${b.dataset.m}`;
  };
  await drawPreview(box, m);
  drawSide(box, m);
}

async function drawPreview(box, m) {
  const pv = $('#d-preview', box);
  const s = await renderPreviews(pv, [sampleFor(m)], { max: 0.95, fitHeight: true });
  bindDrag(box, pv, m, s);
  markSel(box);
  onresize = () => { if (pv.isConnected) bindDrag(box, pv, m, rescale(pv, 0.95, true)); };
}

function markSel(box) {
  box.querySelectorAll('.deco.up').forEach((el) => el.classList.toggle('sel', el.dataset.img === sel));
  box.querySelectorAll('.img-item').forEach((el) => el.classList.toggle('sel', el.dataset.img === sel));
}

// 미리보기에서 그림 끌기
function bindDrag(box, pv, m, s) {
  pv.onpointerdown = (e) => {
    const el = e.target.closest('.deco.up');
    if (!el) return;
    e.preventDefault();
    const d = ensureDesign(m);
    const im = d.images.find((x) => x.id === el.dataset.img);
    if (!im) return;
    sel = im.id;
    markSel(box);
    const meta = S.data.items.files.find((f) => f.id === im.file);
    const start = { x: e.clientX, y: e.clientY, dx: im.dx || 0, dy: im.dy || 0 };
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      im.dx = start.dx + (ev.clientX - start.x) / (s * MM);
      im.dy = start.dy + (ev.clientY - start.y) / (s * MM);
      const r = imageRect(im, meta);
      el.style.left = r.x + 'mm';
      el.style.top = r.y + 'mm';
    };
    const up = async () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      // 여백 밖으로 끌었으면 멈춘 자리로 맞춘다
      const r = imageRect(im, meta);
      const base = imageRect({ ...im, dx: 0, dy: 0 }, meta);
      im.dx = +(r.x - base.x).toFixed(2);
      im.dy = +(r.y - base.y).toFixed(2);
      await changed('themes');
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
}

async function drawSide(box, m) {
  const side = $('#d-side', box);
  const t = THEMES[m];
  const d = designOf(m);
  const files = Object.fromEntries(S.data.items.files.map((f) => [f.id, f]));
  const items = [];
  for (const im of d.images || []) items.push({ im, url: await fileURL(im.file), meta: files[im.file] });
  const slotOpts = (cur) => Object.entries(SLOTS).map(([k, s]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${s.name}</option>`).join('');
  side.innerHTML = `
    <h3>${esc(t.name)}</h3>
    <label class="row"><input type="checkbox" id="d-builtin" ${d.hideBuiltin ? '' : 'checked'}> 기본 그림 보이기</label>
    <p class="hint">그림을 올린 자리의 기본 그림은 자동으로 빠져요.</p>
    <hr style="border:0;border-top:1px solid var(--line);margin:12px 0">
    <h3>그림 올리기</h3>
    <p class="small muted">Canva 등에서 만든 PNG 그림(배경이 투명하면 가장 좋아요)을 올리면 고른 자리에 크기를 맞춰 넣어요. 그림은 암호화되어 저장되고 다른 선생님 기기에도 보여요.</p>
    <div class="row"><select id="d-slot">${slotOpts('bl')}</select><button class="btn primary" id="d-upload" type="button">그림 고르기</button></div>
    <div class="img-list" style="margin-top:12px">${items.map(({ im, url, meta }) => `
      <div class="img-item" data-img="${esc(im.id)}">
        <img src="${esc(url)}" alt="">
        <div class="ctl">
          <div class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(meta?.name || '그림')}</div>
          <select data-f="slot">${slotOpts(im.slot)}</select>
          <label class="small">크기 <input type="range" data-f="scale" min="0.3" max="2" step="0.05" value="${im.scale || 1}"></label>
          <div class="row"><button class="btn small" data-act="reset" type="button">제자리로</button><button class="btn small danger" data-act="del" type="button">지우기</button></div>
        </div>
      </div>`).join('') || '<p class="small muted">올린 그림이 없어요.</p>'}</div>
    ${items.length ? '<p class="hint">미리보기에서 그림을 끌어 옮길 수 있어요. 따라 쓰기 칸 위로는 가지 않아요.</p>' : ''}`;

  $('#d-builtin', side).onchange = async (e) => {
    ensureDesign(m).hideBuiltin = !e.target.checked;
    await changed('themes');
    await drawPreview(box, m);
  };
  $('#d-upload', side).onclick = async () => {
    const f = await pickFile('image/png,image/jpeg,image/webp,image/gif');
    if (!f) return;
    try {
      if (!/^image\//.test(f.type)) throw new Error('그림 파일(PNG, JPG)을 골라 주세요.');
      // 긴 변 1600px 로 줄이고 암호화해 저장 (A4 모서리에 쓰기에 충분). PNG 는 투명 배경 그대로
      const meta = await addImage(f);
      if (!meta.w || !meta.h) {
        // GIF 처럼 줄이지 않는 그림은 크기를 여기서 잰다
        const size = await imageSize(f).catch(async (e) => { await deleteFile(meta.id); throw e; });
        Object.assign(S.data.items.files.find((x) => x.id === meta.id), size);
        await changed('files');
      }
      const im = { id: uid(), file: meta.id, slot: $('#d-slot', side).value, dx: 0, dy: 0, scale: 1 };
      ensureDesign(m).images.push(im);
      sel = im.id;
      await changed('themes');
      toast('그림을 넣었어요. 끌어서 옮길 수 있어요.');
      await drawPreview(box, m);
      drawSide(box, m);
    } catch (e) {
      toast(e.message || '그림을 읽지 못했어요.');
    }
  };
  const find = (el) => ensureDesign(m).images.find((x) => x.id === el.closest('.img-item').dataset.img);
  side.onclick = async (e) => {
    const it = e.target.closest('.img-item');
    if (it && !e.target.closest('[data-act]')) { sel = it.dataset.img; markSel(box); }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const im = find(b);
    if (b.dataset.act === 'reset') { im.dx = 0; im.dy = 0; im.scale = 1; }
    else if (b.dataset.act === 'del') {
      if (!confirm('이 그림을 이 달 디자인에서 뺄까요?\n(그림은 휴지통에 남아서 되살릴 수 있어요)')) return;
      const d2 = ensureDesign(m);
      d2.images = d2.images.filter((x) => x !== im);
      // 다른 달에서도 안 쓰면 그림 파일도 휴지통으로 (되살리면 이 달 이 자리로 돌아온다)
      if (!S.data.items.themes.some((t2) => (t2.images || []).some((x) => x.file === im.file))) {
        await deleteFile(im.file, { month: m, ...im });
      }
    }
    await changed('themes');
    await drawPreview(box, m);
    drawSide(box, m);
  };
  side.oninput = async (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    const im = find(e.target);
    sel = im.id;
    if (f === 'scale') {
      im.scale = +e.target.value;
      const el = box.querySelector(`.deco.up[data-img="${CSS.escape(im.id)}"]`);
      if (el) {
        const r = imageRect(im, S.data.items.files.find((x) => x.id === im.file));
        Object.assign(el.style, { left: r.x + 'mm', top: r.y + 'mm', width: r.w + 'mm', height: r.h + 'mm' });
      }
    }
  };
  side.onchange = async (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    const im = find(e.target);
    if (f === 'slot') { im.slot = e.target.value; im.dx = 0; im.dy = 0; }
    await changed('themes');
    await drawPreview(box, m);
  };
}

// 그림의 가로·세로 크기
function imageSize(file) {
  const url = URL.createObjectURL(file);
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => (i.naturalWidth && i.naturalHeight ? res({ w: i.naturalWidth, h: i.naturalHeight }) : rej(new Error('그림 크기를 알 수 없어요.')));
    i.onerror = () => rej(new Error('그림을 열지 못했어요.'));
    i.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}
