// 사진·영상
//   albums { title, date, vis: 'parent'|'teacher', photos: [파일 id], note }  — 사진은 이 기기에서 줄이고(긴 변 1600px) EXIF 를 뺀 뒤 암호화
//   videos { title, url (YouTube), date, vis }  — 링크만 (사이트 안에 동영상을 넣지 않는다)
import { col, isWriter, has } from './ctx.js';
import { $, esc, toast, formModal, guard, head, readOnlyNote, empty, fmtDate, askTrash, uploadFile, hydrate, imgTag, today, ytId, gone } from './kit.js';
import { openModal } from '../ui.js';
import { ROLE_NAME } from './site-access.js';

const VIS = [['parent', '학부모부터 (학부모·선생님·임원)'], ['teacher', '선생님부터 (선생님·임원)']];
const albumFields = [
  { name: 'title', label: '앨범 이름', required: true, placeholder: '예: 여름성경학교' },
  { name: 'date', label: '날짜', type: 'date', required: true },
  { name: 'vis', label: '누가 볼 수 있나요', type: 'select', options: VIS },
  { name: 'note', label: '설명', type: 'textarea', rows: 2 },
];

async function addPhotos(files, rec) {
  const ids = [];
  for (const f of files) {
    if (!/^image\//.test(f.type)) continue;
    ids.push((await uploadFile(f, { col: 'albums', rec })).id); // 줄이기 + EXIF 빼기 (core/image.js), 앨범과 같은 등급으로 암호화
  }
  return ids;
}

export async function renderMedia(el, q) {
  if (gone(el, 'photos')) return; // 그사이 다른 화면으로 갔으면 그리지 않는다
  const writer = isWriter();
  const albumId = q.get('a');
  if (albumId) return renderAlbum(el, q, albumId);
  const albums = col('albums').list().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const videos = col('videos').list().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  el.innerHTML = head('사진·영상', '유년부 활동 사진과 영상 링크예요. 사진은 받은 분만 보시고 다른 곳에 올리지 말아 주세요.',
    writer ? '<button class="btn primary" type="button" data-act="album">+ 앨범</button><button class="btn" type="button" data-act="video">+ 영상 링크</button>' : '') +
    (writer || !has('parent') ? '' : readOnlyNote()) +
    `<h3 class="sec">사진</h3><div class="album-grid">${albums.map((a) => `<a class="album" href="#/photos?a=${esc(a.id)}" data-id="${esc(a.id)}">
      <div class="cover">${a.photos?.[0] ? imgTag(a.photos[0], '', a.title) : '<span class="ph">📷</span>'}</div>
      <div class="cap"><b>${esc(a.title)}</b><span class="small muted">${esc(fmtDate(a.date, { year: true }))} · ${a.photos?.length || 0}장${writer ? ` · ${esc(ROLE_NAME[a.vis || 'parent'])}부터` : ''}</span></div></a>`).join('') || empty('아직 앨범이 없어요.')}</div>
    <h3 class="sec">영상</h3><div class="card">${videos.map((v) => `<div class="video-row" data-id="${esc(v.id)}">
      <span class="yt">▶</span><div class="grow"><a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(v.title)}</b></a>
      <div class="small muted">${esc(fmtDate(v.date, { year: true }))}${ytId(v.url) ? ' · YouTube' : ''}${writer ? ` · ${esc(ROLE_NAME[v.vis || 'parent'])}부터` : ''}</div></div>
      ${writer ? '<button class="btn small ghost" data-act="vdel" type="button" aria-label="휴지통">🗑</button>' : ''}</div>`).join('') || empty('아직 영상이 없어요.')}</div>`;
  hydrate(el);
  el.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !writer) return;
    await guard(b, async () => {
      if (b.dataset.act === 'album') {
        const v = await formModal('새 앨범', [...albumFields, { name: 'files', label: '사진 (여러 장 고를 수 있어요)', type: 'files', accept: 'image/*', hint: '이 기기에서 줄이고 위치 정보(EXIF)를 뺀 뒤 올려요' }], { date: today(), vis: 'parent' });
        if (!v) return;
        const { files, ...rest } = v;
        toast('사진을 줄이는 중…', 8000);
        const photos = await addPhotos(files || [], rest);
        const a = await col('albums').put({ ...rest, photos });
        toast(`앨범을 만들었어요 (${photos.length}장).`);
        location.hash = `#/photos?a=${a.id}`;
      }
      if (b.dataset.act === 'video') {
        const v = await formModal('영상 링크', [
          { name: 'title', label: '제목', required: true }, { name: 'url', label: 'YouTube 주소', required: true, placeholder: 'https://youtu.be/…' },
          { name: 'date', label: '날짜', type: 'date', required: true }, { name: 'vis', label: '누가 볼 수 있나요', type: 'select', options: VIS },
        ], { date: today(), vis: 'parent' });
        if (!v) return;
        if (!/^https:\/\//.test(v.url)) throw new Error('https:// 로 시작하는 주소를 넣어 주세요.');
        await col('videos').put(v);
        toast('영상 링크를 넣었어요.');
        renderMedia(el, q);
      }
      if (b.dataset.act === 'vdel') {
        const id = b.closest('[data-id]').dataset.id;
        if (askTrash(col('videos').get(id).title)) { await col('videos').softDelete(id); renderMedia(el, q); }
      }
    })();
  };
}

async function renderAlbum(el, q, id) {
  if (gone(el, 'photos')) return; // 그사이 다른 화면으로 갔으면 그리지 않는다
  const writer = isWriter();
  const a = col('albums').get(id);
  if (!a) { el.innerHTML = `<div class="card">${empty('앨범을 찾을 수 없어요.')}<a class="btn" href="#/photos">← 사진·영상</a></div>`; return; }
  el.innerHTML = `<div class="card mod-head"><a class="btn small ghost" href="#/photos">← 사진·영상</a>
      <div class="row"><div class="grow"><h2>${esc(a.title)}</h2><p class="small muted">${esc(fmtDate(a.date, { year: true }))} · ${a.photos?.length || 0}장${writer ? ` · ${esc(ROLE_NAME[a.vis || 'parent'])}부터 보여요` : ''}</p>${a.note ? `<p>${esc(a.note)}</p>` : ''}</div>
      ${writer ? '<button class="btn primary" data-act="add" type="button">+ 사진</button><button class="btn" data-act="edit" type="button">고치기</button><button class="btn ghost" data-act="del" type="button">🗑 앨범</button>' : ''}</div></div>
    <div class="photo-grid">${(a.photos || []).map((p, i) => `<figure data-i="${i}">${imgTag(p, '', `${a.title} ${i + 1}`)}${writer ? '<button class="btn small ghost rm" data-act="rm" type="button" aria-label="이 사진 빼기">✕</button>' : ''}</figure>`).join('') || empty('사진이 없어요.')}</div>`;
  hydrate(el);
  el.onclick = async (e) => {
    const fig = e.target.closest('figure');
    const b = e.target.closest('[data-act]');
    if (fig && !b) {
      const img = fig.querySelector('img');
      return openModal(`<div class="lightbox"><img src="${esc(img.src)}" alt="${esc(img.alt)}"></div><div class="row end"><a class="btn" href="${esc(img.src)}" download="${esc(a.title)}-${+fig.dataset.i + 1}.jpg">내려받기</a><button class="btn primary" data-close type="button">닫기</button></div>`);
    }
    if (!b || !writer) return;
    await guard(b, async () => {
      if (b.dataset.act === 'add') {
        const v = await formModal('사진 더하기', [{ name: 'files', label: '사진', type: 'files', accept: 'image/*', required: true }]);
        if (!v?.files?.length) return;
        toast('사진을 줄이는 중…', 8000);
        const add = await addPhotos(v.files, a);
        await col('albums').patch(id, { photos: [...(a.photos || []), ...add] });
        toast(`${add.length}장을 더했어요.`);
      }
      if (b.dataset.act === 'edit') {
        const v = await formModal('앨범 고치기', albumFields, a);
        if (!v) return;
        await col('albums').patch(id, v);
      }
      if (b.dataset.act === 'rm') {
        if (!confirm('이 사진을 앨범에서 뺄까요?\n사진 파일은 지우지 않아요 (휴지통의 앨범 기록·GitHub 이력에 남아요).')) return;
        const i = +b.closest('figure').dataset.i;
        const photos = [...a.photos];
        const [gone] = photos.splice(i, 1);
        await col('albums').patch(id, { photos, removed: [...(a.removed || []), gone] });
      }
      if (b.dataset.act === 'del') {
        if (!askTrash(`앨범 «${a.title}»`)) return;
        await col('albums').softDelete(id);
        location.hash = '#/photos';
        return;
      }
      renderAlbum(el, q, id);
    })();
  };
}
