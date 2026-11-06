// 개발용 검사: PPTX에서 꺼낸 결과를 손으로 만든 CSV(CP949)와 비교한다. 사이트는 이 파일을 쓰지 않는다.
//   node tools/check-extract.mjs "<말씀카드.pptx>" "<달달말씀데이터.csv>"
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extractPptx, squash } from '../js/pilsa/extract.js';

const require = createRequire(import.meta.url);
const JSZip = require('../js/vendor/jszip.min.js');
const [pptx, csvPath] = process.argv.slice(2);

function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
}

const csv = parseCsv(new TextDecoder('euc-kr').decode(readFileSync(csvPath)));
const got = await extractPptx(readFileSync(pptx), JSZip);
const byNo = new Map(got.map((s) => [s.no, s]));
let textOk = 0, refOk = 0, linesOk = 0;
const issues = [];
for (const r of csv) {
  const no = +r['과'];
  const s = byNo.get(no);
  const want = r['구절'].split(/\r?\n/).map(squash).filter(Boolean);
  const wantRef = squash(r['성경']).replace(/^\(|\)$/g, '').replace('~', '-');
  if (!s) { issues.push(`${no}과: PPTX에 없음`); continue; }
  const t1 = squash(want.join(' ')), t2 = s.text;
  if (t1 === t2) textOk++;
  else issues.push(`${no}과 구절 다름\n   CSV : ${t1}\n   PPTX: ${t2}`);
  if (wantRef === s.ref) refOk++; else issues.push(`${no}과 성경 다름: CSV "${wantRef}" / PPTX "${s.ref}"`);
  if (JSON.stringify(want) === JSON.stringify(s.lines)) linesOk++;
  else issues.push(`${no}과 줄 나눔 다름\n   CSV : ${want.join(' / ')}\n   추출: ${s.lines.join(' / ')}`);
}
for (const s of got) if (s.warn.length) issues.push(`슬라이드 ${s.slide}: ${s.warn.join(', ')}`);
console.log(`슬라이드 ${got.length}개, CSV ${csv.length}행`);
console.log(`구절 글자 일치 ${textOk}/${csv.length} · 성경 일치 ${refOk}/${csv.length} · 줄 나눔 일치 ${linesOk}/${csv.length}`);
console.log(issues.join('\n'));
