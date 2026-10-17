# rc4 acceptance

| Item | Status | Evidence |
|---|---|---|
| A1 | PASS | `review/rc4/evidence/results.json` font rows. Min computed size is 22px (`a.skip`) at 320, 390, and 1440, including `/login` where `.mono` is the demo email. `verify-stdout.txt` ends `TOTAL 120 FAIL 0`. |
| A2 | PASS | Same results. Dashboard `h2` links are 28px and `h3` links are 24px. `h3.med-line` on `/medicines` is 24px. Large-print brief headings are 32px (`h2`) and 26px (`h3`). All strictly greater than 22. |
| A3 | PASS | `/visits/<id>/brief?text=large` rows: body class `large-text large-print`, min 22px, overflow 0 at 320, 390, and 1440. Large-print without large text is unchanged in CSS (`body.large-print .site-header` stays 18px). |
| A4 | PASS | `review/rc4/evidence/pdfinfo.txt`. Pages 1 / 1 / 2 / 2. Normal Letter text has the disclaimer and does not contain "Log out". |
| A5 | PASS | `scripts/verify.py`. Cookie `vs_display=large` before navigation. 13 pages × 320, 390, 1440. Existing rc3 checks kept (120 total = 81 previous + 39 font). Exit 0. `verify-stdout.txt`, `results.json`. |
| A6 | PASS | `docs/screenshots/01-login.png` (large text, demo box visible, width 1440, full page). `docs/screenshots/08-high-contrast.png` (large text and high contrast, dashboard cropped above "New visit"). Copies in `review/rc4/evidence/screenshots/`. Shot after `app.css`. |
| A7 | PASS | `docs/devpost.md` Demo video section and `BUILD-RC4.txt`. Path `/workspace/demo/visit-sheet-demo-v4.mp4`, sha256 `33dada6c472fe69d7a6d363407e513e3239d6042ebc4af7ae02548d529e5e5be`. v2 is named only as the older picture-identical file. |
| A8 | PASS | `docs/devpost.md` and `BUILD-RC4.txt` state that timestamps about 134–149 s still show the pre-fix large-text sizes. Correction (rc6): the corrected current interval is about 127–149 s. |
| A9 | PASS | `review/rc4/evidence/npm-test.txt`. Node v22.23.3, `# pass 1`, `# fail 0`. |
| A10 | PASS | Evidence mtimes for results, verify stdout, npm test, pdfinfo, and screenshots 01 and 08 are later than `public/css/app.css` (01:57:26 +0800) and `scripts/verify.py` (02:00:14 +0800) on 2026-10-11. |
| A11 | PASS | `BUILD-RC4.txt` records the start command, port 3788, Node v22.23.3, A1–A13, and the demo v4 facts. |
| A12 | PASS | Local commit on `rc3-work` and annotated tag `rc4` on the final commit. No push and no new remote. See `SOURCE.txt` and `BUILD-RC4.txt` for the two-commit note. |
| A13 | PASS | This directory: `REQUIREMENTS.md`, `SOURCE.txt`, `diff-from-rc3.patch`, `START.md`, `ACCEPTANCE-TABLE.md`, `KNOWN-ISSUES.md`, and `evidence/`. |
