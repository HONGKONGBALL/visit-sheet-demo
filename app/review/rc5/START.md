# Start

Project start (Node.js 22 LTS or newer):

```bash
npm install
npm run seed
npm start
```

Optional `PORT` (default 3000). Login: `demo@visitsheet.example` / `demo-pass-48`, or press **Fill in the demo login**.

The rc4 evidence server and `scripts/verify.py` were not re-run. Product files did not change versus rc4, so the rc4 browser, PDF, and screenshot evidence stays valid. That server, recorded in `review/rc4/START.md`, was:

```bash
DB_PATH=/tmp/vs-rc4/visitsheet.db PORT=3788 /tmp/node22/node_modules/node/bin/node server.js
```

Tests (Node 22). System `node` is v20 and must not run this suite. Put the Node 22 binary first on `PATH`, then:

```bash
npm test
```

`npm test` is `node --test tests/qa.test.js`. The binary used for the rc5 logs is `/tmp/node22/node_modules/node/bin/node` (v22.23.3).
