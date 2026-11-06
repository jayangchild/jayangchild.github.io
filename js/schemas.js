// 데이터 모양. 목록(items)마다 항목은 id를 가진 객체다.
//
// lessons  필사 한 장 = 한 항목
//   { id, kind: 'lesson'|'special', term: '2026-2', no: 45, title: '', date: '2026-11-08',
//     ref: '빌립보서 4:4', lines: ['…', '…'], month: null, at }
//   - kind 'special' 은 여름/겨울성경학교 같은 한 번짜리 장. title 이 제목 띠에 들어가고, month 로 디자인 달을 고를 수 있다.
// themes   달마다 한 항목. id 'm1' … 'm12'
//   { id: 'm11', hideBuiltin: false, images: [{ id, file, slot, dx, dy, scale }] }
// files    올린 그림의 정보. 그림 자체는 core.files 가 암호화해 둔다 (id 가 같다)
//   { id, name, type, size, w, h, lastUse? }   lastUse = 휴지통에 갈 때 있던 달·자리 (되살리면 그 자리로)
//
// sys      설정 { firstSunday: { '2026-2': '2026-07-05' } }
//   core 에는 목록 'sys' 의 기록 'firstSunday' (칸 이름 = 학기) 와 'token' ({ exp: 토큰 만료일 }) 으로 있다.
//
// 모든 항목은 core 기록이라 createdAt/By · updatedAt/By · deletedAt/By · _conflicts 도 붙어 있다 (화면은 무시해도 된다).
//
// ── 나중에: 선물 (아직 만들지 않음) ──
// 화면 모듈이 core.collection() 을 바로 쓴다 (store.js 의 사본을 거치지 않아도 된다).
//   gifts      선물 종류 { id, name, kind: 'evangelism'|'birthday'|'recitation', photo? }
//   giftStock  기준 수량 { id: <gift id>, qty, at }   — 재고를 세어 다시 정할 때만 고친다
//   giftLog    주고받은 기록 한 줄 = 한 기록 { id, gift, qty: -1|+n, member?, date, note? }  — 고치지 않고 더하기만
//   재고 = giftStock.qty + (그 선물의 giftLog qty 합계, giftStock.at 뒤의 것).
//   두 선생님이 동시에 나눠 줘도 기록이 따로 생겨서 충돌하지 않는다. giftLog 는 core 에서 조각 64개로 나뉜다.

export const COLS = ['lessons', 'themes', 'files'];

export const emptyData = () => ({
  sys: { v: 1, firstSunday: {} },
  items: Object.fromEntries(COLS.map((c) => [c, []])),
});

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
