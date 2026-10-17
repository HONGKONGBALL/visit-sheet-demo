# VisitSheet Demo (deploy repo)

Public deploy scaffolding for **VisitSheet** at a fixed product commit.  
Product source lives in [`HONGKONGBALL/visit-sheet`](https://github.com/HONGKONGBALL/visit-sheet). This repo vendors that exact tree under `app/` and adds hosting files only.

**Pinned commit:** see [`COMMIT.txt`](./COMMIT.txt)  
Expected: `4f160f94fa5e77bce577023317f3ef1c88ddbded` (rc6)

## Demo login (fictional)

| Who | Email | Password |
|---|---|---|
| Robin Sample | `demo@visitsheet.example` | `demo-pass-48` |

VisitSheet organizes your own notes. It is not medical advice. All demo data is fictional.

## Quick start (local)

```bash
cd app
npm ci
npm run seed
npm start
```

Open http://localhost:3000 — optional `PORT` env (default `3000`).

## Deploy

### Render (recommended free web service)

1. New → Web Service → connect this repo.
2. Use **Docker** (uses `Dockerfile`) or Blueprint (`render.yaml`).
3. Free plan: service sleeps after idle; first request may be slow.

Or with Render Blueprint: New → Blueprint → select this repo.

### Docker

```bash
docker build -t visit-sheet-demo .
docker run --rm -p 3000:3000 -e PORT=3000 visit-sheet-demo
```

### Other Node hosts

`Procfile` / root `package.json` run `npm start` in `app/` after `postinstall` seeds the DB. Prefer Docker so `better-sqlite3` native builds are reliable.

## Layout

```
COMMIT.txt          # exact product git SHA
Dockerfile          # Node 22 + seed + start
render.yaml         # Render free web service
Procfile            # web: npm start
package.json        # root helpers for non-Docker Node hosts
app/                # vendored product tree (do not treat as canonical)
```

Do not change product behavior here. Update by re-vendoring a new commit from `HONGKONGBALL/visit-sheet` and refreshing `COMMIT.txt`.
