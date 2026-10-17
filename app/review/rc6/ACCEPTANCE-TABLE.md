# rc6 acceptance

A1–A13 keep the same meaning as `review/rc4/ACCEPTANCE-TABLE.md`. They are not renumbered and not weakened. A1–A7 and A10 pass because the product tree is unchanged versus rc4. The empty product diff is `review/rc6/evidence/product-diff.txt`.

| Item | Status | Evidence |
|---|---|---|
| A1 | PASS | Unchanged product tree versus rc4. rc4 evidence: `review/rc4/evidence/results.json` font rows. Min computed size is 22px (`a.skip`) at 320, 390, and 1440, including `/login` where `.mono` is the demo email. `review/rc4/evidence/verify-stdout.txt` ends `TOTAL 120 FAIL 0`. Empty product diff: `review/rc6/evidence/product-diff.txt`. |
| A2 | PASS | Unchanged product tree versus rc4. Same rc4 results. Dashboard `h2` links are 28px and `h3` links are 24px. `h3.med-line` on `/medicines` is 24px. Large-print brief headings are 32px (`h2`) and 26px (`h3`). All strictly greater than 22. Empty product diff: `review/rc6/evidence/product-diff.txt`. |
| A3 | PASS | Unchanged product tree versus rc4. `/visits/<id>/brief?text=large` rows: body class `large-text large-print`, min 22px, overflow 0 at 320, 390, and 1440. Large-print without large text is unchanged in CSS (`body.large-print .site-header` stays 18px). Empty product diff: `review/rc6/evidence/product-diff.txt`. |
| A4 | PASS | Unchanged product tree versus rc4. `review/rc4/evidence/pdfinfo.txt`. Pages 1 / 1 / 2 / 2. Normal Letter text has the disclaimer and does not contain "Log out". Empty product diff: `review/rc6/evidence/product-diff.txt`. |
| A5 | PASS | Unchanged product tree versus rc4. `scripts/verify.py` was not re-run. rc4 evidence: cookie `vs_display=large` before navigation. 13 pages × 320, 390, 1440. Existing rc3 checks kept (120 total = 81 previous + 39 font). Exit 0. `review/rc4/evidence/verify-stdout.txt`, `review/rc4/evidence/results.json`. Empty product diff: `review/rc6/evidence/product-diff.txt`. |
| A6 | PASS | Unchanged product tree versus rc4. `docs/screenshots/01-login.png` (large text, demo box visible, width 1440, full page). `docs/screenshots/08-high-contrast.png` (large text and high contrast, dashboard cropped above "New visit"). Copies in `review/rc4/evidence/screenshots/`. Shot after `app.css` in rc4. Empty product diff: `review/rc6/evidence/product-diff.txt`. |
| A7 | PASS | Unchanged product tree versus rc4. `docs/devpost.md` Demo video section and `BUILD-RC4.txt`. Path `/workspace/demo/visit-sheet-demo-v4.mp4`, sha256 `33dada6c472fe69d7a6d363407e513e3239d6042ebc4af7ae02548d529e5e5be`. v2 is named only as the older picture-identical file. Facts copied into `BUILD-RC6.txt`. Empty product diff: `review/rc6/evidence/product-diff.txt`. |
| A8 | PASS | The pre-fix large-text interval is about 127–149 s. At about 126 s the Display page shows Saved. At about 127 s and 128 s the dashboard is in large text. At about 134 s and 149 s the login page is on screen with those large-text choices still applied. `docs/devpost.md`, `BUILD-RC6.txt`, `review/rc6/KNOWN-ISSUES.md`. Frames: `review/rc6/evidence/frame-126s.png`, `frame-127s.png`, `frame-128s.png`, `frame-134s.png`, `frame-149s.png`, and `review/rc6/evidence/frames.txt`. The video was not re-recorded. |
| A9 | PASS | Thirteen Node v22.23.3 runs. Each exit code is 0 and the node:test summary contains `# fail 0`. Real date and the fake-date matrix, including `2035-06-15` and the two `America/Los_Angeles` runs. Logs under `review/rc6/evidence/`. See the date table below. |
| A10 | PASS | Unchanged product tree versus rc4. rc4 evidence mtimes for `review/rc4/evidence/results.json`, `verify-stdout.txt`, `npm-test.txt`, `pdfinfo.txt`, and screenshots 01 and 08 are later than `public/css/app.css` (01:57:26 +0800) and `scripts/verify.py` (02:00:14 +0800) on 2026-10-11. Those product files are unchanged. Empty product diff: `review/rc6/evidence/product-diff.txt`. |
| A11 | PASS | `BUILD-RC6.txt` records the start command, Node 22, the thirteen test runs and their evidence paths, that product paths are unchanged versus rc5 and rc4, and the demo v4 facts copied from `BUILD-RC5.txt`. |
| A12 | PASS | Local commits on `rc3-work`. Product/tests commit remains `3da94ad13c6dd2443c823eca8933256a6377450e`. Hash-record commit remains `ee29f9db9b608c690c1b84b5ca1c63f95a6f2426` and was not rewritten. A doc-correction commit follows it. Annotated tag `rc6` points at the doc-correction commit. That commit does not change `tests/qa.test.js` or any product file. No push and no new remote. See `SOURCE.txt` and `BUILD-RC6.txt`. |
| A13 | PASS | This directory: `REQUIREMENTS.md`, `SOURCE.txt`, `diff-from-rc5.patch`, `START.md`, `ACCEPTANCE-TABLE.md`, `KNOWN-ISSUES.md`, and `evidence/`. |

## rc6 checks R1–R10

These checks are the rc6 contract on top of A1–A13. They do not renumber A1–A13.

| Item | Status | Evidence |
|---|---|---|
| R1 | PASS | `tests/qa.test.js` inserts `shiftDays(40)` for the sandbox marker and the reset marker. The diary-order check compares `shiftDays(-5)` with `shiftDays(-8)` and no longer contains `2026-10-04`. Before `carry source`, the check `prior visit is seed past` expects `Last visit at Sample Street Clinic (fictional)` on `shiftDays(-30)`. The date logs below exit 0 with `# fail 0`. |
| R2 | PASS | The pre-fix large-text interval is about 127–149 s. At about 126 s the Display page shows Saved. At about 127 s and 128 s the dashboard is in large text. At about 134 s and 149 s the login page is on screen with those large-text choices still applied. `docs/devpost.md`, `BUILD-RC5.txt`, `BUILD-RC6.txt`, `review/rc5/KNOWN-ISSUES.md`, `review/rc5/ACCEPTANCE-TABLE.md`, `review/rc6/KNOWN-ISSUES.md`, `ACCEPTANCE.md`, and `review/rc6/evidence/frames.txt`. |
| R3 | PASS | `BUILD-RC5.txt`, `review/rc5/KNOWN-ISSUES.md`, and `review/rc5/SOURCE.txt` quote the historical commit message «Candidate rc5: date-independent QA tests» and correct it: inserted dates `2026-12-01` and `2026-12-15` stayed fixed until rc6. Git history was not rewritten. |
| R4 | PASS | Each log under `review/rc6/evidence/` has `node --version`, the host date, the observed date, the command, exit code 0, and the untrimmed test output. Each summary contains `# fail 0`. `review/rc6/evidence/node-version.txt`. |
| R5 | PASS | `tests/qa.test.js` hardcoded `20xx-` dates are only `2026-10-30` and `2026-13-40`. Both are 400-path inputs and are not inserted. |
| R6 | PASS | `review/rc6/evidence/product-diff.txt`. `git diff --exit-code rc5 -- src views public server.js package.json package-lock.json` exit status 0. The same command against rc4 exit status 0. |
| R7 | PASS | Frames `review/rc6/evidence/frame-126s.png`, `frame-127s.png`, `frame-128s.png`, `frame-134s.png`, `frame-149s.png`. Current delivery docs do not state the retired pre-fix range as the live interval. The live wording is about 127–149 s. rc4 files keep the old sentence with a nearby correction. |
| R8 | PASS | `BUILD-RC6.txt` and this directory. The diff from rc5 is tests and docs only. |
| R9 | PASS | Product/tests commit remains `3da94ad13c6dd2443c823eca8933256a6377450e`. Hash-record commit remains `ee29f9db9b608c690c1b84b5ca1c63f95a6f2426` and was not rewritten. A doc-correction commit follows it. The annotated tag `rc6` points at the doc-correction commit. That commit does not change `tests/qa.test.js` or any product file. No push and no new remote. `FIX-TASK-RC5.md` and `FIX-TASK-RC6.md` stay untracked. |
| R10 | PASS | Status sentence: implementation and self-check done, awaiting acceptance. |

## Date runs

Node is v22.23.3. Each log shows `# fail 0` and exit code 0.

| Run | Date the process observed | Exit | Summary | Log |
|---|---|---|---|---|
| Real machine date | Sun Oct 11 19:01:02 PDT 2026 (`date -I` 2026-10-11) | 0 | `# fail 0` | `review/rc6/evidence/npm-test-real-date.txt` |
| Fake noon | Tue Oct 13 12:00:00 PDT 2026 | 0 | `# fail 0` | `review/rc6/evidence/npm-test-2026-10-13.txt` |
| Fake noon | Wed Oct 14 12:00:00 PDT 2026 | 0 | `# fail 0` | `review/rc6/evidence/npm-test-2026-10-14.txt` |
| Fake noon | Sat Oct 24 12:00:00 PDT 2026 | 0 | `# fail 0` | `review/rc6/evidence/npm-test-2026-10-24.txt` |
| Fake noon | Fri Nov 20 12:00:00 PST 2026 | 0 | `# fail 0` | `review/rc6/evidence/npm-test-2026-11-20.txt` |
| Fake noon | Tue Nov 24 12:00:00 PST 2026 | 0 | `# fail 0` | `review/rc6/evidence/npm-test-2026-11-24.txt` |
| Fake noon | Wed Nov 25 12:00:00 PST 2026 | 0 | `# fail 0` | `review/rc6/evidence/npm-test-2026-11-25.txt` |
| Fake noon | Tue Dec  1 12:00:00 PST 2026 | 0 | `# fail 0` | `review/rc6/evidence/npm-test-2026-12-01.txt` |
| Fake noon | Thu Dec 31 12:00:00 PST 2026 | 0 | `# fail 0` | `review/rc6/evidence/npm-test-2026-12-31.txt` |
| Fake noon | Fri Jan  1 12:00:00 PST 2027 | 0 | `# fail 0` | `review/rc6/evidence/npm-test-2027-01-01.txt` |
| Fake noon | Fri Jun 15 12:00:00 PDT 2035 | 0 | `# fail 0` | `review/rc6/evidence/npm-test-2035-06-15.txt` |
| America/Los_Angeles noon | Sun Nov  1 12:00:00 PST 2026 | 0 | `# fail 0` | `review/rc6/evidence/npm-test-la-2026-11-01.txt` |
| America/Los_Angeles noon | Sun Mar 14 12:00:00 PDT 2027 | 0 | `# fail 0` | `review/rc6/evidence/npm-test-la-2027-03-14.txt` |

Status: implementation and self-check done, awaiting acceptance.
