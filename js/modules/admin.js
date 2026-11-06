// 관리 (관리자만): 사람·접속 코드 · 공개 페이지 · 메뉴 보이기 · 데이터(백업·불러오기·가져오기·다시 맞추기)
// 사람·코드·막기는 access 의 관리자 손잡이(openAdmin)와 access-ui 의 peopleTable 을 그대로 쓴다.
import { core } from '../store.js';
import { col, who, moduleTrash, menuCfg, fileBlob, upload, putMany, newId } from './ctx.js';
import { $, esc, toast, formModal, guard, head, empty, today, uploadFile, hydrate, imgTag, askTrash, pickFile } from './kit.js';
import { download } from '../ui.js';
import { access, ROLE_NAME, ROLE_IDS, CONFIG } from './site-access.js';
import { MENUS, menuMin, DATA_COLS, tierFor } from './menus.js';
import { peopleTable, invitationCard } from '../core/access-ui.js';
import { TOKEN_HELP } from '../gate.js';

const ymd = () => today().replace(/-/g, '');

// 관리자 손잡이 (app.js 가 관리자로 들어올 때 access.openAdmin(core) 로 만든다)
let adminHandle = null;
export const setAdminHandle = (h) => { adminHandle = h; };
export const getAdminHandle = () => adminHandle;

export async function renderAdmin(el, sub) {
  const tabs = [['people', '사람·접속 코드'], ['pages', '공개 페이지'], ['menus', '메뉴 보이기'], ['data', '데이터']];
  const cur = tabs.some(([k]) => k === sub) ? sub : 'people';
  el.innerHTML = head('관리', '관리자만 보여요.') + `<nav class="subnav">${tabs.map(([k, t]) => `<a href="#/admin/${k}" class="${k === cur ? 'on' : ''}">${t}</a>`).join('')}</nav><div id="adm"></div>`;
  const box = $('#adm', el);
  if (cur === 'people') return people(box);
  if (cur === 'pages') return pages(box);
  if (cur === 'menus') return menus(box);
  return data(box);
}

// ---------- 사람 · 접속 코드 ----------

async function people(box) {
  if (adminHandle) {
    box.innerHTML = `<div class="card"><p class="small muted">한 사람에 하나씩 <b>접속 코드</b>를 만들어 보내요. 역할은 코드가 정해요 (로그인 화면에서 고르지 않아요).
      직분(부장·부감·총무·회계·서기)은 «역할»에서 «임원 · 직분»으로 고르세요. «회계» 직분이면 회계 메뉴가 보여요.</p>
      <p class="small muted">선생님들이 바랐던 <b>생일로 로그인</b>은 하지 않아요: 생일은 1년에 366가지뿐이라, 공개 저장소의 자물쇠를 집에서 몇 분 만에 맞혀 볼 수 있어요.
      생일은 명단의 «생일» 칸에 넣으면 생일 목록에 나와요.</p></div><div id="ppl" class="card"></div>`;
    const t = peopleTable({ admin: adminHandle, access });
    $('#ppl', box).append(t);
    await t.ready;
    return;
  }
  // 관리자 코드 없이(사이트 비밀번호로) 들어온 경우: 처음 설정 또는 명단 복구
  let ring = null;
  try { ring = await access.keyring(); } catch (e) { console.warn(e); }
  if (!ring) {
    box.innerHTML = `<section class="card set" id="acc-setup"><h3>접속 코드 처음 준비 (한 번만)</h3>
      <p class="small muted">학부모·선생님·임원이 <b>아이디 + 접속 코드</b>로 들어오려면 공개 사이트 저장소(jayangchild.github.io)에 쓸 <b>토큰</b>이 필요해요.
        토큰(fine-grained)에 <b>jayangchild.github.io</b> 와 파일 저장소(<b>jayangchild-files-1</b>…)의 Contents 쓰기를 주고, 새 파일 저장소를 만들려면 Administration 쓰기도 주세요.
        그다음 관리자도 <b>아이디 + 관리자 코드</b>로 들어와요 (사이트 비밀번호는 처음 설정·복구에만).</p>
      <form id="acc-f" class="stack narrow" autocomplete="off">
        <input type="password" name="token" placeholder="공개 저장소 쓰기 토큰 (github_pat_…)" required>
        <input type="text" name="name" placeholder="내 이름" required value="${esc(core.status().user || '')}">
        <input type="text" name="identifier" placeholder="관리자 아이디 (예: yunyeon-admin)" required>
        <button class="btn primary" type="submit">준비하기</button><p class="err"></p></form>${TOKEN_HELP}</section>`;
    const f = $('#acc-f', box);
    f.onsubmit = (e) => {
      e.preventDefault();
      guard(f.querySelector('button'), async () => {
        const r = await access.setup(core, { token: f.token.value.trim(), name: f.name.value.trim(), identifier: f.identifier.value.trim() });
        adminHandle = r.admin;
        box.innerHTML = `<div class="card"><h3>관리자 접속 코드와 명단 복구 코드 — 꼭 보관하세요</h3>
          <div class="danger-box">이 두 코드는 지금 한 번만 보여요. <b>관리자 코드</b>로 다음부터 로그인하고, <b>명단 복구 코드</b>는 관리자 코드를 잃었을 때 사이트 비밀번호와 함께 써요. 종이에 적어 인수인계 봉투에 넣으세요.</div>
          <dl class="kv"><dt>관리자 아이디</dt><dd><b>${esc(f.identifier.value.trim())}</b></dd><dt>관리자 코드</dt><dd><span class="code-box inline" id="admin-code">${esc(r.code)}</span></dd>
          <dt>명단 복구 코드</dt><dd><span class="code-box inline" id="list-rc">${esc(r.recoveryCode)}</span></dd></dl>
          <a class="btn primary" href="#/admin/people">보관했어요. 사람 추가하러 가기</a></div>`;
        document.dispatchEvent(new CustomEvent('access-admin', { detail: access.me() }));
      })();
    };
    return;
  }
  box.innerHTML = `<section class="card set"><h3>관리자 코드를 잃었을 때</h3>
    <p class="small muted">사이트 비밀번호로 데이터 저장소를 열었어요. 접속 코드 명단을 다루려면 <b>관리자 아이디 + 코드로 로그인</b>하세요.
      관리자 코드를 잃었다면 처음 준비할 때 받은 <b>명단 복구 코드</b>를 넣고 내 코드를 새로 받으세요. 명단·다른 분들의 코드는 그대로예요.</p>
    <form id="rc-f" class="stack narrow" autocomplete="off"><input type="text" name="rc" placeholder="명단 복구 코드" required autocapitalize="characters">
      <button class="btn" type="submit">복구 코드로 명단 열기</button><p class="err"></p></form></section>`;
  const f = $('#rc-f', box);
  f.onsubmit = (e) => {
    e.preventDefault();
    guard(f.querySelector('button'), async () => {
      adminHandle = await access.recoverAdmin(core, f.rc.value);
      toast('명단을 열었어요. 내 줄의 «새 코드»를 눌러 관리자 코드를 새로 받으세요.', 6000);
      people(box);
    })();
  };
}

// ---------- 공개 페이지 ----------

async function pages(box) {
  const list = col('pages').list().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  box.innerHTML = `<div class="card"><div class="row"><h3 class="grow">공개 페이지 ${list.length}개</h3><button class="btn primary" type="button" data-act="add">+ 페이지</button></div>
    <p class="small muted">로그인하지 않은 누구나 보는 첫 화면이에요 (암호화하지 않아요). 아이 얼굴이 잘 보이는 사진·이름·연락처는 넣지 마세요. 저장하면 바로 올라가고, 공개 사이트에는 1~2분 뒤 보여요.</p>
    ${list.map((p) => `<article class="doc" data-id="${esc(p.id)}"><div class="row"><div class="grow"><b>${esc(p.title)}</b> <span class="small muted">순서 ${esc(p.order ?? 0)}</span> ${p.show === false ? '<span class="pill">숨김</span>' : '<span class="pill ok">보임</span>'}</div>
      <button class="btn small" data-act="edit" type="button">고치기</button><button class="btn small" data-act="photo" type="button">사진 더하기</button><button class="btn small ghost" data-act="del" type="button" aria-label="휴지통">🗑</button></div>
      <div class="doc-body">${esc(p.body || '')}</div><div class="pub-photos">${(p.photos || []).map((f) => imgTag(f, '', p.title)).join('')}</div></article>`).join('') || empty('아직 없어요. 기본 소개가 보이고 있어요.')}</div>`;
  hydrate(box);
  box.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.closest('[data-id]')?.dataset.id;
    const p = id ? col('pages').get(id) : null;
    await guard(b, async () => {
      if (b.dataset.act === 'add' || b.dataset.act === 'edit') {
        const v = await formModal(p ? '페이지 고치기' : '새 공개 페이지', [
          { name: 'title', label: '제목', required: true, placeholder: '예: 예배 시간·장소' },
          { name: 'body', label: '내용', type: 'textarea', rows: 8 },
          { name: 'order', label: '순서 (작을수록 위)', type: 'number' },
          { name: 'show', label: '공개 화면에 보이기', type: 'check' },
          ...(p ? [] : [{ name: 'files', label: '사진 (1~2장)', type: 'files', accept: 'image/*', hint: '줄이고 위치 정보를 뺀 뒤 올려요. 공개 사진은 암호화하지 않아요.' }]),
        ], p || { order: list.length + 1, show: true });
        if (!v) return;
        const { files, ...rest } = v;
        const photos = [...(p?.photos || [])];
        for (const f of files || []) photos.push((await uploadFile(f, { col: 'pages' })).id);
        await col('pages').put({ ...(p || {}), ...rest, photos });
      }
      if (b.dataset.act === 'photo') {
        const v = await formModal('사진 더하기', [{ name: 'files', label: '사진', type: 'files', accept: 'image/*', required: true }]);
        if (!v?.files?.length) return;
        const photos = [...(p.photos || [])];
        for (const f of v.files) photos.push((await uploadFile(f, { col: 'pages' })).id);
        await col('pages').patch(id, { photos });
      }
      if (b.dataset.act === 'del' && askTrash(p.title)) await col('pages').softDelete(id);
      pages(box);
    })();
  };
}

// ---------- 메뉴 보이기 ----------

// 메뉴 설정이 바뀌면 기록을 새 등급으로 옮긴다 (파일도 다시 올리고 예전 자리는 휴지통)
export async function moveToTiers(onStep = () => {}) {
  let n = 0;
  for (const c of DATA_COLS) {
    if (c === 'sys' || c === 'pages') continue;
    for (const r of col(c).list()) {
      if (r._tier === tierFor(c, r, menuCfg())) continue;
      await col(c).put(r);
      onStep(++n);
    }
  }
  return n;
}

function menus(box) {
  const cfg = menuCfg();
  box.innerHTML = `<div class="card"><h3>메뉴마다 어느 역할부터 보이나요</h3>
    <p class="small muted">위 역할은 아래 역할의 것을 모두 봐요 (관리자 ⊃ 임원 ⊃ 선생님 ⊃ 학부모 ⊃ 공개). 명단·생일·달란트는 부모님 연락처가 있어서 선생님보다 낮출 수 없어요.
      역할을 올리면 그 메뉴의 기록을 새 역할 열쇠로 다시 올려서, 아래 역할은 앞으로 그 내용을 볼 수 없어요 (이미 받아 둔 것은 그 기기에 남을 수 있어요).</p>
    <form id="mn-f"><div class="table-wrap"><table class="grid"><thead><tr><th>메뉴</th><th>보이는 역할</th></tr></thead><tbody>
    ${MENUS.filter((m) => m.key !== 'admin' && m.key !== 'pilsa').map((m) => `<tr><td>${m.icon} ${esc(m.name)}${m.label ? ` <span class="small muted">(직분 «${esc(m.label)}»과 관리자만)</span>` : ''}</td>
      <td><select name="${m.key}">${ROLE_IDS.slice(ROLE_IDS.indexOf(m.floor)).map((r) => `<option value="${r}" ${menuMin(m.key, cfg) === r ? 'selected' : ''}>${ROLE_NAME[r]}부터${r === 'admin' ? ' (숨김)' : ''}</option>`).join('')}</select></td></tr>`).join('')}
    </tbody></table></div><p class="small muted">필사노트는 데이터 저장소를 쓰므로 관리자만 보여요.</p>
    <div class="row end"><span id="mn-prog" class="small muted grow"></span><button class="btn primary" type="submit">저장</button></div></form></div>`;
  $('#mn-f', box).onsubmit = (e) => {
    e.preventDefault();
    guard(e.target.querySelector('button'), async () => {
      const out = { id: 'sys-menus' };
      for (const m of MENUS) if (e.target.elements[m.key]) out[m.key] = e.target.elements[m.key].value;
      await col('sys').put(out);
      const n = await moveToTiers((k) => { $('#mn-prog', box).textContent = `기록 옮기는 중… ${k}`; });
      toast(n ? `저장했어요. 기록 ${n}개를 새 역할로 옮겼어요.` : '저장했어요.', 5000);
      menus(box);
    })();
  };
}

// ---------- 데이터: 백업 · 불러오기 · 가져오기 ----------

const toDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
function dataURLBlob(url, name) {
  const [h, b] = String(url).split(',');
  const bin = atob(b || '');
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new File([u8], name || 'file', { type: h.match(/^data:([^;,]*)/)?.[1] || 'application/octet-stream' });
}
const filesOf = (r) => [r.photo, ...(r.photos || []), ...(r.files || []).map((f) => f?.id || f)].filter(Boolean);
const clean = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_')));

export async function moduleBackup({ withFiles = false } = {}) {
  const cols = {};
  for (const c of DATA_COLS) cols[c] = col(c).list().map(clean);
  const trash = moduleTrash().map(({ col: c, rec }) => ({ col: c, rec: clean(rec) }));
  const files = {};
  if (withFiles) {
    for (const list of Object.values(cols)) for (const r of list) for (const id of filesOf(r)) {
      if (files[id]) continue;
      try { const b = await fileBlob(id); files[id] = { name: (r.files || []).find((f) => f.id === id)?.name || id, data: await toDataURL(b) }; } catch {}
    }
  }
  return JSON.stringify({ kind: 'jayangchild-modules-backup', v: 2, at: new Date().toISOString(), by: who.name, cols, trash, files });
}

// 지금 데이터는 지우지 않는다: 같은 id 는 백업 내용으로, 없는 것은 더한다. 파일은 새로 올린다(새 id)
export async function moduleRestore(json, onStep = () => {}) {
  if (json?.kind !== 'jayangchild-modules-backup') throw new Error('유년부 데이터 백업 파일이 아니에요.');
  const count = {};
  const order = ['sys', ...DATA_COLS.filter((c) => c !== 'sys')];
  let n = 0;
  for (const c of order) {
    for (const r of json.cols?.[c] || []) {
      let rec = { ...r };
      const ids = filesOf(rec).filter((id) => json.files?.[id]);
      if (ids.length) {
        const map = new Map();
        for (const id of ids) map.set(id, (await upload(dataURLBlob(json.files[id].data, json.files[id].name), { col: c, rec, image: false })).id);
        const sw = (id) => map.get(id) || id;
        rec = { ...rec, ...(rec.photo ? { photo: sw(rec.photo) } : {}), ...(rec.photos ? { photos: rec.photos.map(sw) } : {}), ...(rec.files ? { files: rec.files.map((f) => (f?.id ? { ...f, id: sw(f.id) } : sw(f))) } : {}) };
      }
      await col(c).put(rec);
      count[c] = (count[c] || 0) + 1;
      onStep(++n);
    }
  }
  return count;
}

// 씨앗(seed) 가져오기: 가방이름표 CSV·전도용품 엑셀에서 만든 JSON. 이름·물품 이름이 같으면 더하지 않는다
export async function importSeed(json, onStep = () => {}) {
  if (json?.kind !== 'jayangchild-seed') throw new Error('가져오기 파일(jayangchild-seed)이 아니에요.');
  // 모두 모아서 공개 저장소 커밋 하나로 (access.publishMany). 예전에는 한 줄마다 커밋 하나였다
  const all = [];
  const M = col('members');
  const have = new Set([...M.list(), ...M.trash()].map((m) => m.seedKey || `${m.type || 'student'}:${m.name}`));
  let addM = 0;
  for (const m of json.members || []) {
    const key = m.seedKey || `${m.type}:${m.name}`;
    if (!m.name || have.has(key)) continue;
    have.add(key);
    all.push({ col: 'members', rec: { ...m, seedKey: key, type: m.type === 'teacher' ? 'teacher' : 'student' } });
    addM++;
  }
  const G = col('gifts');
  const gByName = new Map(G.list().map((g) => [g.name, g]));
  let addG = 0;
  for (const g of json.giftItems || []) {
    if (gByName.has(g.name)) continue;
    const rec = { id: newId(), name: g.name, type: g.type || '전도선물', unit: g.unit || '개', low: g.low ?? null, note: g.note || '', seedKey: g.seedKey };
    gByName.set(g.name, rec);
    all.push({ col: 'gifts', rec });
    addG++;
  }
  const L = col('giftLog');
  const seen = new Set(L.list().map((r) => r.seedKey).filter(Boolean));
  let addL = 0;
  for (const r of json.giftLog || []) {
    if (seen.has(r.seedKey)) continue;
    const g = gByName.get(r.gift);
    if (!g) continue;
    all.push({ col: 'giftLog', rec: { gift: g.id, qty: Number(r.qty) || 0, kind: r.qty < 0 ? 'out' : 'in', date: r.date, to: r.to || '', why: r.why || '', seedKey: r.seedKey } });
    addL++;
  }
  if (all.length) { onStep(`${all.length}개`); await putMany(all); }
  return { members: addM, giftItems: addG, giftLog: addL, skipped: (json.members || []).length - addM };
}

function data(box) {
  box.innerHTML = `<section class="card set"><h3>데이터 백업 받기</h3>
      <p class="small muted">명단·달란트·계획·주보·사진 목록·선물·정책·회의·회계·공개 페이지를 한 파일로 받아요. <b>암호화되지 않아요</b> — 관리자 PC 같은 안전한 곳에만 두세요.
        사람 명단·접속 코드는 들어가지 않아요 (데이터 저장소에 따로 잠겨 있고, 설정 → 암호화 백업에 들어가요).</p>
      <label class="check"><input type="checkbox" id="bk-files"> 사진·파일도 넣기 (파일이 커져요)</label>
      <div class="row"><button class="btn" type="button" data-d="backup">백업 받기</button><a class="btn ghost" href="#/settings">암호화 백업·필사노트 백업 (설정)</a></div></section>
    <section class="card set"><h3>백업 불러오기</h3>
      <p class="small muted">지금 있는 것은 지우지 않아요. 같은 항목은 백업 내용으로 바뀌고, 없는 것은 더해져요. 하나씩 올려서 시간이 걸려요.</p>
      <div class="row"><button class="btn" type="button" data-d="restore">백업 파일 고르기</button></div></section>
    <section class="card set"><h3>가져오기 (처음 명단·선물 재고)</h3>
      <p class="small muted">가방이름표 CSV·전도용품 엑셀에서 만든 <code>seed-*.json</code> 을 넣어요. 같은 이름·같은 물품은 두 번 넣지 않아요. 회계 금액은 가져오지 않아요.</p>
      <div class="row"><button class="btn primary" type="button" data-d="seed">가져오기 파일 고르기</button></div><p id="seed-res" class="small"></p></section>
    <section class="card set"><h3>휴지통 · 다시 맞추기</h3>
      <p class="small muted">지운 기록은 휴지통에 있어요. 올리다 끊겼다면 «다시 맞추기»로 명단·열쇠·목록을 다시 맞춰요 (데이터는 그대로).</p>
      <div class="row"><a class="btn" href="#/trash">휴지통</a><button class="btn" type="button" data-d="republish" ${adminHandle ? '' : 'disabled'}>다시 맞추기</button></div></section>`;
  box.onclick = async (e) => {
    const b = e.target.closest('[data-d]');
    if (!b) return;
    const res = $('#seed-res', box);
    await guard(b, async () => {
      if (b.dataset.d === 'backup') {
        if (!confirm('이 파일은 암호화되지 않아요 (아이 이름·연락처가 들어 있어요). 관리자 PC 같은 안전한 곳에만 보관하세요. 받을까요?')) return;
        download(`유년부_데이터백업_${ymd()}.json`, await moduleBackup({ withFiles: $('#bk-files', box).checked }));
        toast('백업 파일을 받았어요.');
      }
      if (b.dataset.d === 'restore') {
        const f = await pickFile('.json,application/json');
        if (!f) return;
        const c = await moduleRestore(JSON.parse(await f.text()), (k) => { res.textContent = `불러오는 중… ${k}`; });
        res.textContent = '';
        toast(`불러왔어요: ${Object.entries(c).map(([k, n]) => `${k} ${n}`).join(', ') || '없음'}`, 6000);
      }
      if (b.dataset.d === 'seed') {
        const f = await pickFile('.json,application/json');
        if (!f) return;
        const r = await importSeed(JSON.parse(await f.text()), (k) => { res.textContent = `넣는 중… ${k}`; });
        res.textContent = `넣었어요: 학생·선생님 ${r.members}명, 선물 물품 ${r.giftItems}개, 선물 기록 ${r.giftLog}줄${r.skipped ? ` (이미 있어서 건너뛴 사람 ${r.skipped}명)` : ''}`;
        res.dataset.done = JSON.stringify(r);
        toast('가져왔어요.');
      }
      if (b.dataset.d === 'republish') {
        await adminHandle.republish();
        toast('다시 맞췄어요.');
      }
    })();
  };
}
