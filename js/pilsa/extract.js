// 말씀카드 PPTX에서 과 번호 · 구절 · 성경(장절)을 꺼낸다. 모두 브라우저 안에서 한다.
//
// PPTX = ZIP 파일. 그 안의 ppt/slides/slideN.xml 에 슬라이드 글자가 있다.
//   - 제목 상자: "27과  오늘의 말씀"            → 과 번호
//   - 본문 상자(한두 개): 구절 + 끝의 "(사도행전 2:4)" → 구절, 성경
// 카드(세로로 좁은 칸)의 줄바꿈은 A4 필사지와 맞지 않아서, 글자만 꺼낸 뒤
// 필사지에 맞게 줄을 다시 나눈다(reflow). 나눈 줄은 화면에서 고칠 수 있다.
//
// XML은 정규식으로 읽는다: 브라우저와 Node(검사 도구) 양쪽에서 그대로 돌기 위해서다.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
  return ENT[e] ?? m;
});

// 공백 정리: 줄바꿈·nbsp·연속 공백 → 공백 하나
export const squash = (s) => String(s).replace(/[\s 　]+/g, ' ').trim();

// 슬라이드 순서: presentation.xml 의 sldIdLst 순서 (파일 이름 번호와 다를 수 있다)
async function slidePaths(zip) {
  const pres = await zip.file('ppt/presentation.xml')?.async('string');
  const rels = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string');
  if (pres && rels) {
    const target = {};
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = m[0].match(/\bId="([^"]+)"/)?.[1];
      const t = m[0].match(/\bTarget="([^"]+)"/)?.[1];
      if (id && t) target[id] = t;
    }
    const ids = [...pres.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map((m) => m[1]);
    const list = ids.map((id) => target[id]).filter(Boolean).map((t) => 'ppt/' + t.replace(/^\.?\//, '').replace(/^\/?ppt\//, ''));
    if (list.length && list.every((p) => zip.file(p))) return list;
  }
  const num = (p) => +p.match(/slide(\d+)\.xml$/)[1];
  return Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => num(a) - num(b));
}

// 슬라이드 XML → 글상자 목록. 상자마다 문단 배열, 문단 안의 <a:br/>은 '\n'
export function slideBoxes(xml) {
  const boxes = [];
  for (const sp of xml.match(/<p:sp>[\s\S]*?<\/p:sp>|<p:sp\s[\s\S]*?<\/p:sp>/g) || []) {
    const body = sp.match(/<p:txBody>[\s\S]*<\/p:txBody>/)?.[0];
    if (!body) continue;
    const paras = (body.match(/<a:p>[\s\S]*?<\/a:p>|<a:p\s[\s\S]*?<\/a:p>/g) || []).map((p) => {
      let t = '';
      for (const m of p.matchAll(/<a:t>([\s\S]*?)<\/a:t>|<a:t\s[^>]*>([\s\S]*?)<\/a:t>|<a:br\b/g)) {
        t += m[0].startsWith('<a:br') ? '\n' : unxml(m[1] ?? m[2] ?? '');
      }
      return t;
    });
    if (paras.some((p) => p.trim())) boxes.push(paras);
  }
  return boxes;
}

// 끝에 있는 "(책 장:절)" — 책 이름 1~2 단어, 장절에는 -, ~, 쉼표, 상/하가 올 수 있다
const REF_RE = /\(\s*([가-힣]+(?:\s+[가-힣]+)?)\s*(\d+\s*[:：]\s*\d+(?:\s*[-~,]\s*\d+(?:\s*[:：]\s*\d+)?)*\s*[상하]?)\s*\)\s*$/;
const LESSON_RE = /^\s*(\d{1,3})\s*과/;

export function parseSlide(boxes) {
  let no = null;
  const rest = [];
  for (const paras of boxes) {
    const all = squash(paras.join(' '));
    const m = all.match(LESSON_RE);
    if (no == null && m && all.length < 30) no = +m[1];
    else rest.push(paras);
  }
  // 카드의 문단(줄) 경계는 줄 나누기의 힌트로 쓴다
  const cardLines = rest.flatMap((paras) => paras.flatMap((p) => p.split('\n'))).map(squash).filter(Boolean);
  let text = squash(cardLines.join(' '));
  let ref = '';
  const r = text.match(REF_RE);
  if (r) {
    ref = `${r[1].replace(/\s+/g, ' ')} ${r[2].replace(/\s+/g, '').replace('：', ':')}`;
    text = squash(text.slice(0, r.index));
  }
  const warn = [];
  if (no == null) warn.push('과 번호를 찾지 못했어요');
  if (!ref) warn.push('성경 장절을 찾지 못했어요');
  if (!text) warn.push('구절이 비어 있어요');
  return { no, ref, text, cardLines, warn };
}

export async function extractPptx(data, JSZip) {
  const zip = await JSZip.loadAsync(data);
  const out = [];
  let i = 0;
  for (const p of await slidePaths(zip)) {
    i++;
    const s = parseSlide(slideBoxes(await zip.file(p).async('string')));
    if (!s.text && s.no == null) continue; // 빈 슬라이드
    out.push({ slide: i, ...s, lines: reflow(s.text, s.cardLines) });
  }
  return out;
}

// ───────── 줄 나누기 ─────────
// 필사지 한 줄에 너무 길지 않게, 줄 길이가 고르게, 되도록 말이 끝나는 곳(…하며, …하고, …니라)에서 끊는다.

// 기본값은 직접 만든 데이터(2026 상·하반기 52과)의 줄 나눔에 가장 가깝게 맞춘 값 (tools/check-extract.mjs)
export const REFLOW = { wS: -16.5, wC: -7, wO: 1.4, wA: -1, wW: 20.4, hint: -10.6, alpha: 0.047, linePen: 37.5, soft: 28, over: 35.7, short: 8 };

export function lineCount(len) {
  if (len <= 20) return 1;
  if (len <= 50) return 2;
  if (len <= 105) return 3;
  return Math.ceil(len / 31);
}

const STRONG = /(니라|리라|하라|도다|이라|이요|노라|리니|더라|하니|이다|니다|나이다|리이다)$/;
const CLAUSE = /(고|며|서|여|니|되|매|사|면|나|데|아|어|요|라|다|지|도)$/;
const OBJ = /(을|를)$/;
const ADV = /(에|에게|께|로|으로|와|과|에서|만)$/;
const WEAK = /(의|및|그|이|저|곧|또|또한|오직|보라|이는|한|할|된|는|신|던|운|은)$/;

function breakScore(word, P) {
  const w = word.replace(/[^가-힣]+$/, '');
  if (/[,.;:!?]$/.test(word)) return P.wS;
  if (STRONG.test(w)) return P.wS;
  if (CLAUSE.test(w)) return P.wC;
  if (OBJ.test(w)) return P.wO;
  if (ADV.test(w)) return P.wA;
  if (WEAK.test(w)) return P.wW;
  return 0;
}

function reflowN(words, hint, n, P) {
  const N = words.length;
  const total = words.join(' ').length;
  const pre = [0];
  for (const w of words) pre.push(pre[pre.length - 1] + w.length);
  const len = (a, b) => pre[b] - pre[a] + (b - a - 1); // words[a..b) 의 글자 수(공백 포함)
  const target = total / n;
  const lineCost = (a, b) => {
    const L = len(a, b);
    let c = (L - target) ** 2 * P.alpha;
    if (L > P.soft) c += (L - P.soft) * P.over; // 너무 긴 줄은 글자가 작아진다
    if (L < P.short && n > 1) c += 60;
    return c + P.linePen;
  };
  const cut = (i) => breakScore(words[i - 1], P) + (hint.has(i) ? P.hint : 0);
  const INF = 1e18;
  const dp = Array.from({ length: n + 1 }, () => new Array(N + 1).fill(INF));
  const from = Array.from({ length: n + 1 }, () => new Array(N + 1).fill(-1));
  dp[0][0] = 0;
  for (let j = 1; j <= n; j++) {
    for (let b = j; b <= N; b++) {
      for (let a = j - 1; a < b; a++) {
        if (dp[j - 1][a] === INF) continue;
        const c = dp[j - 1][a] + lineCost(a, b) + (b < N ? cut(b) : 0);
        if (c < dp[j][b]) { dp[j][b] = c; from[j][b] = a; }
      }
    }
  }
  const lines = [];
  for (let j = n, b = N; j > 0; j--) {
    const a = from[j][b];
    lines.unshift(words.slice(a, b).join(' '));
    b = a;
  }
  return { lines, cost: dp[n][N] };
}

// n을 주면 그 줄 수로, 안 주면 규칙의 줄 수 ±1 중 가장 자연스러운 것으로 나눈다
export function reflow(text, cardLines = [], n, P = REFLOW) {
  const words = squash(text).split(' ').filter(Boolean);
  if (!words.length) return [];
  const hint = new Set();
  let k = 0;
  for (const l of cardLines) { k += squash(l).split(' ').filter(Boolean).length; hint.add(k); }
  if (n) return reflowN(words, hint, Math.min(n, words.length), P).lines;
  const base = lineCount(words.join(' ').length);
  let best = null;
  for (const m of [base - 1, base, base + 1]) {
    if (m < 1 || m > words.length) continue;
    const r = reflowN(words, hint, m, P);
    if (!best || r.cost < best.cost) best = r;
  }
  return best.lines;
}
