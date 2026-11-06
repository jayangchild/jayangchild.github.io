// 시험용 가짜 GitHub (메모리). 인터넷 없이 core.js 를 시험할 때 쓴다 (core-test.html).
//   const repo = new FakeRepo(['tok-1']);          // 쓸 수 있는 토큰 목록
//   createCore({ backend: (token) => repo.client(token), ... })
//   repo.online = false        → 모든 요청이 status 0 (인터넷 없음)
//   repo.revoke('tok-1')       → 그 토큰은 401
//   repo.beforePut = async (path) => { … }   → 올리기 직전에 끼어들기 (동시에 고치기 흉내)

import { BackendError } from './github.js';

export class FakeRepo {
  constructor(tokens = []) {
    this.files = new Map(); // path → { sha, bytes }
    this.tokens = new Set(tokens);
    this.online = true;
    this.n = 0;
    this.log = []; // [method, path]
    this.beforePut = null;
    this.conflicts = 0; // 409/422 를 돌려준 횟수
  }

  addToken(t) { this.tokens.add(t); }
  revoke(t) { this.tokens.delete(t); }

  client(token) {
    const repo = this;
    const gate = async () => {
      await new Promise(r => setTimeout(r, 0));
      if (!repo.online) throw new BackendError(0, '인터넷에 연결되어 있지 않아요.');
      if (!repo.tokens.has(token)) throw new BackendError(401, '토큰이 틀렸거나 만료되었어요.');
    };
    return {
      token,
      async check() { await gate(); return { branch: 'main' }; },
      async tree() {
        await gate();
        repo.log.push(['tree']);
        return [...repo.files].map(([path, f]) => ({ path, sha: f.sha }));
      },
      async get(path) {
        await gate();
        repo.log.push(['get', path]);
        const f = repo.files.get(path);
        return f ? { sha: f.sha, bytes: f.bytes.slice() } : null;
      },
      async put(path, bytes, sha) {
        await gate();
        if (repo.beforePut) { const h = repo.beforePut; repo.beforePut = null; await h(path); }
        repo.log.push(['put', path]);
        const cur = repo.files.get(path);
        if (cur && !sha) { repo.conflicts++; throw new BackendError(422, '"sha" wasn\'t supplied'); }
        if ((cur?.sha || null) !== (sha || null)) { repo.conflicts++; throw new BackendError(409, `${path} does not match ${sha}`); }
        const nsha = `sha${++repo.n}`;
        repo.files.set(path, { sha: nsha, bytes: bytes.slice() });
        return nsha;
      },
    };
  }
}
