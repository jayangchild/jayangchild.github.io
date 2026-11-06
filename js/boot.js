// 열 때마다 화면 파일이 바뀌었는지 서버에 물어본 뒤 앱을 연다 (personal-hub 의 boot.js 와 같다).
// GitHub Pages는 파일을 10분 동안 브라우저에 그대로 두라고 해서, 이게 없으면 고친 화면이 늦게 보인다.
// no-cache = 바뀌었을 때만 새로 받음. 오프라인이면 갖고 있는 것으로 연다.
const FILES = [
  'js/app.js', 'js/ui.js', 'js/store.js', 'js/idb.js', 'js/schemas.js', 'js/gate.js', 'js/settings.js',
  'js/core/index.js', 'js/core/core.js', 'js/core/crypto.js', 'js/core/github.js', 'js/core/merge.js',
  'js/core/kv.js', 'js/core/image.js', 'js/core/qrcode.js',
  'js/pilsa/extract.js', 'js/pilsa/art.js', 'js/pilsa/themes.js', 'js/pilsa/sheet.js',
  'js/pilsa/make.js', 'js/pilsa/design.js', 'js/pilsa/print.js', 'js/pilsa/preview.js',
  'js/core/access.js', 'js/core/access-ui.js',
  'js/modules/site-access.js', 'js/modules/access-env.js', 'js/modules/ctx.js', 'js/modules/menus.js', 'js/modules/kit.js',
  'js/modules/home.js', 'js/modules/roster.js', 'js/modules/talent.js', 'js/modules/plan.js', 'js/modules/docs.js',
  'js/modules/files-view.js', 'js/modules/media.js', 'js/modules/gifts.js', 'js/modules/admin.js', 'js/modules/trash.js',
];
const CSS = ['style.css', 'css/sheet.css'];

const css = CSS.map((f) => fetch(f, { cache: 'no-cache' }).catch(() => null));
await Promise.all(FILES.map((f) => fetch(f, { cache: 'no-cache' }).catch(() => null)));

// 스타일은 이미 붙어 있으니, 새 판(ETag)으로 하나 더 붙였다가 다 받으면 옛것을 뗀다 (깜빡임 없이)
for (let i = 0; i < CSS.length; i++) {
  const tag = (await css[i])?.headers.get('etag')?.replace(/\W/g, '');
  const old = document.querySelector(`link[rel=stylesheet][href="${CSS[i]}"]`);
  if (tag && old) {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `${CSS[i]}?v=${tag}` });
    link.onload = () => old.remove();
    old.after(link);
  }
}

await import('./app.js');
