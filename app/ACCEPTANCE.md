# VisitSheet rc6 acceptance contract

Goal: ship local candidate `rc6` on top of rc5. rc5 tag and HEAD are `4e8361a13dc0a64a3514e593e21fa13271a86727`. The rc5 product and tests commit is `dcb7898d91f377d140955d36db9e2ad675f67dd6`. Parent rc4 is `d28833329ecf9e351bbafff66986c979921c03a2`.

The product contract stays v1. The product source is `/workspace/pipeline/healthhack/idea.md`. Where `prd.md` or `qa.md` disagree with `idea.md`, `idea.md` wins (one fictional account, dates counted from the login day, a private sandbox per login, Display works before login). Do not invent new product requirements. This round does not change product code.

This round does not deploy, push, or submit.

## Core flows that must still close

These are the v1 flows. They stay closed because `src/`, `views/`, `public/`, `server.js`, `package.json`, and `package-lock.json` do not change versus rc5 (and therefore versus rc4).

1. Login with **Fill in the demo login** (`demo@visitsheet.example` / `demo-pass-48`) creates a private sandbox. The dashboard shows the next visit in 7 days.
2. **Make my brief** shows the access card, the top-three box, notes, medicines, and the disclaimer. Print preview of the normal brief is one Letter page and one A4 page. The large-print brief is two Letter pages and two A4 pages.
3. On the visit, **Up** moves a question into the top three. **Add to this visit** carries over an unasked question from the earlier visit.
4. **Display** saves large text and high contrast in the `vs_display` cookie. The choice applies before login and remains after logout.
5. Error paths still render the app error page with the disclaimer and no stack or filesystem path: empty login, wrong password, 404, 403, 413, 415.

## Environment

- Workspace: `/workspace/visit-sheet-rc3`
- Branch: `rc3-work`
- Node.js 22 LTS (`/tmp/node22/node_modules/node/bin/node`, v22.x). System Node 20 cannot load the local `better-sqlite3` binary. `npm test` is `node --test tests/qa.test.js`.
- Start: `npm install && npm run seed && npm start` (optional `PORT`, default 3000).
- Browser and PDF evidence stays the rc4 evidence. Do not re-run `scripts/verify.py` unless a product file changes.
- No paid API. No re-record and no re-encode of `/workspace/demo/visit-sheet-demo-v4.mp4`.

## Scope

In scope:

- Test-only edits in `tests/qa.test.js` so inserted visit dates do not depend on the calendar day.
- Current delivery docs name the pre-fix large-text interval as about 127–149 s.
- `BUILD-RC6.txt`, `review/rc6/`, a local commit on `rc3-work`, and annotated tag `rc6`.

Out of scope (not blockers; do not change product files for these):

- Public demo deploy hardening (SESSION_SECRET, secure cookies, trust proxy, session store).
- README env notes (`DB_PATH` / `SESSION_SECRET`).
- Medicine-edit focus on validation error.
- Asked checkbox auto-submit UX.
- Medicine card title size.
- Empty-field separator cleanup.
- Duplicate button aria-labels.
- Large-print A4 page-2 disclaimer layout.
- High-contrast print table borders.
- No-JS slider and print affordances.
- Long unbreakable string overflow.
- Demo segment re-record.
- Stronger verify or qa assertions and missing browser evidence for other cases.
- Git push, cloud deploy, Devpost submit, public GitHub URL.

## Carried product criteria (A1–A13)

A1–A13 keep the meanings in `review/rc4/ACCEPTANCE-TABLE.md`. They are not renumbered and not weakened. A1–A7 and A10 pass because the product tree is unchanged versus rc4. A8's live interval sentence is corrected by this round (see R2). A9 is checked again by the date matrix in R1. A11–A13 are met by `BUILD-RC6.txt`, the local tag, and `review/rc6/`.

A8 historical note: the rc4 contract sentence named a pre-fix timestamp range that started later than the measured start. That sentence is retired for current delivery docs. The measured interval is about 127–149 s. Files that only record the rc4 round (`BUILD-RC4.txt`, `review/rc4/`) may keep the old sentence if a nearby note says the current interval is about 127–149 s.

## rc6 acceptance criteria

R1. `tests/qa.test.js` no longer inserts `2026-12-01` or `2026-12-15`. Both inserted dates use `shiftDays` (already imported from `src/dates.js`) with an offset that stays outside `[D−30, D+7)` on every date below. `shiftDays(40)` meets that rule. The 400-path dates that are never inserted stay: `2026-10-30` and `2026-13-40`. The leftover literal `2026-10-04` in the diary-order check is not a 400-path date; remove that literal and keep the `shiftDays` comparison. Before the carry assertions, assert that the prior visit is still the seed past visit (`Last visit`, `shiftDays(-30)`), so a failure names the cause. Change tests only.

R2. Current delivery docs say the pre-fix large-text segment is about 127–149 s. The saved frames show Display with Saved at about 126 s, the large-text dashboard at about 127 s and 128 s, and the login page at about 134 s and 149 s with those large-text choices still applied. Do not write that the dashboard itself stays on screen through 149 s. At 128 s the Next-visit h2 and the list h3 share the same 468 px width. Post-fix rc4 screenshot 08 widths are 599 and 513 (28px and 24px). The live interval wording is about 127–149 s. Do not re-encode the demo.

R3. Any current rc5 sentence that says the QA tests are already date-independent is corrected. The rc5 commit message may be quoted as history, with a note that two inserted dates were still fixed calendar days until rc6. Do not rewrite git history.

R4. Node 22 test logs under `review/rc6/evidence/` each include `node --version`, the observed or simulated date, the command, the exit code, and the untrimmed test output. Each run exits 0 and the node:test summary contains `# fail 0`.

Required runs:

1. Real machine date, once.
2. Fake dates: 2026-10-13, 2026-10-14, 2026-10-24, 2026-11-20, 2026-11-24, 2026-11-25, 2026-12-01, 2026-12-31, 2027-01-01, and one far-future date.

Also run America/Los_Angeles on 2026-11-01 and 2027-03-14 when faketime can set that zone. Save those logs too. Use the same faketime approach as rc5 (`/tmp/bin/faketime` with libfaketime under `/tmp/faketime-root` if that is still present). Do not change the host clock.

R5. After the test edit, a grep of `tests/qa.test.js` for hardcoded `20xx-` dates shows only the non-inserted 400-path dates (`2026-10-30`, `2026-13-40`).

R6. `git diff rc5 -- src views public server.js package.json package-lock.json` is empty. The same paths are empty versus rc4. Save that empty diff under `review/rc6/evidence/`. Existing rc4 browser, PDF, and screenshot evidence stays valid. If any product file changes, stop and regenerate `scripts/verify.py`, PDFs, and screenshots before tagging.

R7. Frames extracted from `/workspace/demo/visit-sheet-demo-v4.mp4` at 126, 127, 128, 134, and 149 seconds are saved under `review/rc6/evidence/`. A grep of current delivery docs finds no remaining claim that the pre-fix interval is the retired range. The live wording is about 127–149 s. Historical rc4 files may still contain the old sentence only when annotated as in A8 above.

R8. `BUILD-RC6.txt` and `review/rc6/` exist. `review/rc6/` contains the original requirements pointer, source hash, diff from rc5, start command, per-item acceptance table (A1–A13 and R1–R8), run evidence, and known issues. The diff from rc5 is tests and docs only.

R9. Local commits on `rc3-work` follow the rc5 pattern: one commit for the test and doc changes, then one hash-record commit that records `review/rc6/SOURCE.txt` and the diff from rc5 and does not change the test or product files. Annotated tag `rc6` points at the hash-record commit. No push and no new remote. After the tag, the worktree is clean except ignored files and untracked `FIX-TASK-*.md`. Do not commit or edit `FIX-TASK-RC5.md` or `FIX-TASK-RC6.md`.

R10. Status sentence everywhere it is stated: implementation and self-check done, awaiting acceptance. Do not claim FINAL PASS.

## Known issues carried forward

No public URL, no GitHub remote, MemoryStore sessions, Asked still auto-submits, README mentions only `PORT`, print is black text, checked in headless Chrome only, `qa.md` still names the older sample account, the demo subtitle bar covers the bottom 150px, and the v4 picture at about 127–149 s predates the large-text fix. The optional polish list in the scope section stays open.
