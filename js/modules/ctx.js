// 지금 쓰는 사람(역할)과 화면 모듈의 데이터. 모든 모듈 데이터는 access 등급(tier)에 있다 (js/core/access.js):
//   - 기록 하나 = access 항목 하나 { id, tier, data: { col, …내용, createdAt/By, updatedAt/By } }
//   - 파일(사진·PDF·엑셀) = access 파일 항목 (publishFile). 기록에는 파일 id 만
//   - 등급은 목록·메뉴 설정이 정한다 (menus.js 의 tierFor). 공개 → 평문, 그 밖 → 그 등급 열쇠로 암호화
//   - 읽기 역할(학부모·선생님)은 볼 수 있는 등급만 읽고, 쓰기 역할(임원·관리자)은 publish/unpublish 로 고친다
//   - 지우기는 모두 휴지통(unpublish). 암호문·파일은 지우지 않고, restore 로 되살린다
// 화면 모듈은 who · has() · col() · upload() · fileURL() · fileBlob() 만 쓴다.
import { core } from '../store.js';
import { access, reaches, ROLE_NAME } from './site-access.js';
import { MENU, menuMin, tierFor } from './menus.js';

export const who = { role: 'public', name: '', labels: [], write: false, admin: false, vaultOnly: false };
export const has = (role) => reaches(who.role, role);
export const hasLabel = (l) => who.role === 'admin' || who.labels.includes(l);
export const isWriter = () => who.write;
export const coreOpen = () => core.status().open;

export function setWho(s) {
  Object.assign(who, s
    ? { role: s.role, name: s.name || '', labels: s.labels || [], write: !!s.canWrite, admin: !!s.isAdmin, vaultOnly: false }
    : { role: 'public', name: '', labels: [], write: false, admin: false, vaultOnly: false });
}

// ---------- 받아 둔 것 ----------
const D = { cols: new Map(), files: new Map(), trash: [], urls: new Map(), at: 0, offline: false };
const META = ['createdAt', 'createdBy', 'updatedAt', 'updatedBy'];
const strip = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_') && k !== 'id' && k !== 'col'));

function keep(it) {
  if (it.file) { D.files.set(it.id, { tier: it.tier, ...it.file, deletedAt: it.deletedAt }); return; }
  const d = it.data;
  if (!d?.col) return;
  const rec = { ...d, id: it.id, _tier: it.tier, _at: it.at };
  if (it.deletedAt) { D.trash.push({ col: d.col, rec: { ...rec, deletedAt: it.deletedAt } }); return; }
  const m = D.cols.get(d.col) || D.cols.set(d.col, new Map()).get(d.col);
  const cur = m.get(it.id);
  if (!cur || (cur._at || '') < (it.at || '')) m.set(it.id, rec); // 같은 id 가 두 등급에 있으면(옮기는 중) 새것
}

// 볼 수 있는 모든 등급을 다시 받는다 (로그인할 때, 화면으로 돌아올 때)
export async function loadAll() {
  const next = { cols: new Map(), files: new Map(), trash: [] };
  const old = { cols: D.cols, files: D.files, trash: D.trash };
  Object.assign(D, next);
  try {
    for (const t of access.tiers()) for (const it of await access.list(t, { deleted: isWriter() ? 'all' : false })) keep(it);
    D.offline = false;
  } catch (e) {
    if (e.code === 'offline') { Object.assign(D, old); D.offline = true; return; }
    if (e.code === 'revoked' || e.code === 'locked') throw e;
    console.warn(e);
    Object.assign(D, old);
    throw e;
  }
  D.trash = D.trash.filter((t) => !D.cols.get(t.col)?.has(t.rec.id)); // 다른 등급으로 옮긴 것의 예전 자리
  D.at = Date.now();
}
export const clearData = () => { D.cols = new Map(); D.files = new Map(); D.trash = []; for (const u of D.urls.values()) URL.revokeObjectURL(u); D.urls.clear(); };
export const isOffline = () => D.offline;

const order = (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || (a.id < b.id ? -1 : 1);
const now = () => new Date().toISOString();
const filesOf = (r) => [r.photo, ...(r.photos || []), ...(r.files || []).map((f) => f?.id || f)].filter(Boolean);

function need() { if (!isWriter()) throw new Error('보기만 할 수 있어요. 고치기는 임원·관리자만 할 수 있어요.'); }

// 기록을 다른 등급으로 옮길 때: 파일도 그 등급으로 다시 올리고(새 id), 예전 것은 휴지통
async function moveFiles(rec, tier) {
  const map = new Map();
  for (const id of filesOf(rec)) {
    const f = D.files.get(id);
    if (!f || f.tier === tier) continue;
    const blob = await access.file(id, f.tier);
    const r = await access.publishFile(blob, { tier, name: f.name, type: f.type, data: { col: '_file' } });
    D.files.set(r.id, { tier, name: f.name, type: f.type, size: f.size });
    await access.unpublish(id, f.tier).catch((e) => console.warn(e));
    map.set(id, r.id);
  }
  if (!map.size) return rec;
  const sw = (id) => map.get(id) || id;
  return {
    ...rec,
    ...(rec.photo ? { photo: sw(rec.photo) } : {}),
    ...(rec.photos ? { photos: rec.photos.map(sw) } : {}),
    ...(rec.files ? { files: rec.files.map((f) => (f?.id ? { ...f, id: sw(f.id) } : sw(f))) } : {}),
  };
}

export function col(name) {
  const m = () => D.cols.get(name) || new Map();
  const api = {
    name,
    readOnly: !isWriter(),
    list: () => [...m().values()].sort(order).map((r) => structuredClone(r)),
    get: (id) => structuredClone(m().get(String(id)) || null),
    trash: () => D.trash.filter((t) => t.col === name).map((t) => t.rec),
    // 고치거나 새로 (내용 전체). 등급은 목록·메뉴 설정이 정한다 → 바뀌었으면 옮긴다
    async put(rec) {
      need();
      const old = rec.id ? m().get(String(rec.id)) : null;
      const id = old?.id || rec.id || undefined;
      const tier = tierFor(name, rec, menuCfg());
      let body = strip(rec);
      if (old && old._tier !== tier) body = await moveFiles(body, tier);
      const data = { ...body, col: name, createdAt: old?.createdAt || now(), createdBy: old?.createdBy || who.name, updatedAt: now(), updatedBy: who.name };
      const r = await access.publish({ id, tier, data });
      if (old && old._tier !== tier) await access.unpublish(old.id, old._tier).catch((e) => console.warn(e));
      const saved = { ...data, id: r.id, _tier: tier, _at: now() };
      if (!D.cols.has(name)) D.cols.set(name, new Map());
      D.cols.get(name).set(r.id, saved);
      return structuredClone(saved);
    },
    async patch(id, fields) {
      const cur = m().get(String(id));
      if (!cur) throw new Error('기록을 찾을 수 없어요.');
      return api.put({ ...cur, ...fields, id: cur.id });
    },
    // 휴지통 (되살릴 수 있다)
    async softDelete(id) {
      need();
      const cur = m().get(String(id));
      if (!cur) throw new Error('기록을 찾을 수 없어요.');
      await access.unpublish(cur.id, cur._tier);
      m().delete(cur.id);
      D.trash.push({ col: name, rec: { ...cur, deletedAt: now(), deletedBy: who.name } });
    },
  };
  return api;
}

export async function restoreItem(colName, id) {
  need();
  const i = D.trash.findIndex((t) => t.col === colName && t.rec.id === id);
  if (i < 0) throw new Error('휴지통에서 찾을 수 없어요.');
  const { rec } = D.trash[i];
  await access.restore(id, rec._tier);
  D.trash.splice(i, 1);
  const { deletedAt, ...live } = rec;
  if (!D.cols.has(colName)) D.cols.set(colName, new Map());
  D.cols.get(colName).set(id, live);
}
export const moduleTrash = () => [...D.trash].sort((a, b) => (b.rec.deletedAt || '').localeCompare(a.rec.deletedAt || ''));

// 메뉴 설정 (어느 역할부터 보이는지) — 공개 등급의 sys 기록
export const menuCfg = () => D.cols.get('sys')?.get('sys-menus') || {};

export const canSee = (key) => {
  const m = MENU[key];
  if (!m) return false;
  if (who.vaultOnly) return ['home', 'pilsa', 'admin'].includes(key) && (key !== 'pilsa' || coreOpen()); // 사이트 비밀번호로만 연 관리자
  if (!has(menuMin(key, menuCfg()))) return false;
  if (m.label && !hasLabel(m.label)) return false;
  if (m.core && !coreOpen()) return false; // 필사노트: 데이터 저장소가 열려 있어야
  return true;
};

// ---------- 파일 ----------
// 올리기: 사진은 이 기기에서 줄이고(긴 변 1600px) 위치 정보(EXIF)를 뺀 뒤, 기록과 같은 등급으로 암호화해 올린다
export async function upload(file, { col: colName, rec = {}, image = true } = {}) {
  need();
  const tier = tierFor(colName, rec, menuCfg());
  const isImg = image && /^image\//.test(file.type);
  const r = await access.publishFile(file, { tier, name: file.name, type: file.type, resize: isImg, data: { col: '_file' } });
  const meta = { id: r.id, name: file.name, type: isImg && !/png|webp/i.test(file.type) ? 'image/jpeg' : file.type, size: r.size };
  D.files.set(r.id, { tier, ...meta });
  return meta;
}
export async function fileBlob(id) {
  const f = D.files.get(id);
  if (!f) throw new Error('파일을 찾을 수 없어요.');
  return access.file(id, f.tier);
}
export async function fileURL(id) {
  if (!id) return '';
  if (D.urls.has(id)) return D.urls.get(id);
  try {
    const u = URL.createObjectURL(await fileBlob(id));
    D.urls.set(id, u);
    return u;
  } catch (e) { console.warn(e); return ''; }
}

export const roleText = () => `${ROLE_NAME[who.role] || ''}${who.labels.length ? ` (${who.labels.join(', ')})` : ''}`;
