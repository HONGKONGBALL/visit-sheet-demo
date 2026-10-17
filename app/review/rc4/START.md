# Start

Project start (Node.js 22 LTS or newer):

```bash
npm install
npm run seed
npm start
```

Optional `PORT` (default 3000). Login: `demo@visitsheet.example` / `demo-pass-48`, or press **Fill in the demo login**.

Evidence server for rc4, started with Node v22.23.3 because the system `node` is v20 and cannot load the local `better-sqlite3` binary. The database is temporary and is not the repo database.

```bash
DB_PATH=/tmp/vs-rc4/visitsheet.db PORT=3788 /tmp/node22/node_modules/node/bin/node server.js
```

Port used for evidence: **3788** (`http://127.0.0.1:3788`).

Verifier (defaults match that server and this evidence directory):

```bash
/tmp/hrl-review/tools/bin/python3 scripts/verify.py
```

`VISITSHEET_BASE` defaults to `http://127.0.0.1:3788`. `VISITSHEET_EVIDENCE` defaults to `/workspace/visit-sheet-rc3/review/rc4/evidence`.

Tests:

```bash
/tmp/node22/node_modules/node/bin/node --test tests/qa.test.js
```
