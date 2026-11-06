// 데이터 저장소 — 모든 데이터는 core(js/core)를 거쳐 암호화되어 이 기기와 비공개 GitHub 저장소(jayangchild-data)에 저장된다.
//
// 화면 코드(pilsa/*.js)는 예전처럼 쓴다:
//   - S.data.items.<목록> 을 읽고 고친 뒤 changed('<목록>') 을 부른다. S.data.sys 를 고쳤으면 changedSys().
//   - 목록에서 항목을 빼면(filter) 휴지통으로 간다. 진짜로 지우는 일은 없다.
// 여기서 하는 일:
//   - S.data.items 는 core 목록의 사본(화면용)이다. changed() 는 "마지막으로 맞춘 내용(shadow)"과 비교해서
//     고친 항목(칸)만 core 에 넣는다. 그래서 그사이 다른 선생님이 같은 항목의 다른 칸을 고쳤어도 지워지지 않는다.
//   - 다른 기기에서 고친 것이 오면 사본을 그 자리에서 고친다(화면이 들고 있는 객체가 그대로 이어지게).
//     이 기기에서 고치고 아직 저장하지 않은 칸은 남겨 둔다.
//   - 예전(동기화 전) 이 기기에만 있던 데이터(IndexedDB 'jayangchild', 암호화 안 됨)는 처음 열 때 core 로 옮기고,
//     다 들어간 것을 확인한 뒤에만 지운다.
//
// core 목록: lessons · themes · files (화면 사본), sys (설정. 기록 'firstSunday' 의 칸 이름 = 학기, 값 = 첫 주일).
// giftLog 같은 다른 목록은 화면 모듈이 core.collection() 으로 바로 쓴다 (선물 재고 = 기준 수량 + giftLog 합계).

import core from './core/index.js';
import { same, contentOf } from './core/merge.js';
import { idbGet, idbKeys, idbDel } from './idb.js';
import { COLS, emptyData, uid } from './schemas.js';

export { core, COLS };

export const S = {
  data: null,
  status: 'locked', // core 상태: locked | saved | pending | syncing | offline | error
  error: '',
  onStatus: () => {},
  onRemote: () => {}, // (바뀐 목록들) 다른 기기에서 고친 것이 들어왔을 때
};

const shadow = new Map(); // 목록 → Map(id → 마지막으로 맞춘 내용)
const queues = new Map(); // 목록 → 저장 줄 (한 목록은 순서대로)
const SYS_ID = 'firstSunday';
const clone = (v) => (v == null ? v : structuredClone(v));

function queue(key, fn) {
  const prev = queues.get(key) || Promise.resolve();
  const next = prev.then(fn);
  queues.set(key, next.catch(() => {}));
  return next;
}

core.onStatus((s) => {
  S.status = s.state;
  S.error = s.error;
  S.onStatus(s);
});

core.onChange((ev) => {
  if (ev.source !== 'remote' || !S.data) return;
  const cols = ev.collections.filter((c) => COLS.includes(c) || c === 'sys');
  Promise.all(cols.map((c) => (c === 'sys' ? queue('sys', refreshSys) : changed(c))))
    .then(() => S.onRemote(ev.collections))
    .catch((e) => console.error(e));
});

// ---------- 열린 뒤 읽기 ----------

export async function load() {
  const data = emptyData();
  S.data = data;
  sysBase = {};
  for (const c of COLS) {
    shadow.set(c, new Map());
    refreshMirror(c);
  }
  refreshSys();
  return data;
}

// 잠글 때 화면 사본을 버린다 (core 에는 그대로 있다)
export function unload() {
  S.data = null;
  shadow.clear();
}

const changedKeys = (base, mine) => {
  const out = new Set();
  for (const k of new Set([...Object.keys(base), ...Object.keys(mine)])) if (!same(base[k], mine[k])) out.add(k);
  return out;
};

// core 의 지금 내용을 화면 사본에 넣는다. 아직 저장하지 않은 이 기기의 고친 칸은 남긴다
function refreshMirror(col) {
  if (!S.data) return;
  const c = core.collection(col);
  const sh = shadow.get(col);
  const list = S.data.items[col];
  const recs = new Map(c.list({ deleted: 'all' }).map((r) => [r.id, r]));
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (!item || item.id == null) continue;
    const id = String(item.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const rec = recs.get(id);
    const base = sh.get(id);
    if (!rec || !base) { out.push(item); continue; } // 이 기기에서 새로 만들어 아직 저장 전
    const pending = changedKeys(base, contentOf(item));
    if (rec.deletedAt && !pending.size) { sh.delete(id); continue; } // 휴지통으로 감
    for (const k of Object.keys(item)) if (!(k in rec) && !pending.has(k)) delete item[k];
    for (const k of Object.keys(rec)) if (!pending.has(k) && !same(item[k], rec[k])) item[k] = clone(rec[k]);
    sh.set(id, contentOf(rec));
    out.push(item);
  }
  for (const [id, rec] of recs) {
    if (seen.has(id) || rec.deletedAt) continue;
    out.push(clone(rec));
    sh.set(id, contentOf(rec));
  }
  list.length = 0;
  list.push(...out);
}

// 사본에서 고친 것을 core 에 넣는다 (고친 칸만, 지금 core 기록 위에)
async function flush(col) {
  if (!S.data) return;
  const c = core.collection(col);
  if (!Array.isArray(S.data.items[col])) S.data.items[col] = [];
  const list = S.data.items[col];
  const sh = shadow.get(col);
  const puts = [];
  const restores = [];
  const dels = [];
  const seen = new Set();
  for (const item of list) {
    if (!item) continue;
    if (item.id == null || item.id === '') item.id = uid();
    const id = String(item.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const mine = contentOf(item);
    const base = sh.get(id);
    if (base && same(base, mine)) continue;
    const cur = c.get(id);
    let next;
    if (!base || !cur) next = cur && !cur.deletedAt ? { ...contentOf(cur), ...mine } : { ...mine };
    else {
      next = contentOf(cur);
      for (const k of changedKeys(base, mine)) {
        if (mine[k] === undefined) delete next[k];
        else next[k] = mine[k];
      }
    }
    next.id = id;
    puts.push(next);
    if (cur?.deletedAt) restores.push(id); // 다른 기기에서 지운 것을 이 기기에서 고쳤다 → 남긴다
    sh.set(id, clone(mine));
  }
  for (const id of [...sh.keys()]) {
    if (seen.has(id)) continue;
    const cur = c.get(id);
    if (cur && !cur.deletedAt) dels.push(id); // 목록에서 뺐다 → 휴지통
    sh.delete(id);
  }
  if (puts.length) await c.putMany(puts);
  for (const id of restores) await c.restore(id);
  for (const id of dels) await c.softDelete(id);
  refreshMirror(col);
}

// 항목을 추가/수정/뺀 뒤 부른다
export const changed = (col) => queue(col, () => flush(col));

// ---------- 설정 (sys) ----------

let sysBase = {};

function refreshSys() {
  if (!S.data) return;
  const rec = core.collection('sys').get(SYS_ID);
  const now = rec && !rec.deletedAt ? contentOf(rec) : {};
  const fs = { ...(S.data.sys.firstSunday || {}) };
  for (const k of new Set([...Object.keys(now), ...Object.keys(sysBase)])) {
    if (!same(fs[k], sysBase[k])) continue; // 이 기기에서 고쳐 아직 저장 전
    if (now[k] === undefined) delete fs[k]; else fs[k] = now[k];
  }
  S.data.sys.firstSunday = fs;
  sysBase = now;
}

async function flushSys() {
  if (!S.data) return;
  const fs = S.data.sys.firstSunday || {};
  const ch = changedKeys(sysBase, fs);
  if (ch.size) {
    const c = core.collection('sys');
    const cur = c.get(SYS_ID);
    const next = cur ? contentOf(cur) : {};
    for (const k of ch) if (fs[k] === undefined) delete next[k]; else next[k] = fs[k];
    await c.put({ ...next, id: SYS_ID });
    if (cur?.deletedAt) await c.restore(SYS_ID);
  }
  refreshSys();
}

export const changedSys = () => queue('sys', flushSys);

// ---------- 그림 파일 ----------

// 새 그림: core 가 줄이고(긴 변 1600px, 사진 위치 정보 빼기) 암호화해 저장한다. 사본(files)에도 넣는다
export async function addImage(file, extra = {}) {
  const meta = await core.files.put(file, { name: file.name, extra });
  await queue('files', async () => {
    const list = S.data.items.files;
    if (!list.some((f) => f.id === meta.id)) list.push(clone(meta));
    shadow.get('files').set(meta.id, contentOf(meta));
  });
  return meta;
}

// id 를 정해서 그대로 저장 (백업 불러오기·예전 데이터 옮기기). 이미 있는 id 면 그대로 둔다
export async function putFile(id, blob, meta = {}) {
  return core.files.put(blob, { id, resize: false, name: meta.name, extra: meta });
}

export async function getFile(id) {
  try { return await core.files.get(id); } catch { return null; }
}

// 화면에 보일 주소 (blob:). 아직 못 받은 그림이면 ''
export async function fileURL(id) {
  try { return await core.files.url(id); } catch { return ''; }
}

// 그림을 휴지통으로. use = 어느 달 어디에 있었는지 (되살리면 그 자리로 돌려놓는다)
export async function deleteFile(id, use) {
  await changed('files');
  await queue('files', async () => {
    const c = core.collection('files');
    if (!c.get(id)) return;
    if (use) await c.patch(id, { lastUse: use });
    await c.softDelete(id);
    refreshMirror('files');
  });
}

// ---------- 휴지통 · 같은 때 고친 것 ----------

export const trash = (col) => core.collection(col).trash();
export const conflicts = (col) => core.collection(col).conflicts();

export async function restore(col, id) {
  const mirrored = COLS.includes(col);
  if (mirrored) await changed(col);
  const rec = await core.collection(col).restore(id);
  if (mirrored) await queue(col, () => refreshMirror(col));
  if (col === 'files' && rec.lastUse?.month) {
    // 그림이었으면 있던 달 디자인에 다시 넣는다
    const m = rec.lastUse.month;
    let d = S.data.items.themes.find((t) => t.id === `m${m}`);
    if (!d) { d = { id: `m${m}`, hideBuiltin: false, images: [] }; S.data.items.themes.push(d); }
    d.images ||= [];
    if (!d.images.some((x) => x.file === id)) {
      const { month, ...im } = rec.lastUse;
      d.images.push({ ...im, id: im.id || uid(), file: id });
      await changed('themes');
    }
  }
  if (col === 'sys') await queue('sys', refreshSys);
  return rec;
}

// 같은 때 고친 기록: 고른 값(fields)을 넣고 표시를 지운다. trashIt = 결국 휴지통으로
export async function resolveConflict(col, id, fields, { trashIt = false } = {}) {
  const mirrored = COLS.includes(col);
  if (mirrored) await changed(col);
  const c = core.collection(col);
  if (fields && Object.keys(fields).length) await c.patch(id, fields);
  await c.clearConflicts(id);
  if (trashIt) await c.softDelete(id);
  if (col === 'sys') await queue('sys', refreshSys);
  if (mirrored) await queue(col, () => refreshMirror(col));
}

// ---------- 예전 데이터 옮기기 (동기화 전 이 기기에만 있던 것) ----------

const LEGACY = /^(d:|b:|dirty$)/;

export async function legacyInfo() {
  let keys = [];
  try { keys = (await idbKeys()).filter((k) => typeof k === 'string' && LEGACY.test(k)); } catch {}
  if (!keys.length) return null;
  let items = 0;
  for (const c of COLS) items += ((await idbGet(`d:${c}`)) || []).length;
  return { keys, items, files: keys.filter((k) => k.startsWith('b:')).length };
}

const sig = (r) => JSON.stringify([r.kind || 'lesson', r.term || '', r.no ?? null, r.title || '', r.date || '', r.ref || '', r.lines || []]);

// 예전 데이터를 core 에 넣고(putMany), 다 들어갔는지 확인한 뒤에만 예전 사본을 지운다.
// 아무것도 버리지 않는다: 같은 id 인데 내용이 다르면 새 id 로 하나 더 넣고(말씀), 그림은 합친다(디자인).
export async function migrateLegacy() {
  const info = await legacyInfo();
  if (!info) return null;
  const old = { sys: (await idbGet('d:sys')) || {} };
  for (const c of COLS) old[c] = ((await idbGet(`d:${c}`)) || []).filter((x) => x && x.id != null);
  const fileMeta = new Map(old.files.map((f) => [String(f.id), f]));
  const count = { lessons: 0, themes: 0, files: 0, terms: 0 };
  const expectLessons = [];
  const expectFiles = [];

  // 1. 그림 파일 (같은 id 로)
  for (const k of info.keys.filter((x) => x.startsWith('b:'))) {
    const id = k.slice(2);
    const blob = await idbGet(k);
    if (!(blob instanceof Blob)) continue;
    const m = fileMeta.get(id) || {};
    await putFile(id, blob, { name: m.name || '', w: m.w || 0, h: m.h || 0 });
    expectFiles.push(id);
    count.files++;
  }
  const F = core.collection('files');
  const fput = [];
  for (const f of old.files) {
    const cur = F.get(String(f.id));
    if (cur) fput.push({ ...contentOf(cur), ...contentOf(f), id: String(f.id) }); // 그림이 없던 정보는 넣지 않는다
  }
  if (fput.length) await F.putMany(fput);

  // 2. 말씀
  const L = core.collection('lessons');
  const have = new Set(L.list({ deleted: 'all' }).map(sig));
  const lput = [];
  for (const v of old.lessons) {
    const id = String(v.id);
    const cur = L.get(id);
    const body = contentOf(v);
    if (cur && same(contentOf(cur), body)) { expectLessons.push(id); continue; }
    if (!cur && have.has(sig(v))) continue; // 같은 말씀이 이미 있음 (다른 기기에서 먼저 옮김)
    const nid = cur ? uid() : id; // 같은 id 에 다른 내용 → 둘 다 남긴다
    lput.push({ ...body, id: nid });
    expectLessons.push(nid);
    have.add(sig(v));
    count.lessons++;
  }
  if (lput.length) await L.putMany(lput);

  // 3. 월별 디자인: 그림은 합친다, 나머지는 이미 있는 것 그대로
  const T = core.collection('themes');
  const tput = [];
  for (const t of old.themes) {
    const id = String(t.id);
    const cur = T.get(id);
    if (!cur) { tput.push({ ...contentOf(t), id }); count.themes++; continue; }
    const imgs = [...(cur.images || [])];
    let add = 0;
    for (const im of t.images || []) if (!imgs.some((x) => x.id === im.id || x.file === im.file)) { imgs.push(im); add++; }
    if (add) { tput.push({ ...contentOf(cur), images: imgs, id }); count.themes++; }
  }
  if (tput.length) await T.putMany(tput);

  // 4. 학기 첫 주일: 없는 학기만
  const Y = core.collection('sys');
  const cur = Y.get(SYS_ID);
  const fs = cur ? contentOf(cur) : {};
  for (const [k, v] of Object.entries(old.sys.firstSunday || {})) if (fs[k] === undefined) { fs[k] = v; count.terms++; }
  if (count.terms) await Y.put({ ...fs, id: SYS_ID });

  // 5. 확인: 모두 core 에 들어갔는가 (put 은 이 기기에 암호화해 저장한 뒤 돌아온다)
  for (const id of expectLessons) if (!L.get(id)) throw new Error(`예전 말씀(${id})을 옮기지 못했어요. 예전 사본은 지우지 않았어요.`);
  for (const id of expectFiles) {
    const b = await core.files.get(id).catch(() => null);
    if (!b || !F.get(id)) throw new Error(`예전 그림(${id})을 옮기지 못했어요. 예전 사본은 지우지 않았어요.`);
  }
  for (const t of old.themes) {
    const ct = T.get(String(t.id));
    if (!ct || (t.images || []).some((im) => !(ct.images || []).some((x) => x.id === im.id || x.file === im.file))) {
      throw new Error('예전 디자인을 옮기지 못했어요. 예전 사본은 지우지 않았어요.');
    }
  }

  // 6. 그다음에만 예전(암호화 안 된) 사본을 지운다
  for (const k of info.keys) await idbDel(k);
  return count;
}

// ---------- 백업 ----------

const toDataURL = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

// data: 주소 → Blob (fetch 를 쓰면 CSP 에 막히므로 직접 푼다)
function dataURLBlob(url) {
  const [head, body] = String(url).split(',');
  const type = head.match(/^data:([^;,]*)/)?.[1] || 'application/octet-stream';
  const bin = atob(body || '');
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type });
}

// 읽을 수 있는 백업 (암호화 안 됨, 그림 포함). '백업 파일 불러오기'로 다시 넣을 수 있다
export async function backupJSON() {
  const files = {};
  for (const f of S.data.items.files) {
    const b = await getFile(f.id);
    if (b) files[f.id] = await toDataURL(b);
  }
  return JSON.stringify({ kind: 'jayangchild-backup', v: 1, at: new Date().toISOString(), sys: S.data.sys, items: S.data.items, files });
}

// 백업 파일을 지금 데이터에 합친다. 지금 데이터는 지우지 않는다: 같은 id 는 백업 쪽 내용으로 바꾸고, 없는 것은 더한다
export async function restoreJSON(json) {
  if (json?.kind !== 'jayangchild-backup' || !json.items) throw new Error('자양교회 유년부 백업 파일이 아니에요.');
  const count = {};
  for (const [id, url] of Object.entries(json.files || {})) {
    const m = (json.items.files || []).find((f) => f?.id === id) || {};
    await putFile(id, dataURLBlob(url), { name: m.name || '', w: m.w || 0, h: m.h || 0 });
  }
  for (const c of COLS) {
    await changed(c);
    const list = Array.isArray(json.items[c]) ? json.items[c] : [];
    const cur = S.data.items[c];
    for (const it of list) {
      if (!it?.id) continue;
      const body = contentOf(it);
      const i = cur.findIndex((x) => x.id === it.id);
      if (i >= 0) Object.assign(cur[i], body); else cur.push({ ...body, id: it.id });
    }
    count[c] = list.length;
    await changed(c);
  }
  const fs = json.sys?.firstSunday || {};
  S.data.sys.firstSunday = { ...S.data.sys.firstSunday, ...fs };
  await changedSys();
  return count;
}
