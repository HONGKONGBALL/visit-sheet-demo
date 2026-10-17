# Known issues carried forward

From ACCEPTANCE.md, still true for rc5 (carried forward from rc4):

- No public URL.
- No GitHub remote.
- Sessions use MemoryStore (lost when the process restarts).
- The Asked checkbox still auto-submits.
- README mentions only `PORT`.
- Print is black text.
- Checked in headless Chrome only.
- `qa.md` still names the older sample account.
- The demo subtitle bar covers the bottom 150px.
- The v4 picture at about 127–149 s predates the large-text fix. This round did not re-record `/workspace/demo/visit-sheet-demo-v4.mp4`, so those timestamps still show the pre-fix large-text font sizes. The pre-fix large-text interval is about 127–149 s. At about 126 s the Display page shows Saved. At about 127 s and 128 s the dashboard is in large text. At about 134 s and 149 s the login page is on screen with those large-text choices still applied.
- Correction (rc6): the commit message «Candidate rc5: date-independent QA tests» is historical. The suite was not fully date-independent. Inserted visit dates 2026-12-01 and 2026-12-15 stayed fixed calendar days until rc6.
- The stored `review/rc5/diff-from-rc4.patch` interval wording was aligned in rc6 to about 127–149 s. The rc5 commits were not rewritten.

Optional rc3 polish (future-visit carry wording, iOS dates, duplicate button names, checkbox size, README env vars, wide layout, screen readers, other browsers) was left alone.

Out of scope for rc5, not blockers. From the FIX-TASK optional polish list:

- Large-print A4 page-2 disclaimer layout.
- Asked checkbox auto-submit UX.
- High-contrast print table borders.
- Medicine edit focus on validation error.
- Empty-field separator cleanup.
- Duplicate button aria-labels.
- Medicine card title size vs body.
- No-JS slider/print affordances.
- Long unbreakable string overflow check.
- Demo video segment re-record or doc interval correction.
- README env/Node version notes.
- Stronger verify/qa assertions and missing browser evidence for a few cases.
