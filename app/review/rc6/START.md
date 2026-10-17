# Start

Project start (Node.js 22 LTS or newer):

```bash
npm install
npm run seed
npm start
```

Optional `PORT` (default 3000). Login: `demo@visitsheet.example` / `demo-pass-48`, or press **Fill in the demo login**.

The Node 22 binary used for the rc6 test logs is `/tmp/node22/node_modules/node/bin/node` (v22.23.3). System `node` is v20 and did not run the suite. `npm test` is `node --test tests/qa.test.js`.

This round did not run `scripts/verify.py` and did not start a server. Product files are unchanged versus rc5 and versus rc4, so the rc4 browser, PDF, and screenshot evidence stays valid.
