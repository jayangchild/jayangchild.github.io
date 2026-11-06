// 화면 공통 도구: 알림, 대화상자, 파일 저장, 미리보기 크기
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

let toastTimer = null;
export function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// 대화상자 열기. html 을 넣고, 닫힐 때 resolve
export function openModal(html, onReady) {
  const dlg = $('#modal');
  const body = $('#modal-body');
  body.innerHTML = html;
  return new Promise((res) => {
    const close = (v) => { dlg.close(); res(v); };
    dlg.onclose = () => res(undefined);
    body.onclick = (e) => { if (e.target.closest('[data-close]')) close(undefined); };
    dlg.showModal();
    onReady?.(body, close);
  });
}

export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function pickFile(accept) {
  return new Promise((res) => {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept });
    inp.onchange = () => res(inp.files[0] || null);
    inp.click();
  });
}

// A4 미리보기 배율: 상자 폭에 맞춘다 (최대 max)
export const MM = 96 / 25.4;
export function fitScale(el, max = 1, fitHeight = false) {
  const w = el.clientWidth || 300;
  let s = Math.min(max, (w - 4) / (210 * MM));
  // 한 장이 화면 높이 안에 다 보이게 (디자인 화면: 그림을 끌어 옮기기 쉽게)
  if (fitHeight && innerWidth > 700) s = Math.min(s, (innerHeight - 90) / (297 * MM));
  return s;
}

export const pad2 = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
export function nextSunday(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return iso(d);
}
export function firstSundayOf(year, month) {
  return nextSunday(new Date(year, month - 1, 1));
}
