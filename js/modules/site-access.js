// 이 사이트의 역할표와 access 하나 (js/core/access.js — 명세 js/core/ACCESS-SPEC.md, 사용법 js/core/README.md)
//   공개 → 학부모 → 선생님 → 임원(쓰기, 직분 부장·부감·총무·회계·서기) → 관리자(쓰기)
import { createAccess } from '../core/access.js';
import env from './access-env.js';

export const ROLES = [
  { id: 'public' },
  { id: 'parent', inherits: ['public'] },
  { id: 'teacher', inherits: ['parent'] },
  { id: 'officer', inherits: ['teacher'], write: true, labels: ['부장', '부감', '총무', '회계', '서기'] },
  { id: 'admin', inherits: ['officer'], write: true },
];
export const ROLE_IDS = ROLES.map((r) => r.id);
export const LABELS = ROLES.find((r) => r.id === 'officer').labels;

// 사이트 주소: 실제로는 https://jayangchild.github.io/ (지금 열린 주소를 쓰므로 시험 서버에서도 같은 코드)
const here = location.origin + location.pathname.replace(/[^/]*$/, '');

export const CONFIG = {
  site: 'jayangchild',
  title: '자양교회 유년부',
  owner: 'jayangchild',
  repo: 'jayangchild.github.io',
  branch: 'main',
  siteUrl: env.siteUrl || here,
  roles: ROLES,
  files: { repos: true, prefix: 'jayangchild-files', limit: 900e6 },
};

export const access = createAccess(CONFIG, env.opts || {});
export const roles = access.roles;
export const ROLE_NAME = Object.fromEntries(ROLE_IDS.map((id) => [id, roles.name(id)]));
export const reaches = (role, need) => roles.closure(role || 'public').includes(need);
// 둘 중 더 높은 역할 (이 사이트는 한 줄로 이어져 있다)
export const higher = (a, b) => (ROLE_IDS.indexOf(a) >= ROLE_IDS.indexOf(b) ? a : b);
export const lower = (a, b) => (ROLE_IDS.indexOf(a) <= ROLE_IDS.indexOf(b) ? a : b);
