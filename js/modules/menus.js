// 메뉴와 보이는 역할. 관리자가 메뉴마다 "어느 역할부터 보이는지"를 올릴 수 있다 (floor 밑으로는 못 내림).
// 메뉴의 기록은 그 역할 등급(access tier)에 그 등급 열쇠로 암호화되어 올라간다 → 역할을 올리면 기록도 그 등급으로 옮긴다.
// 필사노트는 비공개 데이터 저장소(core)를 쓰므로 관리자만 (관리자 꾸러미에만 데이터 열쇠가 있다).
import { ROLE_IDS, higher, lower } from './site-access.js';

export const MENUS = [
  { key: 'home', name: '유년부 소개', icon: '🏠', min: 'public', floor: 'public', cols: ['pages'] },
  { key: 'photos', name: '사진·영상', icon: '📷', min: 'parent', floor: 'parent', cols: ['albums', 'videos'] },
  { key: 'roster', name: '명단', icon: '👧', min: 'teacher', floor: 'teacher', cols: ['members'] },
  { key: 'birthdays', name: '생일', icon: '🎂', min: 'teacher', floor: 'teacher', cols: ['members'] },
  { key: 'talent', name: '달란트', icon: '🪙', min: 'teacher', floor: 'teacher', cols: ['members', 'talentLog'] },
  { key: 'plan', name: '연간계획', icon: '🗓️', min: 'teacher', floor: 'parent', cols: ['plan'] },
  { key: 'bulletin', name: '주보', icon: '📰', min: 'teacher', floor: 'parent', cols: ['bulletins'] },
  { key: 'pilsa', name: '필사노트', icon: '✏️', min: 'admin', floor: 'admin', core: true },
  { key: 'gifts', name: '선물', icon: '🎁', min: 'officer', floor: 'officer' },
  { key: 'policy', name: '정책', icon: '📜', min: 'officer', floor: 'officer' },
  { key: 'meetings', name: '임원회의', icon: '🗂️', min: 'officer', floor: 'officer' },
  { key: 'accounting', name: '회계', icon: '🧾', min: 'officer', floor: 'officer', label: '회계' },
  { key: 'admin', name: '관리', icon: '⚙️', min: 'admin', floor: 'admin' },
];
export const MENU = Object.fromEntries(MENUS.map((m) => [m.key, m]));

// cfg = { menuKey: role } (관리자가 정한 것). 없으면 기본
export function menuMin(key, cfg = {}) {
  const m = MENU[key];
  if (!m) return 'admin';
  const want = ROLE_IDS.includes(cfg[key]) ? cfg[key] : m.min;
  return higher(want, m.floor);
}

// 목록(collection)이 올라갈 등급. 기록마다 정하는 것(사진·영상의 vis)은 메뉴 등급보다 낮을 수 없다
const COL_MENU = {
  pages: 'home', albums: 'photos', videos: 'photos', talentLog: 'talent', plan: 'plan', bulletins: 'bulletin',
  gifts: 'gifts', giftTypes: 'gifts', giftStock: 'gifts', giftLog: 'gifts', policies: 'policy', meetings: 'meetings', accounting: 'accounting',
};
export const DATA_COLS = ['pages', 'sys', 'members', ...Object.keys(COL_MENU).filter((c) => c !== 'pages')];
export function tierFor(col, rec = {}, cfg = {}) {
  if (col === 'sys' || col === 'pages') return 'public';
  if (col === 'members') return ['roster', 'birthdays', 'talent'].map((k) => menuMin(k, cfg)).reduce(lower); // 명단은 셋 중 가장 낮은 등급에
  const t = menuMin(COL_MENU[col] || 'admin', cfg);
  return col === 'albums' || col === 'videos' ? higher(rec.vis || 'parent', t) : t;
}
