# Known issues carried forward

From ACCEPTANCE.md, still true for rc6 (carried forward from rc5):

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

Optional rc3 polish (future-visit carry wording, iOS dates, duplicate button names, checkbox size, README env vars, wide layout, screen readers, other browsers) was left alone.

Out of scope for rc6, not blockers. From the ACCEPTANCE.md polish list:

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

These are not blockers.
