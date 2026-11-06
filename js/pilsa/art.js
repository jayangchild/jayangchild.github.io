// 필사지 장식 그림. 모두 직접 그린 SVG (외부 그림 없음).
// 11월·12월 그림은 승인된 디자인(pilsa/monthly.html)의 것을 그대로 옮겼다.

export const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;

export const ART = {
  // ───── 11월 · 12월 (monthly.html 그대로) ─────
  maple: (c = '#e0663f') => svg('0 0 100 100', `<path d="M50 4 L58 27 L73 19 L69 42 L91 37 L81 52 L96 60 L72 66 L77 81 L56 72 L52 88 L48 88 L44 72 L23 81 L28 66 L4 60 L19 52 L9 37 L31 42 L27 19 L42 27 Z" fill="${c}" stroke="${c}" stroke-width="3" stroke-linejoin="round"/><path d="M50 88 L50 99" stroke="#9a5a2a" stroke-width="3.5" stroke-linecap="round"/><path d="M50 30 L50 86 M50 60 L30 48 M50 60 L70 48" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none" stroke-linecap="round"/>`),
  ginkgo: (c = '#f2c443') => svg('0 0 100 100', `<path d="M50 62 C24 58 8 36 10 14 C28 6 44 9 50 24 C56 9 72 6 90 14 C92 36 76 58 50 62 Z" fill="${c}"/><path d="M50 62 C50 74 47 86 42 96" stroke="#b8902a" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M50 58 L30 22 M50 58 L42 18 M50 58 L58 18 M50 58 L70 22" stroke="#fff" stroke-opacity=".4" stroke-width="1.6"/>`),
  acorn: () => svg('0 0 100 100', `<path d="M50 6 L52 18" stroke="#7a4a24" stroke-width="5" stroke-linecap="round"/><ellipse cx="50" cy="60" rx="26" ry="32" fill="#c98a4b"/><ellipse cx="42" cy="58" rx="6" ry="14" fill="#fff" opacity=".25"/><path d="M18 40 C18 22 34 15 50 15 C66 15 82 22 82 40 C70 46 30 46 18 40 Z" fill="#7a4a24"/><path d="M28 30 L40 38 M42 24 L54 38 M58 24 L68 36 M70 30 L76 38" stroke="#a46a3a" stroke-width="2.4"/>`),
  apple: (c = '#e05a4a') => svg('0 0 100 100', `<path d="M50 26 C38 16 14 20 14 48 C14 74 32 94 50 86 C68 94 86 74 86 48 C86 20 62 16 50 26 Z" fill="${c}"/><path d="M50 26 C50 18 52 10 56 6" stroke="#7a4a24" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M54 16 C64 4 80 8 82 12 C74 22 62 22 54 16 Z" fill="#7bb661"/><ellipse cx="32" cy="44" rx="6" ry="11" fill="#fff" opacity=".35"/>`),
  pumpkin: () => svg('0 0 120 100', `<ellipse cx="34" cy="60" rx="26" ry="32" fill="#e7843a"/><ellipse cx="86" cy="60" rx="26" ry="32" fill="#e7843a"/><ellipse cx="60" cy="60" rx="30" ry="36" fill="#f29a48"/><path d="M48 30 C42 50 42 72 48 92 M72 30 C78 50 78 72 72 92" stroke="#d06f2a" stroke-width="2.4" fill="none"/><path d="M58 26 C58 18 60 10 66 6" stroke="#6b8a3a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M64 20 C76 8 94 12 98 18 C88 28 74 28 64 20 Z" fill="#8cbf5f"/>`),
  wheat: () => {
    let g = '<path d="M50 98 C50 70 52 40 56 10" stroke="#c7a050" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    for (let i = 0; i < 6; i++) {
      const y = 18 + i * 11, x = 55 - i * 0.7;
      g += `<ellipse cx="${x - 7}" cy="${y}" rx="4.2" ry="8" transform="rotate(-32 ${x - 7} ${y})" fill="#e2bd62"/>`;
      g += `<ellipse cx="${x + 7}" cy="${y + 2}" rx="4.2" ry="8" transform="rotate(32 ${x + 7} ${y + 2})" fill="#d8ae4e"/>`;
    }
    return svg('0 0 100 100', g + '<ellipse cx="57" cy="9" rx="4" ry="7" fill="#e2bd62"/>');
  },
  basket: () => svg('0 0 160 130', `
    <path d="M30 62 C30 10 130 10 130 62" stroke="#a66b3c" stroke-width="7" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="56" r="16" fill="#e05a4a"/><circle cx="54" cy="51" r="4" fill="#fff" opacity=".35"/>
    <circle cx="96" cy="54" r="15" fill="#f2c443"/>
    <g fill="#8a5bb8"><circle cx="78" cy="46" r="7"/><circle cx="88" cy="40" r="7"/><circle cx="70" cy="38" r="7"/><circle cx="80" cy="32" r="7"/><circle cx="74" cy="54" r="7"/></g>
    <path d="M80 28 C82 20 86 16 92 14" stroke="#6b8a3a" stroke-width="3" fill="none"/>
    <circle cx="118" cy="60" r="13" fill="#e8763c"/><circle cx="40" cy="62" r="12" fill="#f29a48"/>
    <path d="M18 64 L142 64 L130 120 C128 126 124 128 118 128 L42 128 C36 128 32 126 30 120 Z" fill="#c98a4b"/>
    <path d="M18 64 L142 64 L140 74 L20 74 Z" fill="#a66b3c"/>
    <g stroke="#a66b3c" stroke-width="2.2" opacity=".7"><path d="M24 90 L136 90 M28 106 L132 106"/><path d="M50 74 L52 126 M74 74 L75 128 M98 74 L97 128 M120 74 L116 126"/></g>`),
  snow: (c = '#9fc3d9') => svg('0 0 100 100', `<g stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none">${[0, 60, 120].map((a) => `<g transform="rotate(${a} 50 50)"><path d="M50 8 L50 92"/><path d="M50 22 L40 12 M50 22 L60 12 M50 78 L40 88 M50 78 L60 88"/></g>`).join('')}</g>`),
  star: (c = '#f2c14e') => svg('0 0 100 100', `<path d="M50 6 L61 37 L94 38 L68 58 L77 90 L50 71 L23 90 L32 58 L6 38 L39 37 Z" fill="${c}" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>`),
  tree: () => svg('0 0 120 160', `
    <rect x="52" y="128" width="16" height="22" rx="3" fill="#8a5a33"/>
    <path d="M60 30 L104 132 C106 136 104 138 100 138 L20 138 C16 138 14 136 16 132 Z" fill="#3f8f68"/>
    <path d="M60 30 L92 100 L28 100 Z" fill="#4ea377"/>
    <path d="M60 30 L80 70 L40 70 Z" fill="#5db886"/>
    <path d="M30 116 C50 108 74 120 96 108 M38 88 C54 82 70 92 86 82 M46 62 C56 58 66 64 74 58" stroke="#f2c14e" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <g fill="#d9534f"><circle cx="40" cy="126" r="5"/><circle cx="82" cy="122" r="5"/><circle cx="60" cy="96" r="4.5"/><circle cx="50" cy="76" r="4"/></g>
    <g fill="#f2c14e"><circle cx="70" cy="110" r="4"/><circle cx="44" cy="102" r="3.6"/><circle cx="68" cy="78" r="3.6"/></g>
    <path d="M60 8 L65 22 L79 22 L68 31 L72 45 L60 37 L48 45 L52 31 L41 22 L55 22 Z" fill="#f2c14e" stroke="#f2c14e" stroke-width="2" stroke-linejoin="round"/>`),
  gift: (c = '#d9534f', r = '#f2c14e') => svg('0 0 100 100', `<rect x="12" y="40" width="76" height="54" rx="5" fill="${c}"/><rect x="8" y="30" width="84" height="16" rx="4" fill="${c}"/><rect x="44" y="30" width="12" height="64" fill="${r}"/><path d="M50 30 C36 10 18 18 26 28 C30 32 42 31 50 30 C58 31 70 32 74 28 C82 18 64 10 50 30 Z" fill="${r}"/>`),
  nativity: () => svg('0 0 170 150', `
    <path d="M85 4 L89 16 L102 16 L92 24 L96 37 L85 29 L74 37 L78 24 L68 16 L81 16 Z" fill="#f2c14e"/>
    <g stroke="#f2c14e" stroke-width="2" stroke-linecap="round" opacity=".7"><path d="M85 42 L85 52 M60 22 L50 18 M110 22 L120 18"/></g>
    <path d="M22 60 L85 46 L148 60 L148 68 L22 68 Z" fill="#9a6235"/>
    <rect x="30" y="68" width="110" height="74" fill="#e9d2ad"/>
    <rect x="30" y="68" width="8" height="74" fill="#b67c48"/><rect x="132" y="68" width="8" height="74" fill="#b67c48"/>
    <path d="M38 142 L132 142" stroke="#b67c48" stroke-width="3"/>
    <g stroke="#e2bd62" stroke-width="2.4" stroke-linecap="round"><path d="M56 106 L50 96 M64 104 L62 92 M76 104 L78 92 M100 104 L104 92 M110 106 L118 96 M90 104 L90 92"/></g>
    <path d="M50 106 L120 106 L112 124 L58 124 Z" fill="#a66b3c"/>
    <path d="M60 124 L52 140 M110 124 L118 140" stroke="#a66b3c" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="85" cy="102" rx="22" ry="9" fill="#fff8ee" stroke="#e0cfb4" stroke-width="1.5"/>
    <circle cx="68" cy="99" r="7.5" fill="#f6d2b4"/>
    <path d="M62 96 C64 90 72 90 75 95" fill="#8a5a33"/>
    <circle cx="68" cy="99" r="12" fill="none" stroke="#f2c14e" stroke-width="1.6" opacity=".8"/>`),

  // ───── 공통 작은 그림 ─────
  heart: (c = '#e46f86') => svg('0 0 100 100', `<path d="M50 88 C22 68 6 50 6 32 C6 18 17 8 30 8 C40 8 47 14 50 22 C53 14 60 8 70 8 C83 8 94 18 94 32 C94 50 78 68 50 88 Z" fill="${c}"/><ellipse cx="28" cy="30" rx="6" ry="10" transform="rotate(-30 28 30)" fill="#fff" opacity=".35"/>`),
  leaf: (c = '#7bb661') => svg('0 0 100 100', `<path d="M14 86 C10 44 40 12 88 10 C90 56 60 88 14 86 Z" fill="${c}"/><path d="M14 86 C34 64 54 44 80 18" stroke="#fff" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  sprout: () => svg('0 0 100 100', `<path d="M50 96 C50 80 50 66 50 50" stroke="#5f9a3a" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M50 56 C30 58 14 46 12 26 C32 22 48 34 50 56 Z" fill="#8cc152"/><path d="M50 50 C58 30 76 20 92 24 C92 44 74 56 50 50 Z" fill="#a6d36a"/>`),
  tulip: (c = '#f08080') => svg('0 0 60 120', `<path d="M30 118 L30 50" stroke="#5f9a3a" stroke-width="4" stroke-linecap="round"/><path d="M30 98 C14 94 6 80 8 66 C22 70 30 82 30 98 Z" fill="#8cc152"/><path d="M12 22 L20 34 L30 16 L40 34 L48 22 C52 40 46 56 30 58 C14 56 8 40 12 22 Z" fill="${c}"/>`),
  butterfly: (a = '#f2a65a', b = '#f6cf6b') => svg('0 0 100 100', `<path d="M48 48 C34 18 8 14 8 34 C8 50 28 54 48 52 Z" fill="${a}"/><path d="M52 48 C66 18 92 14 92 34 C92 50 72 54 52 52 Z" fill="${a}"/><path d="M48 54 C30 56 16 70 24 82 C32 90 44 74 48 58 Z" fill="${b}"/><path d="M52 54 C70 56 84 70 76 82 C68 90 56 74 52 58 Z" fill="${b}"/><rect x="46" y="38" width="8" height="40" rx="4" fill="#6b4a3a"/><path d="M48 40 C44 30 40 24 34 22 M52 40 C56 30 60 24 66 22" stroke="#6b4a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`),
  egg: (c = '#9fd3e6', s = '#fff') => svg('0 0 80 100', `<path d="M40 6 C62 6 76 44 76 62 C76 84 60 96 40 96 C20 96 4 84 4 62 C4 44 18 6 40 6 Z" fill="${c}"/><path d="M6 52 L16 44 L26 52 L36 44 L46 52 L56 44 L66 52 L75 45" stroke="${s}" stroke-width="4" fill="none" stroke-linejoin="round"/><g fill="${s}"><circle cx="24" cy="72" r="4"/><circle cx="40" cy="76" r="4"/><circle cx="56" cy="72" r="4"/></g>`),
  chick: () => svg('0 0 100 100', `<ellipse cx="50" cy="62" rx="32" ry="30" fill="#f6d55c"/><circle cx="50" cy="34" r="20" fill="#f6d55c"/><path d="M48 14 C46 6 52 4 54 10" stroke="#e3b23c" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="57" cy="32" r="3" fill="#5a4a3a"/><path d="M68 36 L80 40 L68 44 Z" fill="#f29a48"/><path d="M30 62 C40 54 52 58 56 68 C46 72 36 70 30 62 Z" fill="#e8bf3c"/><path d="M40 92 L38 98 M58 92 L60 98" stroke="#f29a48" stroke-width="3" stroke-linecap="round"/>`),
  carnation: (c = '#e8607a') => svg('0 0 80 130', `<path d="M40 128 L40 50" stroke="#5f9a3a" stroke-width="4" stroke-linecap="round"/><path d="M40 100 C26 98 18 88 18 78 C30 80 38 88 40 100 Z M40 88 C52 84 60 74 62 64 C50 66 42 74 40 88 Z" fill="#8cc152"/><path d="M28 52 L34 58 L46 58 L52 52 L44 64 L36 64 Z" fill="#6aa84f"/><path d="M14 30 L22 22 L26 30 L34 18 L40 28 L46 18 L54 30 L58 22 L66 30 L62 40 C56 52 24 52 18 40 Z" fill="${c}"/><path d="M22 36 L30 30 L36 38 L44 30 L50 38 L58 32" stroke="#fff" stroke-opacity=".5" stroke-width="2.4" fill="none" stroke-linejoin="round"/>`),
  balloon: (c = '#e8607a') => svg('0 0 60 120', `<path d="M30 4 C48 4 56 20 56 34 C56 52 42 64 30 66 C18 64 4 52 4 34 C4 20 12 4 30 4 Z" fill="${c}"/><path d="M26 66 L34 66 L30 72 Z" fill="${c}"/><path d="M30 72 C24 84 36 94 28 106 C24 112 30 116 30 118" stroke="#9a9a9a" stroke-width="1.6" fill="none"/><ellipse cx="20" cy="24" rx="5" ry="9" transform="rotate(20 20 24)" fill="#fff" opacity=".4"/>`),
  raindrop: (c = '#7fb8e0') => svg('0 0 60 90', `<path d="M30 4 C40 24 54 40 54 58 C54 74 42 86 30 86 C18 86 6 74 6 58 C6 40 20 24 30 4 Z" fill="${c}"/><ellipse cx="20" cy="60" rx="5" ry="10" fill="#fff" opacity=".4"/>`),
  cloud: (c = '#ffffff', s = '#c9dbe8') => svg('0 0 120 70', `<path d="M24 62 C8 62 4 46 14 38 C12 24 28 16 38 24 C44 8 70 6 78 22 C92 14 110 24 106 40 C118 44 116 62 100 62 Z" fill="${c}" stroke="${s}" stroke-width="3" stroke-linejoin="round"/>`),
  sun: (c = '#f6c443') => svg('0 0 100 100', `<g stroke="${c}" stroke-width="6" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M50 6 L50 16" transform="rotate(${a} 50 50)"/>`).join('')}</g><circle cx="50" cy="50" r="24" fill="${c}"/><circle cx="42" cy="46" r="3" fill="#8a5a33"/><circle cx="58" cy="46" r="3" fill="#8a5a33"/><path d="M41 56 C46 62 54 62 59 56" stroke="#8a5a33" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  shell: (c = '#f4b6a6') => svg('0 0 100 90', `<path d="M50 84 L14 40 C14 18 30 6 50 6 C70 6 86 18 86 40 Z" fill="${c}"/><path d="M50 84 L24 16 M50 84 L38 8 M50 84 L62 8 M50 84 L76 16" stroke="#fff" stroke-opacity=".6" stroke-width="3" fill="none"/><path d="M40 84 L60 84 L56 76 L44 76 Z" fill="${c}"/>`),
  starfish: (c = '#f29a6a') => svg('0 0 100 100', `<path d="M50 8 C56 8 58 30 62 36 C68 40 92 38 94 44 C96 50 74 60 72 66 C72 72 84 90 78 94 C72 98 56 80 50 80 C44 80 28 98 22 94 C16 90 28 72 28 66 C26 60 4 50 6 44 C8 38 32 40 38 36 C42 30 44 8 50 8 Z" fill="${c}"/><g fill="#fff" opacity=".55"><circle cx="50" cy="30" r="2.5"/><circle cx="72" cy="46" r="2.5"/><circle cx="62" cy="70" r="2.5"/><circle cx="38" cy="70" r="2.5"/><circle cx="28" cy="46" r="2.5"/></g>`),
  persimmon: (c = '#f08a3c') => svg('0 0 100 100', `<ellipse cx="50" cy="58" rx="38" ry="34" fill="${c}"/><ellipse cx="34" cy="52" rx="7" ry="11" fill="#fff" opacity=".3"/><path d="M50 30 L36 22 L44 34 L28 36 L44 40 L50 46 L56 40 L72 36 L56 34 L64 22 Z" fill="#6b8a3a" stroke="#6b8a3a" stroke-width="2" stroke-linejoin="round"/><path d="M50 30 L50 18" stroke="#7a4a24" stroke-width="4" stroke-linecap="round"/>`),
  dragonfly: (c = '#9fc8e8') => svg('0 0 100 100', `<g fill="${c}" opacity=".85"><ellipse cx="30" cy="30" rx="26" ry="8" transform="rotate(-20 30 30)"/><ellipse cx="70" cy="30" rx="26" ry="8" transform="rotate(20 70 30)"/><ellipse cx="32" cy="44" rx="22" ry="7" transform="rotate(10 32 44)"/><ellipse cx="68" cy="44" rx="22" ry="7" transform="rotate(-10 68 44)"/></g><circle cx="50" cy="26" r="7" fill="#7a5aa6"/><rect x="46" y="30" width="8" height="64" rx="4" fill="#9a6ac0"/>`),
  cosmos: (c = '#ea8fc0', center = '#f6c443') => svg('0 0 100 100', `<g fill="${c}">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M50 50 C40 34 40 12 50 6 C60 12 60 34 50 50 Z" transform="rotate(${a} 50 50)"/>`).join('')}</g><g stroke="#fff" stroke-opacity=".45" stroke-width="2">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M50 40 L50 16" transform="rotate(${a} 50 50)"/>`).join('')}</g><circle cx="50" cy="50" r="10" fill="${center}"/>`),
  chestnut: () => svg('0 0 100 100', `<path d="M50 10 C64 22 88 44 88 64 C88 84 70 94 50 94 C30 94 12 84 12 64 C12 44 36 22 50 10 Z" fill="#8a5232"/><path d="M14 66 C28 74 72 74 86 66 C86 84 70 94 50 94 C30 94 14 84 14 66 Z" fill="#d8b48a"/><ellipse cx="38" cy="44" rx="6" ry="12" transform="rotate(25 38 44)" fill="#fff" opacity=".25"/>`),
  mitten: (c = '#d9534f', cuff = '#ffffff') => svg('0 0 80 100', `<path d="M22 66 L20 26 C20 12 30 6 40 6 C52 6 60 14 60 28 L60 40 C66 34 76 36 76 44 C76 52 66 58 60 64 L60 66 Z" fill="${c}"/><rect x="16" y="64" width="48" height="26" rx="6" fill="${cuff}" stroke="#d6d6d6" stroke-width="2"/><g fill="#fff" opacity=".7"><circle cx="34" cy="30" r="3"/><circle cx="46" cy="40" r="3"/><circle cx="32" cy="50" r="3"/></g>`),
  moon: (c = '#f6d77a') => svg('0 0 100 100', `<circle cx="50" cy="50" r="40" fill="${c}"/><g fill="#e8c35c" opacity=".7"><circle cx="36" cy="40" r="7"/><circle cx="60" cy="62" r="9"/><circle cx="62" cy="34" r="4"/></g>`),

  // ───── 1월 · 새해 눈 ─────
  snowman: () => svg('0 0 120 150', `
    <circle cx="60" cy="104" r="40" fill="#fff" stroke="#c9dbe8" stroke-width="3"/>
    <circle cx="60" cy="52" r="27" fill="#fff" stroke="#c9dbe8" stroke-width="3"/>
    <rect x="38" y="16" width="44" height="8" rx="3" fill="#4a5a7a"/><rect x="45" y="0" width="30" height="20" rx="3" fill="#4a5a7a"/><rect x="45" y="12" width="30" height="5" fill="#d9534f"/>
    <circle cx="51" cy="48" r="3.2" fill="#3a3a3a"/><circle cx="69" cy="48" r="3.2" fill="#3a3a3a"/>
    <path d="M60 56 L78 60 L60 63 Z" fill="#f29a48"/>
    <path d="M36 74 C52 82 70 82 86 74 L86 84 C70 92 52 92 36 84 Z" fill="#d9534f"/><path d="M74 82 L80 106 L70 106 L68 84 Z" fill="#c4413d"/>
    <g fill="#4a5a7a"><circle cx="60" cy="98" r="3.4"/><circle cx="60" cy="112" r="3.4"/></g>
    <path d="M24 92 L4 76 M10 80 L4 86 M96 92 L116 76 M110 80 L116 86" stroke="#8a5a33" stroke-width="3.4" stroke-linecap="round"/>`),

  // ───── 2월 · 사랑 ─────
  letter: () => svg('0 0 140 100', `
    <rect x="6" y="20" width="128" height="76" rx="6" fill="#fff6f0" stroke="#e5b9a8" stroke-width="3"/>
    <path d="M8 24 L70 66 L132 24" stroke="#e5b9a8" stroke-width="3" fill="none" stroke-linejoin="round"/>
    <path d="M8 94 L56 58 M132 94 L84 58" stroke="#e5b9a8" stroke-width="2.4" fill="none"/>
    <path d="M70 72 C54 60 46 52 46 42 C46 34 52 28 59 28 C64 28 68 31 70 36 C72 31 76 28 81 28 C88 28 94 34 94 42 C94 52 86 60 70 72 Z" fill="#e46f86"/>
    <path d="M104 14 C98 9 96 6 96 3 C96 1 98 0 100 0 C101 0 103 1 104 3 C105 1 107 0 108 0 C110 0 112 1 112 3 C112 6 110 9 104 14 Z" fill="#f2a1b1" transform="translate(8 4) scale(1.6)"/>`),
  mug: () => svg('0 0 120 120', `
    <path d="M44 34 C38 26 50 20 44 10 M62 34 C56 26 68 20 62 10 M80 34 C74 26 86 20 80 10" stroke="#d6c2b4" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M86 58 C104 56 108 82 88 86" stroke="#d97c93" stroke-width="8" fill="none"/>
    <path d="M24 42 L94 42 L88 104 C88 110 84 114 78 114 L40 114 C34 114 30 110 30 104 Z" fill="#d97c93"/>
    <path d="M24 42 L94 42 L93 50 L25 50 Z" fill="#8a5a3c"/>
    <path d="M59 92 C49 85 44 80 44 74 C44 69 48 66 52 66 C55 66 58 68 59 71 C60 68 63 66 66 66 C70 66 74 69 74 74 C74 80 69 85 59 92 Z" fill="#fff"/>`),

  // ───── 3월 · 봄 새싹 ─────
  wateringCan: () => svg('0 0 150 110', `
    <path d="M36 40 C36 22 74 22 74 40" stroke="#4f9ac6" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M22 44 L90 44 L86 102 C86 106 82 108 78 108 L34 108 C30 108 26 106 26 102 Z" fill="#7cc0e3"/>
    <path d="M88 82 L128 46 L134 52 L94 92 Z" fill="#7cc0e3"/><rect x="124" y="36" width="16" height="20" rx="4" transform="rotate(45 132 46)" fill="#4f9ac6"/>
    <path d="M22 44 L90 44 L89 52 L23 52 Z" fill="#4f9ac6"/>
    <g fill="#9fd0ea"><circle cx="142" cy="66" r="3"/><circle cx="136" cy="76" r="3"/><circle cx="146" cy="80" r="2.6"/></g>
    <path d="M40 70 C48 62 56 76 64 68" stroke="#fff" stroke-opacity=".6" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  flowerPot: () => svg('0 0 120 150', `
    <path d="M60 92 L60 52 M60 70 C44 62 40 48 42 38 M60 74 C76 66 80 52 78 42" stroke="#5f9a3a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M60 88 C44 86 36 74 38 64 C50 66 58 76 60 88 Z M60 84 C74 82 82 72 82 62 C70 64 62 72 60 84 Z" fill="#8cc152"/>
    <path d="M48 32 L52 40 L60 26 L68 40 L72 32 C76 46 70 56 60 58 C50 56 44 46 48 32 Z" fill="#f08080"/>
    <path d="M30 22 L34 30 L42 18 L50 30 L52 24 C54 36 48 44 41 44 C34 44 28 34 30 22 Z" fill="#f6cf6b"/>
    <path d="M70 26 L74 34 L82 22 L90 34 L92 28 C94 40 88 48 81 48 C74 48 68 38 70 26 Z" fill="#c9a0dc"/>
    <path d="M22 96 L98 96 L90 146 L30 146 Z" fill="#d98a5a"/><rect x="18" y="90" width="84" height="14" rx="4" fill="#c2703f"/>`),

  // ───── 4월 · 부활절 ─────
  eggBasket: () => svg('0 0 160 120', `
    <path d="M30 56 C30 8 130 8 130 56" stroke="#c9a46a" stroke-width="7" fill="none" stroke-linecap="round"/>
    <g transform="translate(34 18) scale(.42)"><path d="M40 6 C62 6 76 44 76 62 C76 84 60 96 40 96 C20 96 4 84 4 62 C4 44 18 6 40 6 Z" fill="#9fd3e6"/><path d="M6 52 L16 44 L26 52 L36 44 L46 52 L56 44 L66 52 L75 45" stroke="#fff" stroke-width="5" fill="none"/></g>
    <g transform="translate(60 10) scale(.46) rotate(-8 40 50)"><path d="M40 6 C62 6 76 44 76 62 C76 84 60 96 40 96 C20 96 4 84 4 62 C4 44 18 6 40 6 Z" fill="#f6cf6b"/><g fill="#fff"><circle cx="24" cy="60" r="5"/><circle cx="40" cy="70" r="5"/><circle cx="56" cy="60" r="5"/><circle cx="40" cy="44" r="5"/></g></g>
    <g transform="translate(90 18) scale(.42) rotate(10 40 50)"><path d="M40 6 C62 6 76 44 76 62 C76 84 60 96 40 96 C20 96 4 84 4 62 C4 44 18 6 40 6 Z" fill="#f2a1b1"/><path d="M5 60 L75 60" stroke="#fff" stroke-width="7"/></g>
    <g transform="translate(16 30) scale(.36) rotate(-14 40 50)"><path d="M40 6 C62 6 76 44 76 62 C76 84 60 96 40 96 C20 96 4 84 4 62 C4 44 18 6 40 6 Z" fill="#b9a0dc"/></g>
    <g transform="translate(112 28) scale(.38) rotate(16 40 50)"><path d="M40 6 C62 6 76 44 76 62 C76 84 60 96 40 96 C20 96 4 84 4 62 C4 44 18 6 40 6 Z" fill="#a6d36a"/></g>
    <path d="M18 58 L142 58 L130 112 C128 117 124 118 118 118 L42 118 C36 118 32 117 30 112 Z" fill="#e0b97c"/>
    <path d="M18 58 L142 58 L140 68 L20 68 Z" fill="#c9a46a"/>
    <g stroke="#c9a46a" stroke-width="2.2" opacity=".75"><path d="M24 84 L136 84 M28 100 L132 100"/><path d="M50 68 L52 116 M74 68 L75 118 M98 68 L97 118 M120 68 L116 116"/></g>`),
  lily: () => svg('0 0 120 160', `
    <path d="M60 158 L60 70 M60 110 C46 92 36 80 34 62 M60 96 C74 82 84 70 88 52" stroke="#5f9a3a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M60 150 C40 144 30 128 32 112 C46 118 56 132 60 150 Z M60 140 C78 136 90 122 90 106 C76 110 64 124 60 140 Z" fill="#8cc152"/>
    <g fill="#fff" stroke="#d7d0bf" stroke-width="2" stroke-linejoin="round">
      <path d="M34 62 L16 40 L24 38 L22 26 L32 36 L38 22 L42 38 L52 34 L46 46 Z"/>
      <path d="M88 52 L80 26 L88 28 L92 14 L96 28 L106 22 L102 36 L114 38 L98 48 Z"/>
      <path d="M60 72 L48 48 L56 48 L56 34 L62 46 L70 36 L70 50 L80 52 L66 62 Z"/></g>
    <g fill="#f2c443"><circle cx="30" cy="34" r="2.4"/><circle cx="95" cy="26" r="2.4"/><circle cx="62" cy="44" r="2.4"/></g>`),

  // ───── 5월 · 가정의 달 ─────
  bouquet: () => svg('0 0 140 150', `
    <g transform="translate(14 8)"><path d="M40 128 L40 50" stroke="#5f9a3a" stroke-width="4"/><path d="M14 30 L22 22 L26 30 L34 18 L40 28 L46 18 L54 30 L58 22 L66 30 L62 40 C56 52 24 52 18 40 Z" fill="#e8607a"/></g>
    <g transform="translate(46 0)"><path d="M40 128 L40 50" stroke="#5f9a3a" stroke-width="4"/><path d="M14 30 L22 22 L26 30 L34 18 L40 28 L46 18 L54 30 L58 22 L66 30 L62 40 C56 52 24 52 18 40 Z" fill="#f29ab0"/></g>
    <g transform="translate(30 20)"><path d="M40 128 L40 50" stroke="#5f9a3a" stroke-width="4"/><path d="M14 30 L22 22 L26 30 L34 18 L40 28 L46 18 L54 30 L58 22 L66 30 L62 40 C56 52 24 52 18 40 Z" fill="#d94a64"/></g>
    <path d="M36 92 L104 92 L80 148 L60 148 Z" fill="#fbe9c8" stroke="#e8cf9f" stroke-width="2"/>
    <path d="M52 112 C60 104 70 104 70 112 C70 104 80 104 88 112 C80 118 74 118 70 114 C66 118 60 118 52 112 Z" fill="#e46f86"/>
    <path d="M70 114 L60 132 M70 114 L80 132" stroke="#e46f86" stroke-width="3" stroke-linecap="round"/>`),
  balloons: () => svg('0 0 120 160', `
    <path d="M30 70 C34 100 52 120 60 158 M60 66 C60 100 60 120 60 158 M92 76 C86 104 66 122 60 158" stroke="#a0a0a0" stroke-width="1.6" fill="none"/>
    <path d="M30 4 C46 4 54 18 54 32 C54 50 40 62 30 64 C20 62 6 50 6 32 C6 18 14 4 30 4 Z" fill="#e8607a"/><path d="M27 64 L33 64 L30 70 Z" fill="#e8607a"/>
    <path d="M60 0 C76 0 84 14 84 28 C84 46 70 58 60 60 C50 58 36 46 36 28 C36 14 44 0 60 0 Z" fill="#f6c443"/><path d="M57 60 L63 60 L60 66 Z" fill="#f6c443"/>
    <path d="M92 12 C108 12 116 26 116 40 C116 58 102 70 92 72 C82 70 68 58 68 40 C68 26 76 12 92 12 Z" fill="#7cc0e3"/><path d="M89 72 L95 72 L92 78 Z" fill="#7cc0e3"/>
    <g fill="#fff" opacity=".4"><ellipse cx="20" cy="22" rx="4" ry="8"/><ellipse cx="50" cy="18" rx="4" ry="8"/><ellipse cx="82" cy="30" rx="4" ry="8"/></g>`),

  // ───── 6월 · 비와 무지개 ─────
  umbrella: (c = '#5bb3a5') => svg('0 0 120 130', `
    <path d="M60 8 C28 8 6 32 4 58 C14 50 24 50 32 58 C40 50 52 50 60 58 C68 50 80 50 88 58 C96 50 106 50 116 58 C114 32 92 8 60 8 Z" fill="${c}"/>
    <path d="M60 8 C48 24 44 40 46 56 M60 8 C72 24 76 40 74 56" stroke="#fff" stroke-opacity=".5" stroke-width="2.4" fill="none"/>
    <path d="M60 4 L60 10" stroke="#3a6a64" stroke-width="4" stroke-linecap="round"/>
    <path d="M60 56 L60 112 C60 122 46 122 46 112" stroke="#3a6a64" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g fill="#7fb8e0"><path d="M20 80 C24 88 28 92 28 96 C28 100 24 102 20 102 C16 102 12 100 12 96 C12 92 16 88 20 80 Z"/><path d="M98 76 C102 84 106 88 106 92 C106 96 102 98 98 98 C94 98 90 96 90 92 C90 88 94 84 98 76 Z"/><path d="M84 108 C87 114 90 117 90 120 C90 123 87 125 84 125 C81 125 78 123 78 120 C78 117 81 114 84 108 Z"/></g>`),
  rainbow: () => svg('0 0 160 100', `
    <g fill="none" stroke-width="9" stroke-linecap="round">
      <path d="M14 92 C14 40 146 40 146 92" stroke="#f08080"/>
      <path d="M24 92 C24 52 136 52 136 92" stroke="#f6c443"/>
      <path d="M34 92 C34 64 126 64 126 92" stroke="#8cc152"/>
      <path d="M44 92 C44 74 116 74 116 92" stroke="#7cc0e3"/></g>
    <path d="M2 94 C-2 80 16 72 24 80 C28 70 44 72 44 84 C52 84 54 94 46 98 L6 98 C2 98 2 96 2 94 Z" fill="#fff" stroke="#c9dbe8" stroke-width="2.4"/>
    <path d="M116 94 C112 80 130 72 138 80 C142 70 158 72 158 84 C162 86 162 96 156 98 L120 98 C116 98 116 96 116 94 Z" fill="#fff" stroke="#c9dbe8" stroke-width="2.4"/>`),

  // ───── 7월 · 여름 바다 ─────
  whale: () => svg('0 0 160 110', `
    <path d="M70 22 C66 12 58 8 52 10 M70 22 C74 12 82 8 88 10 M70 22 L70 32" stroke="#7cc0e3" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M14 66 C14 42 40 32 70 32 C102 32 120 50 126 66 C134 58 144 48 156 46 C152 58 150 66 156 80 C144 78 134 74 128 72 C122 92 98 100 70 100 C36 100 14 88 14 66 Z" fill="#4f9ac6"/>
    <path d="M18 74 C30 92 60 98 90 94 C108 92 120 84 126 74 C110 84 60 88 18 74 Z" fill="#cfe7f4"/>
    <circle cx="40" cy="58" r="4" fill="#24445a"/><path d="M30 70 C34 74 40 74 44 70" stroke="#24445a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <ellipse cx="54" cy="66" rx="6" ry="3" fill="#f2a1b1" opacity=".7"/>
    <path d="M2 104 C14 96 26 112 40 104 C54 96 66 112 80 104 C94 96 106 112 120 104 C134 96 146 112 158 104" stroke="#9fd0ea" stroke-width="4" fill="none" stroke-linecap="round"/>`),
  sailboat: () => svg('0 0 120 120', `
    <path d="M60 8 L60 80" stroke="#8a5a33" stroke-width="4"/>
    <path d="M62 12 L104 74 L62 74 Z" fill="#fff" stroke="#c9dbe8" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M58 24 L22 74 L58 74 Z" fill="#f08080"/>
    <path d="M60 8 L80 14 L60 20 Z" fill="#f6c443"/>
    <path d="M14 82 L106 82 L92 100 L28 100 Z" fill="#d98a5a"/>
    <path d="M4 108 C16 100 28 116 42 108 C56 100 68 116 82 108 C96 100 106 116 118 108" stroke="#7cc0e3" stroke-width="4" fill="none" stroke-linecap="round"/>`),

  // ───── 8월 · 한여름 ─────
  watermelon: () => svg('0 0 150 100', `
    <path d="M6 14 L144 14 C144 54 114 94 75 94 C36 94 6 54 6 14 Z" fill="#5fa84a"/>
    <path d="M14 14 L136 14 C136 48 110 84 75 84 C40 84 14 48 14 14 Z" fill="#e9f5d6"/>
    <path d="M20 14 L130 14 C130 44 106 78 75 78 C44 78 20 44 20 14 Z" fill="#f0606a"/>
    <g fill="#3a2a2a"><ellipse cx="50" cy="32" rx="3" ry="5"/><ellipse cx="75" cy="40" rx="3" ry="5"/><ellipse cx="100" cy="32" rx="3" ry="5"/><ellipse cx="62" cy="56" rx="3" ry="5"/><ellipse cx="88" cy="56" rx="3" ry="5"/><ellipse cx="38" cy="22" rx="2.6" ry="4.4"/><ellipse cx="112" cy="22" rx="2.6" ry="4.4"/></g>`),
  sunflower: () => svg('0 0 110 160', `
    <path d="M55 156 L55 70" stroke="#5f9a3a" stroke-width="5" stroke-linecap="round"/>
    <path d="M55 130 C36 128 24 114 24 100 C40 102 52 114 55 130 Z M55 112 C72 108 84 96 86 82 C70 84 58 96 55 112 Z" fill="#8cc152"/>
    <g fill="#f6c443">${Array.from({ length: 14 }, (_, i) => `<ellipse cx="55" cy="18" rx="8" ry="16" transform="rotate(${i * (360 / 14)} 55 48)"/>`).join('')}</g>
    <circle cx="55" cy="48" r="18" fill="#8a5a33"/>
    <g fill="#6b4226">${[[-8, -6], [0, -9], [8, -6], [-10, 2], [0, 0], [10, 2], [-6, 9], [6, 9]].map(([x, y]) => `<circle cx="${55 + x}" cy="${48 + y}" r="2.2"/>`).join('')}</g>`),

  // ───── 9월 · 추석 보름달 ─────
  moonNight: () => svg('0 0 160 120', `
    <circle cx="80" cy="54" r="46" fill="#f6d77a"/>
    <g fill="#e8c35c" opacity=".7"><circle cx="64" cy="42" r="8"/><circle cx="94" cy="66" r="10"/><circle cx="98" cy="34" r="5"/></g>
    <path d="M4 104 C0 88 20 80 30 88 C34 76 54 76 56 90 C66 88 72 100 64 108 L10 108 C6 108 4 106 4 104 Z" fill="#fff" stroke="#c9d0e8" stroke-width="2.6"/>
    <path d="M96 98 C92 84 110 76 120 84 C124 72 146 74 148 88 C158 88 160 100 152 106 L102 106 C98 106 96 102 96 98 Z" fill="#fff" stroke="#c9d0e8" stroke-width="2.6"/>
    <g fill="#f6d77a"><path d="M18 18 L20 24 L26 26 L20 28 L18 34 L16 28 L10 26 L16 24 Z"/><path d="M146 22 L148 27 L153 29 L148 31 L146 36 L144 31 L139 29 L144 27 Z"/></g>`),
  persimmonBranch: () => svg('0 0 140 120', `
    <path d="M4 20 C40 22 80 30 136 14" stroke="#7a4a24" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M40 24 L40 40 M84 26 L86 54 M118 18 L118 34" stroke="#7a4a24" stroke-width="3" stroke-linecap="round"/>
    <path d="M22 22 C14 6 30 0 36 10 C36 18 30 22 22 22 Z M62 28 C60 12 76 10 78 22 C74 28 68 30 62 28 Z M100 20 C102 4 120 4 118 16 C112 22 106 22 100 20 Z" fill="#8cbf5f"/>
    <g transform="translate(20 34) scale(.42)"><ellipse cx="50" cy="58" rx="38" ry="34" fill="#f08a3c"/><path d="M50 30 L36 22 L44 34 L28 36 L44 40 L50 46 L56 40 L72 36 L56 34 L64 22 Z" fill="#6b8a3a"/></g>
    <g transform="translate(62 46) scale(.5)"><ellipse cx="50" cy="58" rx="38" ry="34" fill="#ef7e2e"/><ellipse cx="34" cy="52" rx="7" ry="11" fill="#fff" opacity=".3"/><path d="M50 30 L36 22 L44 34 L28 36 L44 40 L50 46 L56 40 L72 36 L56 34 L64 22 Z" fill="#6b8a3a"/></g>
    <g transform="translate(98 28) scale(.42)"><ellipse cx="50" cy="58" rx="38" ry="34" fill="#f29a48"/><path d="M50 30 L36 22 L44 34 L28 36 L44 40 L50 46 L56 40 L72 36 L56 34 L64 22 Z" fill="#6b8a3a"/></g>`),

  // ───── 10월 · 코스모스와 말씀 ─────
  cosmosBunch: () => svg('0 0 140 150', `
    <path d="M30 148 C30 110 34 80 40 50 M70 148 C70 110 66 70 70 30 M106 148 C104 118 102 92 106 66" stroke="#5f9a3a" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M34 120 C24 112 22 100 26 94 M72 110 C82 102 84 90 80 84 M104 126 C114 118 118 108 114 100" stroke="#8cc152" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    ${[[40, 44, '#ea8fc0', 0.5], [70, 26, '#c46bb0', 0.56], [106, 62, '#f2b6d6', 0.46]].map(([x, y, c, s]) => `<g transform="translate(${x - 50 * s} ${y - 50 * s}) scale(${s})"><g fill="${c}">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M50 50 C40 34 40 12 50 6 C60 12 60 34 50 50 Z" transform="rotate(${a} 50 50)"/>`).join('')}</g><circle cx="50" cy="50" r="10" fill="#f6c443"/></g>`).join('')}`),
  bible: () => svg('0 0 140 100', `
    <path d="M70 22 C52 10 26 8 8 14 L8 88 C26 82 52 84 70 96 C88 84 114 82 132 88 L132 14 C114 8 88 10 70 22 Z" fill="#8a5a3c"/>
    <path d="M70 20 C54 10 32 8 14 12 L14 82 C32 78 54 80 70 90 Z" fill="#fffaf0"/>
    <path d="M70 20 C86 10 108 8 126 12 L126 82 C108 78 86 80 70 90 Z" fill="#fff5e6"/>
    <path d="M70 20 L70 90" stroke="#e0cfb4" stroke-width="2"/>
    <g stroke="#e0cfb4" stroke-width="2.2" stroke-linecap="round"><path d="M24 34 L58 36 M24 46 L58 48 M24 58 L58 60 M24 70 L50 71"/></g>
    <path d="M98 30 L98 66 M86 42 L110 42" stroke="#c9a04a" stroke-width="5" stroke-linecap="round"/>
    <path d="M70 90 L66 100 L70 97 L74 100 Z" fill="#d9534f"/>`),
};

// 미리보기 목록에 쓰는 이름
export const ART_NAMES = Object.keys(ART);
