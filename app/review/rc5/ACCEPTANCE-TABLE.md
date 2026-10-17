# rc5 acceptance

A1–A13 keep the same meaning as `review/rc4/ACCEPTANCE-TABLE.md`. They are not renumbered. A1–A8 and A10–A13 pass because the product tree is unchanged versus rc4. The empty product diff is `review/rc5/evidence/product-diff.txt`.

| Item | Status | Evidence |
|---|---|---|
| A1 | PASS | Unchanged product tree versus rc4. rc4 evidence: `review/rc4/evidence/results.json` font rows. Min computed size is 22px (`a.skip`) at 320, 390, and 1440, including `/login` where `.mono` is the demo email. `review/rc4/evidence/verify-stdout.txt` ends `TOTAL 120 FAIL 0`. Empty product diff: `review/rc5/evidence/product-diff.txt`. |
| A2 | PASS | Unchanged product tree versus rc4. Same rc4 results. Dashboard `h2` links are 28px and `h3` links are 24px. `h3.med-line` on `/medicines` is 24px. Large-print brief headings are 32px (`h2`) and 26px (`h3`). All strictly greater than 22. Empty product diff: `review/rc5/evidence/product-diff.txt`. |
| A3 | PASS | Unchanged product tree versus rc4. `/visits/<id>/brief?text=large` rows: body class `large-text large-print`, min 22px, overflow 0 at 320, 390, and 1440. Large-print without large text is unchanged in CSS (`body.large-print .site-header` stays 18px). Empty product diff: `review/rc5/evidence/product-diff.txt`. |
| A4 | PASS | Unchanged product tree versus rc4. `review/rc4/evidence/pdfinfo.txt`. Pages 1 / 1 / 2 / 2. Normal Letter text has the disclaimer and does not contain "Log out". Empty product diff: `review/rc5/evidence/product-diff.txt`. |
| A5 | PASS | Unchanged product tree versus rc4. `scripts/verify.py` was not re-run. rc4 evidence: cookie `vs_display=large` before navigation. 13 pages × 320, 390, 1440. Existing rc3 checks kept (120 total = 81 previous + 39 font). Exit 0. `review/rc4/evidence/verify-stdout.txt`, `review/rc4/evidence/results.json`. Empty product diff: `review/rc5/evidence/product-diff.txt`. |
| A6 | PASS | Unchanged product tree versus rc4. `docs/screenshots/01-login.png` (large text, demo box visible, width 1440, full page). `docs/screenshots/08-high-contrast.png` (large text and high contrast, dashboard cropped above "New visit"). Copies in `review/rc4/evidence/screenshots/`. Shot after `app.css` in rc4. Empty product diff: `review/rc5/evidence/product-diff.txt`. |
| A7 | PASS | Unchanged product tree versus rc4. `docs/devpost.md` Demo video section and `BUILD-RC4.txt`. Path `/workspace/demo/visit-sheet-demo-v4.mp4`, sha256 `33dada6c472fe69d7a6d363407e513e3239d6042ebc4af7ae02548d529e5e5be`. v2 is named only as the older picture-identical file. Facts copied into `BUILD-RC5.txt`. Empty product diff: `review/rc5/evidence/product-diff.txt`. |
| A8 | PASS | Unchanged product tree versus rc4. The pre-fix large-text interval is about 127–149 s. At about 126 s the Display page shows Saved. At about 127 s and 128 s the dashboard is in large text. At about 134 s and 149 s the login page is on screen with those large-text choices still applied. `docs/devpost.md` and `BUILD-RC5.txt` state that. The video was not re-recorded. Empty product diff: `review/rc5/evidence/product-diff.txt`. |
| A9 | PASS | Five Node v22.23.3 runs. Each exit code is 0 and the node:test summary contains `# fail 0`. `review/rc5/evidence/npm-test-real-date.txt` (real date `date -I` 2026-10-12), `review/rc5/evidence/npm-test-2026-10-13.txt`, `review/rc5/evidence/npm-test-2026-10-14.txt`, `review/rc5/evidence/npm-test-2026-10-24.txt`, `review/rc5/evidence/npm-test-2026-11-20.txt`. |
| A10 | PASS | Unchanged product tree versus rc4. rc4 evidence mtimes for `review/rc4/evidence/results.json`, `verify-stdout.txt`, `npm-test.txt`, `pdfinfo.txt`, and screenshots 01 and 08 are later than `public/css/app.css` (01:57:26 +0800) and `scripts/verify.py` (02:00:14 +0800) on 2026-10-11. Those product files are unchanged. Empty product diff: `review/rc5/evidence/product-diff.txt`. |
| A11 | PASS | `BUILD-RC5.txt` records the start command, Node 22, the five test runs and their evidence paths, that product paths are unchanged versus rc4, and the demo v4 facts copied from `BUILD-RC4.txt`. |
| A12 | PASS | Local commit on `rc3-work` and annotated tag `rc5` on the final commit. No push and no new remote. See `SOURCE.txt` and `BUILD-RC5.txt` for the two-commit note. |
| A13 | PASS | This directory: `REQUIREMENTS.md`, `SOURCE.txt`, `diff-from-rc4.patch`, `START.md`, `ACCEPTANCE-TABLE.md`, `KNOWN-ISSUES.md`, and `evidence/`. |

## rc5 date runs

These five runs are the rc5 check on top of A1–A13. They do not renumber A1–A13. Node is v22.23.3. Each log shows `# fail 0` and exit code 0.

| Run | Date the process observed | Exit | Summary | Log |
|---|---|---|---|---|
| Real machine date | Mon Oct 12 04:08:26 CST 2026 (`date -I` 2026-10-12) | 0 | `# fail 0` | `review/rc5/evidence/npm-test-real-date.txt` |
| Fake noon | Tue Oct 13 12:00:00 CST 2026 | 0 | `# fail 0` | `review/rc5/evidence/npm-test-2026-10-13.txt` |
| Fake noon | Wed Oct 14 12:00:00 CST 2026 | 0 | `# fail 0` | `review/rc5/evidence/npm-test-2026-10-14.txt` |
| Fake noon | Sat Oct 24 12:00:00 CST 2026 | 0 | `# fail 0` | `review/rc5/evidence/npm-test-2026-10-24.txt` |
| Fake noon | Fri Nov 20 12:00:00 CST 2026 | 0 | `# fail 0` | `review/rc5/evidence/npm-test-2026-11-20.txt` |

Status: implementation and self-check done, awaiting acceptance.
