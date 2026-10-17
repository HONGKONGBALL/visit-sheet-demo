# Devpost fields — VisitSheet

Paste-ready draft for HEALTHHACK 48. Submit only after the form is open (the planned window is Oct 17–18, 2026). Do not invent a public URL, a YouTube link, teammates, a school, or measured results. This file is the submission copy. It is not a claim that the project has been submitted.

## Title

VisitSheet — your appointment on one page

## Pitch (200 characters or fewer)

VisitSheet turns your own notes into a one-page appointment brief: the three questions that matter, medicines as typed, and how the clinic should speak with you.

## Built with

`node.js`, `express`, `sqlite`, `better-sqlite3`, `ejs`, `javascript`, `html5`, `css3`

## Team

Solo — Zhenhua (GitHub HONGKONGBALL). No other teammates.

## A short description

Appointments are short, and the question that mattered is easy to forget until you are outside again. A helper often prepares the visit and has nowhere tidy to put the notes. People with communication needs repeat the same explanation every time.

VisitSheet is one page for that preparation.

- You rank questions. The brief boxes the first three under “If we only have time for three” and puts the rest under “If there is time.”
- A “How to communicate with me” card (eight plain-language choices, plus a short note) prints at the top of every brief.
- A question that was not marked asked last time can be added to this visit in one step.
- The same words can be printed, opened in large print, or downloaded as JSON.

The app only arranges what was typed. It does not diagnose, check medicines, interpret the 0–10 bother number, or suggest treatment. It is not for emergencies. Every person, clinic, and medicine in the demo is fictional.

Each login receives a fresh private copy of the sample, with dates counted from that day, so judges do not edit one another’s notes. The next visit is seven days ahead.

Large text and high contrast are a Display setting stored in a cookie. They work on the login page, before anyone signs in. The pages work without JavaScript. Printing uses the browser’s own print command. A normal brief of the sample fits on one Letter or A4 page. The large-print version is larger on screen and uses two pages when printed.

## Try it

Not deployed in this build. Run it locally. No API key and no `.env` file.

```bash
npm install
npm run seed
npm start
```

Node.js 22 LTS or newer. Optional `PORT` (default 3000).

Fictional demo login, also printed on the login page:

- Email: `demo@visitsheet.example`
- Password: `demo-pass-48`
- Or press **Fill in the demo login**

A two-minute look: log in, open **Next visit**, open **Make my brief**, move a question with **Up**, then **Add to this visit** for the question that was not asked last time. Open **Display** and turn on large text and high contrast.

## Repository

Public GitHub URL: leave blank until this repo is actually pushed. Do not paste a placeholder link.

## Demo video

The delivery video is `/workspace/demo/visit-sheet-demo-v4.mp4`. It sits beside the project and is not inside the git repo. It has not been uploaded. Leave the YouTube field empty.

Measured on 2026-10-11:

- sha256: `33dada6c472fe69d7a6d363407e513e3239d6042ebc4af7ae02548d529e5e5be`
- duration: 157.954 s (about 2:38)
- picture: 1920×1080 H.264 at 30 fps
- video-stream sha256: `910a8fb974a30c9080e5dc7c5fa92b1418c26cb233001b993467154aabf41b93` (`ffmpeg -map 0:v:0 -c copy -f h264`, then sha256). That stream is bit-identical to the older picture file `visit-sheet-demo-v2.mp4`. v2 is not the delivery file.
- audio: AAC LC, stereo, 48 kHz, 136329 bps (about 136 kbps)
- narration: DashScope / Bailian, model `qwen3-tts-flash`, voice `Cherry`

This round did not re-record the video. Timestamps about 127–149 s still show the pre-fix large-text font sizes. The pre-fix large-text interval is about 127–149 s. At about 126 s the Display page shows Saved. At about 127 s and 128 s the dashboard is in large text. At about 134 s and 149 s the login page is on screen with those large-text choices still applied.

YouTube:

## What it does not do

- It does not diagnose.
- It does not give medical advice.
- It does not check medicines or suggest a dose or a treatment.
- It does not interpret the bother number.
- It is not for emergencies.
- It does not call a paid API or a model. There is no account sign-up.

## Screenshots to upload

1. `docs/screenshots/01-login.png` — login page in large text, with the fictional demo email and password visible
2. `docs/screenshots/02-dashboard.png` — next visit, seven days ahead
3. `docs/screenshots/03-visit.png` — access card and ranked questions
4. `docs/screenshots/04-brief.png` — one-page brief
5. `docs/screenshots/05-large-print.png` — large print on screen
6. `docs/screenshots/08-high-contrast.png` — large text and high contrast
