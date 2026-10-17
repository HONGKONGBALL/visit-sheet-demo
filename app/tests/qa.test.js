'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../src/app');
const { openDatabase } = require('../src/db');
const { shiftDays } = require('../src/dates');

const DISCLAIMER = 'VisitSheet organizes your own notes. It is not medical advice. All demo data is fictional.';

test('QA cases for the merged VisitSheet spec', async () => {
  const dbPath = path.join(os.tmpdir(), `visitsheet-qa-${process.pid}-${Date.now()}.db`);
  const db = openDatabase(dbPath);
  const app = createApp(db);
  const server = await new Promise((resolve) => {
    const handle = app.listen(0, '127.0.0.1', () => resolve(handle));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const failures = [];

  function check(name, ok, detail) {
    if (!ok) failures.push(`${name}: ${detail}`);
  }

  try {
    const health = await request(base, {}, 'GET', '/health');
    check('1 status', health.status === 200, health.status);
    check('1 type', (health.headers.get('content-type') || '').includes('application/json'), health.headers.get('content-type'));
    check('1 body', health.text === '{"ok":true}', health.text);

    const rootOut = await request(base, {}, 'GET', '/');
    check('2', rootOut.status === 302 && loc(rootOut) === '/login', `${rootOut.status} ${loc(rootOut)}`);

    const loginPage = await request(base, {}, 'GET', '/login');
    check('3 status', loginPage.status === 200, loginPage.status);
    check('3 email', loginPage.text.includes('name="email"') && loginPage.text.includes('id="email"'), 'email');
    check('3 password', loginPage.text.includes('id="password"'), 'password');
    check('3 button', loginPage.text.includes('>Log in<'), 'button');
    check('3 demo box', loginPage.text.includes('Demo account (fictional)'), 'box');
    check('3 robin', loginPage.text.includes('demo@visitsheet.example') && loginPage.text.includes('Robin Sample'), 'robin');
    check('3 one account', !loginPage.text.includes('caregiver@visitsheet.example') && !loginPage.text.includes('Alex Example'), 'second account');
    check('3 fill', loginPage.text.includes('Fill in the demo login'), 'fill');
    check('3 footer', loginPage.text.includes(DISCLAIMER), 'footer');
    check('3 fill link', loginPage.text.includes('href="/login?fill=1"'), 'href');

    const filled = await request(base, {}, 'GET', '/login?fill=1');
    check('3 fill values', filled.text.includes('value="demo@visitsheet.example"') && filled.text.includes('value="demo-pass-48"'), 'values');

    const about = await request(base, {}, 'GET', '/about');
    check('4 status', about.status === 200, about.status);
    check('4 diagnose', /does not diagnose/i.test(about.text), 'diagnose');
    check('4 advice', /does not give medical advice/i.test(about.text), 'advice');
    check('4 fictional', /all demo data is fictional/i.test(about.text), 'fictional');

    const missing = await request(base, {}, 'GET', '/no-such-page');
    check('5', missing.status === 404 && missing.text.includes('href="/"') && missing.text.includes(DISCLAIMER), missing.status);

    const badCharset = await sendRaw(base, {}, 'POST', '/login', {
      contentType: 'application/x-www-form-urlencoded; charset=foo',
      body: 'email=a@b.example&password=secret'
    });
    check('415 status', badCharset.status === 415 || badCharset.status === 400, badCharset.status);
    check('415 page', safeErrorPage(badCharset.text), badCharset.text.slice(0, 240));

    const bad = await login(base, 'demo@visitsheet.example', 'wrong');
    check('7 status', bad.res.status === 401, bad.res.status);
    check('7 message', bad.res.text.includes('Email or password is wrong.'), 'message');
    check('7 email kept', /id="email"[^>]*value="demo@visitsheet\.example"/.test(bad.res.text), 'email');
    check('7 password empty', /id="password"[^>]*value=""/.test(bad.res.text), 'password');

    const unknown = await login(base, 'nobody@visitsheet.example', 'demo-pass-48');
    check('8', unknown.res.status === 401 && unknown.res.text.includes('Email or password is wrong.'), unknown.res.status);

    const emptyJar = {};
    const emptyPage = await request(base, emptyJar, 'GET', '/login');
    const emptyPost = await request(base, emptyJar, 'POST', '/login', {
      _csrf: csrf(emptyPage.text),
      email: '',
      password: ''
    });
    check('9 status', emptyPost.status === 400 || emptyPost.status === 401, emptyPost.status);
    check('9 message', /required/i.test(emptyPost.text), emptyPost.text.slice(0, 200));
    const emptyDash = await request(base, emptyJar, 'GET', '/dashboard');
    check('9 no session', emptyDash.status === 302 && loc(emptyDash) === '/login', loc(emptyDash));

    for (const pathName of ['/dashboard', '/medicines', '/settings', '/visits/1']) {
      const locked = await request(base, {}, 'GET', pathName);
      check(`10 ${pathName}`, locked.status === 302 && loc(locked) === '/login', `${locked.status} ${loc(locked)}`);
    }

    const noCsrf = await request(base, {}, 'POST', '/login', {
      email: 'demo@visitsheet.example',
      password: 'demo-pass-48'
    });
    check('13', noCsrf.status === 403, noCsrf.status);

    const robin = await login(base, 'demo@visitsheet.example', 'demo-pass-48');
    check('6 status', robin.res.status === 302 && loc(robin.res) === '/dashboard', `${robin.res.status} ${loc(robin.res)}`);
    const setCookie = robin.res.setCookies.join(' | ');
    check('6 cookie', /visitsheet\.sid=/.test(setCookie) && /httponly/i.test(setCookie), setCookie);

    const oversized = await sendRaw(base, robin.jar, 'POST', '/visits/1/takeaways', {
      contentType: 'application/x-www-form-urlencoded',
      body: `takeaways=${'A'.repeat(70000)}`
    });
    check('413 status', oversized.status === 413 || oversized.status === 400, oversized.status);
    check('413 page', safeErrorPage(oversized.text), oversized.text.slice(0, 240));
    const stillUp = await request(base, robin.jar, 'GET', '/dashboard');
    check('413 recovered', stillUp.status === 200 && stillUp.text.includes('Hello, Robin Sample'), stillUp.status);

    const homeIn = await request(base, robin.jar, 'GET', '/');
    check('12', homeIn.status === 302 && loc(homeIn) === '/dashboard', loc(homeIn));

    const dash = await request(base, robin.jar, 'GET', '/dashboard');
    check('14 hello', dash.status === 200 && dash.text.includes('Hello, Robin Sample'), dash.status);
    check('14 checkup', dash.text.includes('Check-up at Example Family Clinic (fictional)'), 'title');
    check('14 follow', dash.text.includes('Follow-up at Sample Street Clinic (fictional)'), 'follow');
    check('14 past', dash.text.includes('Last visit at Sample Street Clinic (fictional)'), 'past');
    check('14 next', dash.text.includes('Next visit') && dash.text.includes('in 7 days'), 'next');
    check('14 date next', dash.text.includes(shiftDays(7)), shiftDays(7));
    check('14 date follow', dash.text.includes(shiftDays(25)), shiftDays(25));
    check('14 date past', dash.text.includes(shiftDays(-30)), shiftDays(-30));
    check('14 counts', dash.text.includes('4 questions') && dash.text.includes('1 question') && dash.text.includes('2 questions'), 'counts');
    check('14 order', dash.text.indexOf('Check-up at Example Family Clinic (fictional)') < dash.text.indexOf('Follow-up at Sample Street Clinic (fictional)'), 'order');
    const checkId = Number(dash.text.match(/href="\/visits\/(\d+)">Check-up/)[1]);
    const followId = Number(dash.text.match(/href="\/visits\/(\d+)">Follow-up/)[1]);
    const pastId = Number(dash.text.match(/href="\/visits\/(\d+)">Last visit/)[1]);

    const created = await postForm(base, robin.jar, '/dashboard', '/visits', {
      title: 'Eye check (fictional)',
      visit_date: shiftDays(18),
      with_whom: 'Optician Demo (fictional)'
    });
    check('15 status', created.res.status === 302, created.res.status);
    const newPath = loc(created.res).split('?')[0];
    check('15 location', /^\/visits\/\d+$/.test(newPath), loc(created.res));
    const newId = Number(newPath.split('/')[2]);
    const newPage = await request(base, robin.jar, 'GET', `/visits/${newId}`);
    check('15 title', newPage.status === 200 && newPage.text.includes('Eye check (fictional)'), newPage.status);
    const dash3 = await request(base, robin.jar, 'GET', '/dashboard');
    check('15 listed', dash3.text.includes('Eye check (fictional)'), 'listed');
    const orderTitles = [...dash3.text.matchAll(/<h3><a href="\/visits\/\d+">([^<]+)<\/a>/g)].map((match) => match[1]);
    check('15 between', orderTitles.indexOf('Check-up at Example Family Clinic (fictional)') < orderTitles.indexOf('Eye check (fictional)')
      && orderTitles.indexOf('Eye check (fictional)') < orderTitles.indexOf('Follow-up at Sample Street Clinic (fictional)'), orderTitles.join(' | '));

    const emptyTitle = await postForm(base, robin.jar, '/dashboard', '/visits', {
      title: '   ',
      visit_date: '2026-10-30',
      with_whom: 'Optician Demo (fictional)'
    });
    check('16 status', emptyTitle.res.status === 400, emptyTitle.res.status);
    check('16 error', emptyTitle.res.text.includes('Title is required.') && emptyTitle.res.text.includes('id="visit-title-error"'), 'error');
    check('16 kept date', emptyTitle.res.text.includes('value="2026-10-30"'), 'date');
    check('16 kept with', emptyTitle.res.text.includes('value="Optician Demo (fictional)"'), 'with');

    const badDate = await postForm(base, robin.jar, '/dashboard', '/visits', {
      title: 'Eye check (fictional)',
      visit_date: '2026-13-40',
      with_whom: 'Optician Demo (fictional)'
    });
    check('17', badDate.res.status === 400 && badDate.res.text.includes('Enter a real date as YYYY-MM-DD.'), badDate.res.status);

    const longTitle = 'A'.repeat(121);
    const badTitle = await postForm(base, robin.jar, '/dashboard', '/visits', {
      title: longTitle,
      visit_date: '2026-10-30',
      with_whom: 'Optician Demo (fictional)'
    });
    check('18', badTitle.res.status === 400 && badTitle.res.text.includes('120 characters or fewer'), badTitle.res.status);

    const visit = await request(base, robin.jar, 'GET', `/visits/${checkId}`);
    check('19 status', visit.status === 200, visit.status);
    const seeded = questionsOn(visit.text);
    check('19 count', seeded.length === 4, String(seeded.length));
    check('19 order', seeded.map((item) => item.text).slice(0, 2).join('|') === [
      'Is it OK to keep doing my morning walk?',
      'Can we go over when I take Sample Tablet A?'
    ].join('|'), seeded.map((item) => item.text).join(' / '));
    check('19 diary order', visit.text.indexOf(shiftDays(-5)) < visit.text.indexOf(shiftDays(-8)), 'diary');
    check('19 diary dates', visit.text.includes(shiftDays(-5)) && visit.text.includes(shiftDays(-8)), `${shiftDays(-5)} ${shiftDays(-8)}`);
    check('19 bother', visit.text.includes('Bothers me: 5 / 10') && visit.text.includes('Bothers me: 3 / 10'), 'bother');
    check('19 carry', visit.text.includes('Add to this visit') && visit.text.includes('Who do I call if the headache comes back on a weekend?'), 'carry');

    const missingVisit = await request(base, robin.jar, 'GET', '/visits/999999');
    check('20', missingVisit.status === 404, missingVisit.status);

    const removed = await postForm(base, robin.jar, `/visits/${newId}/delete`, `/visits/${newId}/delete`, {});
    check('21 status', removed.res.status === 302 && loc(removed.res) === '/dashboard', loc(removed.res));
    const afterDelete = await request(base, robin.jar, 'GET', '/dashboard');
    check('21 gone', !afterDelete.text.includes('Eye check (fictional)'), 'still listed');
    check('21 count', (afterDelete.text.match(/<h3><a href="\/visits\//g) || []).length === 3, 'count');
    const gone = await request(base, robin.jar, 'GET', `/visits/${newId}`);
    check('21 404', gone.status === 404, gone.status);

    const visitEditPage = await request(base, robin.jar, 'GET', `/visits/${checkId}`);
    check('edit details offered', visitEditPage.text.includes('Edit visit details')
      && visitEditPage.text.includes('action="/visits/' + checkId + '/details"'), 'form');
    const summaryTag = (visitEditPage.text.match(/<summary id="visit-details"[^>]*>/) || [''])[0];
    check('edit summary tab', summaryTag && !/tabindex\s*=/.test(summaryTag), summaryTag || 'missing summary');
    const summaryFocus = await request(base, robin.jar, 'GET', `/visits/${checkId}?focus=visit-details`);
    const summaryFocusTag = (summaryFocus.text.match(/<summary id="visit-details"[^>]*>/) || [''])[0];
    check('edit summary autofocus', /autofocus/.test(summaryFocusTag) && !/tabindex\s*=/.test(summaryFocusTag), summaryFocusTag);
    const renamed = await postForm(base, robin.jar, `/visits/${checkId}`, `/visits/${checkId}/details`, {
      title: 'Check-up at Example Family Clinic (fictional)',
      visit_date: shiftDays(8),
      with_whom: 'Dr. Placeholder (fictional)'
    });
    check('edit status', renamed.res.status === 302 && loc(renamed.res).includes('#title'), loc(renamed.res));
    const afterRename = await request(base, robin.jar, 'GET', `/visits/${checkId}`);
    check('edit date saved', afterRename.text.includes(shiftDays(8)), shiftDays(8));
    const dashAfterEdit = await request(base, robin.jar, 'GET', '/dashboard');
    check('edit dash date', dashAfterEdit.text.includes(shiftDays(8)) && dashAfterEdit.text.includes('in 8 days'), 'dash');
    const blankTitle = await postForm(base, robin.jar, `/visits/${checkId}`, `/visits/${checkId}/details`, {
      title: '  ',
      visit_date: shiftDays(8),
      with_whom: 'Dr. Placeholder (fictional)'
    });
    check('edit empty title', blankTitle.res.status === 400 && blankTitle.res.text.includes('Title is required.'), blankTitle.res.status);
    check('edit keeps date', blankTitle.res.text.includes(`value="${shiftDays(8)}"`), 'date kept');
    const restored = await postForm(base, robin.jar, `/visits/${checkId}`, `/visits/${checkId}/details`, {
      title: 'Check-up at Example Family Clinic (fictional)',
      visit_date: shiftDays(7),
      with_whom: 'Dr. Placeholder (fictional)'
    });
    check('edit restore', restored.res.status === 302, restored.res.status);
    const noDetailsCsrf = await request(base, robin.jar, 'POST', `/visits/${checkId}/details`, {
      title: 'Should not save',
      visit_date: shiftDays(7),
      with_whom: 'Dr. Placeholder (fictional)'
    });
    check('edit csrf', noDetailsCsrf.status === 403, noDetailsCsrf.status);

    const added = await postForm(base, robin.jar, `/visits/${checkId}`, `/visits/${checkId}/questions`, {
      text: 'Do I need a follow-up?'
    });
    check('22 status', added.res.status === 302 && loc(added.res).includes('#questions'), loc(added.res));
    const withAdded = await request(base, robin.jar, 'GET', `/visits/${checkId}`);
    const afterAdd = questionsOn(withAdded.text);
    check('22 last', afterAdd[afterAdd.length - 1].text === 'Do I need a follow-up?' && afterAdd[afterAdd.length - 1].n === 5, afterAdd.map((item) => item.n + item.text).join(','));

    const blankQ = await postForm(base, robin.jar, `/visits/${checkId}`, `/visits/${checkId}/questions`, { text: '   ' });
    check('23', blankQ.res.status === 400 && blankQ.res.text.includes('Question cannot be empty'), blankQ.res.status);
    check('23 unchanged', questionsOn(blankQ.res.text).length === 5, String(questionsOn(blankQ.res.text).length));

    const longQ = await postForm(base, robin.jar, `/visits/${checkId}`, `/visits/${checkId}/questions`, { text: 'Q'.repeat(301) });
    check('24', longQ.res.status === 400 && longQ.res.text.includes('300 characters or fewer'), longQ.res.status);

    let current = questionsOn((await request(base, robin.jar, 'GET', `/visits/${checkId}`)).text);
    const first = current[0];
    const second = current[1];
    const moved = await postForm(base, robin.jar, `/visits/${checkId}`, `/questions/${first.id}/move`, { dir: 'down' });
    check('25 status', moved.res.status === 302, moved.res.status);
    const reloaded = await request(base, robin.jar, 'GET', `/visits/${checkId}`);
    current = questionsOn(reloaded.text);
    check('25 swap', current[0].id === second.id && current[1].id === first.id, current.slice(0, 2).map((item) => item.text).join(' | '));

    const topId = current[0].id;
    const stayed = await postForm(base, robin.jar, `/visits/${checkId}`, `/questions/${topId}/move`, { dir: 'up' });
    check('26 status', stayed.res.status === 302, stayed.res.status);
    const afterUp = questionsOn((await request(base, robin.jar, 'GET', `/visits/${checkId}`)).text);
    check('26 same', afterUp[0].id === topId && afterUp[1].id === current[1].id, 'order');

    const sideways = await postForm(base, robin.jar, `/visits/${checkId}`, `/questions/${topId}/move`, { dir: 'sideways' });
    check('27', sideways.res.status === 400, sideways.res.status);

    const asked = await postForm(base, robin.jar, `/visits/${checkId}`, `/questions/${topId}/asked`, { asked: '1' });
    check('28 status', asked.res.status === 302, asked.res.status);
    const askedPage = await request(base, robin.jar, 'GET', `/visits/${checkId}`);
    check('28 ticked', new RegExp(`id="asked-${topId}"[^>]*checked`).test(askedPage.text), 'checked');

    const fourth = questionsOn(askedPage.text).find((item) => item.n === 4);
    const deletedQ = await postForm(base, robin.jar, `/visits/${checkId}`, `/questions/${fourth.id}/delete`, {});
    check('29 status', deletedQ.res.status === 302, deletedQ.res.status);
    const afterQDelete = questionsOn((await request(base, robin.jar, 'GET', `/visits/${checkId}`)).text);
    check('29 count', afterQDelete.length === 4, String(afterQDelete.length));
    check('29 positions', afterQDelete.map((item) => item.n).join(',') === '1,2,3,4', afterQDelete.map((item) => item.n).join(','));
    check('29 removed added stays if fourth was seed', afterQDelete.some((item) => item.text === 'Do I need a follow-up?') || fourth.text === 'Do I need a follow-up?', fourth.text);

    const xss = await postForm(base, robin.jar, `/visits/${checkId}`, `/visits/${checkId}/questions`, {
      text: '<script>alert(1)</script>'
    });
    check('30 status', xss.res.status === 302, xss.res.status);
    const xssVisit = await request(base, robin.jar, 'GET', `/visits/${checkId}`);
    const xssBrief = await request(base, robin.jar, 'GET', `/visits/${checkId}/brief`);
    check('30 visit text', xssVisit.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'escaped visit');
    check('30 visit raw', !xssVisit.text.includes('<script>alert(1)</script>'), 'raw visit');
    check('30 brief text', xssBrief.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'escaped brief');
    check('30 brief raw', !xssBrief.text.includes('<script>alert(1)</script>'), 'raw brief');

    const diary = await postForm(base, robin.jar, `/visits/${checkId}`, `/visits/${checkId}/diary`, {
      entry_date: shiftDays(-1),
      text: 'Screen feels blurry late at night.',
      bother: '4'
    });
    check('31 status', diary.res.status === 302 && loc(diary.res).includes('#diary'), loc(diary.res));
    const diaryPage = await request(base, robin.jar, 'GET', `/visits/${checkId}`);
    check('31 top', diaryPage.text.indexOf('Screen feels blurry late at night.') < diaryPage.text.indexOf('Slept badly, felt tired all day.'), 'order');
    check('31 bother', diaryPage.text.includes('Bothers me: 4 / 10'), 'bother');
    check('32 markup', diaryPage.text.includes('id="bother"') && diaryPage.text.includes('id="bother-value"') && diaryPage.text.includes('Bothers me:'), 'markup');
    const sliderJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    check('32 js', sliderJs.includes("getElementById('bother')") && sliderJs.includes('addEventListener(\'input\''), 'js');

    const bother11 = await postForm(base, robin.jar, `/visits/${checkId}`, `/visits/${checkId}/diary`, {
      entry_date: shiftDays(-1), text: 'Note', bother: '11'
    });
    check('33', bother11.res.status === 400, bother11.res.status);
    const botherNeg = await postForm(base, robin.jar, `/visits/${checkId}`, `/visits/${checkId}/diary`, {
      entry_date: shiftDays(-1), text: 'Note', bother: '-1'
    });
    const botherAbc = await postForm(base, robin.jar, `/visits/${checkId}`, `/visits/${checkId}/diary`, {
      entry_date: shiftDays(-1), text: 'Note', bother: 'abc'
    });
    check('34', botherNeg.res.status === 400 && botherAbc.res.status === 400, `${botherNeg.res.status} ${botherAbc.res.status}`);
    const emptyNote = await postForm(base, robin.jar, `/visits/${checkId}`, `/visits/${checkId}/diary`, {
      entry_date: shiftDays(-1), text: '  ', bother: '2'
    });
    check('35', emptyNote.res.status === 400 && emptyNote.res.text.includes('Note cannot be empty.'), emptyNote.res.status);

    const entryId = Number(diaryPage.text.match(/action="\/diary\/(\d+)\/delete"/)[1]);
    const delDiary = await postForm(base, robin.jar, `/visits/${checkId}`, `/diary/${entryId}/delete`, {});
    check('36 status', delDiary.res.status === 302, delDiary.res.status);
    const diaryGone = await request(base, robin.jar, 'GET', `/visits/${checkId}`);
    check('36 gone', !diaryGone.text.includes('Screen feels blurry late at night.'), 'still there');

    const meds = await request(base, robin.jar, 'GET', '/medicines');
    check('37', meds.status === 200
      && meds.text.includes('Sample Tablet A / 1 tablet / morning')
      && meds.text.includes('Example Drops B / 2 drops / evening'), 'rows');
    check('42', !/interaction|warning|suggest|recommended dose/i.test(meds.text.replace(DISCLAIMER, '')), 'advice words');

    const addedMed = await postForm(base, robin.jar, '/medicines', '/medicines', {
      name: 'Sample Cream C', dose_text: 'thin layer', when_text: 'as needed'
    });
    check('38 status', addedMed.res.status === 302 && loc(addedMed.res).startsWith('/medicines'), loc(addedMed.res));
    const meds3 = await request(base, robin.jar, 'GET', '/medicines');
    check('38 rows', meds3.text.includes('Sample Cream C / thin layer / as needed'), 'row');

    const emptyMed = await postForm(base, robin.jar, '/medicines', '/medicines', {
      name: '  ', dose_text: 'thin layer', when_text: 'as needed'
    });
    check('39', emptyMed.res.status === 400 && emptyMed.res.text.includes('Name is required.')
      && emptyMed.res.text.includes('value="thin layer"') && emptyMed.res.text.includes('value="as needed"'), emptyMed.res.status);

    const dropsId = Number(meds3.text.match(/Example Drops B[\s\S]*?action="\/medicines\/(\d+)"/)[1]);
    const edited = await postForm(base, robin.jar, '/medicines', `/medicines/${dropsId}`, {
      name: 'Example Drops B', dose_text: '1 drop', when_text: 'evening'
    });
    check('40 status', edited.res.status === 302, edited.res.status);
    const medsEdited = await request(base, robin.jar, 'GET', '/medicines');
    check('40 row', medsEdited.text.includes('Example Drops B / 1 drop / evening'), 'row');

    const creamId = Number(meds3.text.match(/Sample Cream C[\s\S]*?action="\/medicines\/(\d+)"/)[1]);
    const delMed = await postForm(base, robin.jar, '/medicines', `/medicines/${creamId}/delete`, {});
    check('41 status', delMed.res.status === 302, delMed.res.status);
    const medsAfter = await request(base, robin.jar, 'GET', '/medicines');
    check('41 gone', !medsAfter.text.includes('Sample Cream C'), 'still there');
    check('41 two', medsAfter.text.includes('Sample Tablet A / 1 tablet / morning') && medsAfter.text.includes('Example Drops B / 1 drop / evening'), 'rows');

    const brief = await request(base, robin.jar, 'GET', `/visits/${checkId}/brief`);
    check('43 status', brief.status === 200, brief.status);
    check('43 who', brief.text.includes('Robin Sample') && brief.text.includes('Check-up at Example Family Clinic (fictional)')
      && brief.text.includes(shiftDays(7)) && brief.text.includes('Dr. Placeholder (fictional)'), 'header');
    check('43 access', brief.text.indexOf('How to communicate with me') < brief.text.indexOf('My questions (most important first)'), 'access');
    const sectionOrder = [
      'My questions (most important first)',
      'My notes since last time',
      'Medicines I take (as I typed them)',
      DISCLAIMER
    ];
    let cursor = -1;
    let orderOk = true;
    for (const heading of sectionOrder) {
      const at = brief.text.indexOf(heading);
      if (at <= cursor) orderOk = false;
      cursor = at;
    }
    check('43 order', orderOk, 'order');
    check('43 top three', brief.text.includes('If we only have time for three') && brief.text.includes('If there is time'), 'cut');

    const briefQs = [...brief.text.matchAll(/<li>\s*<span class="tick([^"]*)"[\s\S]*?<\/span>\s*<span class="visually-hidden">[\s\S]*?<\/span>\s*([^<]+)<\/li>/g)]
      .map((match) => ({ asked: match[1].includes('is-on'), text: match[2].trim() }));
    const pageQs = questionsOn((await request(base, robin.jar, 'GET', `/visits/${checkId}`)).text);
    check('44', briefQs.map((item) => item.text).join('|') === pageQs.map((item) => item.text).join('|'), briefQs.map((item) => item.text).join(' | '));

    const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'app.css'), 'utf8');
    check('45 hide', /@media print[\s\S]*\.site-header[\s\S]*display:\s*none/.test(css) && css.includes('.no-print'), 'css');
    check('45 colors', css.includes('background: #fff') && css.includes('color: #000'), 'colors');
    check('45 large font', /body\.large-text[\s\S]*font-size:\s*22px/.test(css), '22px');
    const screenCss = cssOutsidePrint(css);
    check('large print screen', /body\.large-print[\s\S]{0,500}font-size\s*:/.test(screenCss), 'screen rule missing');
    check('mono wrap', /\.mono\s*\{[^}]*overflow-wrap:\s*anywhere/.test(css), 'mono');
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const nvmrc = fs.readFileSync(path.join(__dirname, '..', '.nvmrc'), 'utf8').trim();
    const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
    check('node engine', pkg.engines && String(pkg.engines.node).startsWith('>=22'), pkg.engines && pkg.engines.node);
    check('nvmrc', nvmrc === '22', nvmrc);
    check('readme node', /Node\.js 22/.test(readme) && !/Node\.js 20/.test(readme), 'readme node');
    check('readme english', !/[\u4e00-\u9fff]/.test(readme), 'chinese');
    check('readme one account', readme.includes('demo@visitsheet.example')
      && !readme.includes('caregiver@visitsheet.example')
      && !readme.includes('Alex Example'), 'readme account');
    check('57 contrast', contrast('#1c1915', '#f3eee6') >= 7 && contrast('#ffffff', '#000000') >= 7 && contrast('#ffe14a', '#000000') >= 7, 'ratio');

    const longTake = await postForm(base, robin.jar, `/visits/${checkId}`, `/visits/${checkId}/takeaways`, {
      takeaways: 'T'.repeat(2001)
    });
    check('47', longTake.res.status === 400 && longTake.res.text.includes('2000 characters or fewer'), longTake.res.status);
    const savedTake = await postForm(base, robin.jar, `/visits/${checkId}`, `/visits/${checkId}/takeaways`, {
      takeaways: 'Keep walking. Write down headache times.'
    });
    check('46 save', savedTake.res.status === 302, savedTake.res.status);
    const briefTake = await request(base, robin.jar, 'GET', `/visits/${checkId}/brief`);
    check('46 text', briefTake.text.includes('Takeaways') && briefTake.text.includes('Keep walking. Write down headache times.'), 'text');
    check('46 tick', briefQs.length > 0 && briefTake.text.includes('tick is-on'), 'tick');

    const exported = await request(base, robin.jar, 'GET', `/visits/${checkId}/export.json`);
    check('48 status', exported.status === 200, exported.status);
    check('48 type', (exported.headers.get('content-type') || '').includes('application/json'), exported.headers.get('content-type'));
    check('48 disposition', (exported.headers.get('content-disposition') || '').includes('attachment'), exported.headers.get('content-disposition'));
    const payload = JSON.parse(exported.text);
    check('48 keys', payload.visit && Array.isArray(payload.questions) && Array.isArray(payload.diary) && Array.isArray(payload.medicines), 'keys');
    check('48 order', payload.questions.map((item) => item.position).join(',') === payload.questions.map((_, index) => index + 1).join(','), 'positions');
    check('48 secret', !exported.text.includes('password_hash') && !exported.text.includes('Test question for Alex'), 'secret');

    const followBrief = await request(base, robin.jar, 'GET', `/visits/${followId}/brief`);
    check('49', followBrief.status === 200 && followBrief.text.includes('No notes yet.') && !followBrief.text.includes('<table'), followBrief.status);

    const sandboxB = await login(base, 'demo@visitsheet.example', 'demo-pass-48');
    check('50 login', sandboxB.res.status === 302 && loc(sandboxB.res) === '/dashboard', `${sandboxB.res.status} ${loc(sandboxB.res)}`);
    const sandboxDash = await request(base, sandboxB.jar, 'GET', '/dashboard');
    const sandboxCheck = Number((sandboxDash.text.match(/href="\/visits\/(\d+)">Check-up/) || [])[1]);
    check('50 fresh sandbox', sandboxDash.status === 200
      && sandboxDash.text.includes('Hello, Robin Sample')
      && sandboxDash.text.includes('in 7 days')
      && sandboxDash.text.includes('Check-up at Example Family Clinic (fictional)')
      && !sandboxDash.text.includes('<script>alert(1)</script>')
      && sandboxCheck !== checkId, sandboxDash.status);
    check('51', (await request(base, sandboxB.jar, 'GET', `/visits/${checkId}`)).status === 404, 'visit');
    const sandboxEdit = await postForm(base, sandboxB.jar, '/dashboard', `/visits/${checkId}/details`, {
      title: 'Hijacked title',
      visit_date: shiftDays(7),
      with_whom: 'Nobody'
    });
    check('edit isolation', sandboxEdit.res.status === 404, sandboxEdit.res.status);
    check('52 brief', (await request(base, sandboxB.jar, 'GET', `/visits/${checkId}/brief`)).status === 404, 'brief');
    check('52 export', (await request(base, sandboxB.jar, 'GET', `/visits/${checkId}/export.json`)).status === 404, 'export');
    const robinQuestionId = pageQs[0].id;
    const sandboxDelete = await postForm(base, sandboxB.jar, '/dashboard', `/questions/${robinQuestionId}/delete`, {});
    check('53 status', sandboxDelete.res.status === 404, sandboxDelete.res.status);
    const stillThere = await request(base, robin.jar, 'GET', `/visits/${checkId}`);
    check('53 remains', stillThere.text.includes(`id="q-${robinQuestionId}"`), 'gone');
    const sandboxMed = await postForm(base, sandboxB.jar, '/dashboard', `/medicines/${dropsId}`, {
      name: 'Example Drops B', dose_text: '9 drops', when_text: 'evening'
    });
    check('54 status', sandboxMed.res.status === 404, sandboxMed.res.status);
    const robinMeds = await request(base, robin.jar, 'GET', '/medicines');
    check('54 unchanged', robinMeds.text.includes('Example Drops B / 1 drop / evening') && !robinMeds.text.includes('9 drops'), 'changed');
    const sandboxMeds = await request(base, sandboxB.jar, 'GET', '/medicines');
    check('55 own meds', sandboxMeds.status === 200
      && sandboxMeds.text.includes('Example Drops B / 2 drops / evening')
      && !sandboxMeds.text.includes('1 drop')
      && !sandboxMeds.text.includes('9 drops'), 'meds');
    const sandboxMarker = await postForm(base, sandboxB.jar, '/dashboard', '/visits', {
      title: 'Sandbox B marker',
      visit_date: shiftDays(40),
      with_whom: 'Nurse Demo (fictional)'
    });
    check('55 marker', sandboxMarker.res.status === 302, sandboxMarker.res.status);

    const displayOut = await request(base, {}, 'GET', '/display');
    check('display public', displayOut.status === 200 && displayOut.text.includes('Large text'), displayOut.status);
    const guest = {};
    const guestDisplay = await request(base, guest, 'GET', '/display');
    const guestSave = await request(base, guest, 'POST', '/display', {
      _csrf: csrf(guestDisplay.text),
      large_text: '1',
      high_contrast: '1'
    });
    check('display save', guestSave.status === 302, guestSave.status);
    const guestLogin = await request(base, guest, 'GET', '/login');
    check('display on login', guestLogin.text.includes('class="large-text high-contrast"'), guestLogin.text.match(/<body[^>]*>/)[0]);

    const setOn = await postForm(base, robin.jar, '/settings', '/settings', { large_text: '1', high_contrast: '1' });
    check('56 status', setOn.res.status === 302 && loc(setOn.res).startsWith('/settings'), loc(setOn.res));
    const settingsPage = await request(base, robin.jar, 'GET', '/settings');
    check('56 class', settingsPage.text.includes('class="large-text high-contrast"'), settingsPage.text.match(/<body[^>]*>/)[0]);
    check('57 class', settingsPage.text.includes('high-contrast'), 'class');
    const loggedOut = await postForm(base, robin.jar, '/settings', '/logout', {});
    check('11 status', loggedOut.res.status === 302 && loc(loggedOut.res) === '/login', loc(loggedOut.res));
    const afterOut = await request(base, robin.jar, 'GET', '/dashboard');
    check('11 dashboard', afterOut.status === 302 && loc(afterOut) === '/login', loc(afterOut));
    const loginAgain = await request(base, robin.jar, 'GET', '/login');
    check('58 logged out class', loginAgain.text.includes('large-text') && loginAgain.text.includes('high-contrast'), 'class');
    const robin2 = await loginWithJar(base, robin.jar, 'demo@visitsheet.example', 'demo-pass-48');
    const backSettings = await request(base, robin.jar, 'GET', '/settings');
    check('58 still on', robin2.res.status === 302 && backSettings.text.includes('class="large-text high-contrast"'), backSettings.text.match(/<body[^>]*>/)[0]);
    const freshDash = await request(base, robin.jar, 'GET', '/dashboard');
    check('58 fresh sandbox', !freshDash.text.includes('<script>alert(1)</script>') && freshDash.text.includes('in 7 days') && !freshDash.text.includes('Eye check (fictional)'), 'sandbox');

    check('59 tabindex', !/tabindex="[1-9]/.test(settingsPage.text + dash.text + visit.text), 'positive tabindex');
    check('59 focus css', css.includes(':focus') && css.includes('outline:'), 'focus');

    const pages = [
      ['login', loginPage.text],
      ['about', about.text],
      ['display', displayOut.text],
      ['dashboard', dash.text],
      ['visit', visit.text],
      ['brief', brief.text],
      ['medicines', meds.text],
      ['settings', settingsPage.text],
      ['about me', (await request(base, robin.jar, 'GET', '/about-me')).text],
      ['delete', (await request(base, robin.jar, 'GET', `/visits/${checkId}/delete`)).text],
      ['reset', (await request(base, robin.jar, 'GET', '/demo/reset')).text],
      ['404', missing.text]
    ];
    for (const [name, html] of pages) {
      const problems = formProblems(html);
      check(`60 ${name}`, problems.length === 0, problems.join('; '));
      check(`61 h1 ${name}`, (html.match(/<h1\b/g) || []).length === 1, 'h1');
      check(`61 lang ${name}`, html.includes('<html lang="en">'), 'lang');
      check(`67 ${name}`, html.includes(DISCLAIMER), 'footer');
      const external = html.match(/(?:src|href)="(?:https?:)?\/\/[^"]+"/g) || [];
      check(`68 ${name}`, external.length === 0, external.join(','));
    }

    const dropsBefore = await request(base, robin.jar, 'GET', '/medicines');
    const dropsBeforeId = Number(dropsBefore.text.match(/Example Drops B[\s\S]*?action="\/medicines\/(\d+)"/)[1]);
    await postForm(base, robin.jar, '/medicines', `/medicines/${dropsBeforeId}`, {
      name: 'Example Drops B', dose_text: '1 drop', when_text: 'evening'
    });
    const reset = await postForm(base, robin.jar, '/demo/reset', '/demo/reset', {});
    check('62 status', reset.res.status === 302 && loc(reset.res) === '/dashboard', loc(reset.res));
    const resetDash = await request(base, robin.jar, 'GET', '/dashboard');
    check('62 visits', resetDash.text.includes('Check-up at Example Family Clinic (fictional)')
      && resetDash.text.includes('Follow-up at Sample Street Clinic (fictional)')
      && resetDash.text.includes('Last visit at Sample Street Clinic (fictional)')
      && !resetDash.text.includes('Eye check'), 'visits');
    check('62 class off', !resetDash.text.includes('large-text') && !resetDash.text.includes('high-contrast'), resetDash.text.match(/<body[^>]*>/)[0]);
    const resetMeds = await request(base, robin.jar, 'GET', '/medicines');
    check('62 meds', resetMeds.text.includes('Example Drops B / 2 drops / evening'), 'meds');
    const resetVisit = await request(base, robin.jar, 'GET', `/visits/${Number(resetDash.text.match(/href="\/visits\/(\d+)">Check-up/)[1])}`);
    check('62 questions', questionsOn(resetVisit.text).length === 4, 'questions');
    const sandboxStill = await request(base, sandboxB.jar, 'GET', '/dashboard');
    check('63', sandboxStill.text.includes('Sandbox B marker')
      && !resetDash.text.includes('Sandbox B marker')
      && sandboxStill.text.includes('Check-up at Example Family Clinic (fictional)'), 'sandbox');

    const resetTokenPage = await request(base, robin.jar, 'GET', '/demo/reset');
    const marker = 'Reset marker visit';
    await postForm(base, robin.jar, '/dashboard', '/visits', {
      title: marker, visit_date: shiftDays(40), with_whom: 'Nurse Demo (fictional)'
    });
    const afterMarkerDash = await request(base, robin.jar, 'GET', '/dashboard');
    check('marker last visit',
      afterMarkerDash.text.includes('Last visit at Sample Street Clinic (fictional)')
      && afterMarkerDash.text.includes(shiftDays(-30)),
      shiftDays(-30));
    const nextAfterMarker = Number((afterMarkerDash.text.match(/href="\/visits\/(\d+)">Check-up/) || [])[1]);
    const offeredPage = await request(base, robin.jar, 'GET', `/visits/${nextAfterMarker}`);
    check('marker carry offered',
      offeredPage.text.includes('Who do I call if the headache comes back on a weekend?')
      && offeredPage.text.includes(`From Last visit at Sample Street Clinic (fictional) (${shiftDays(-30)})`),
      'carry source changed');
    const noToken = await request(base, robin.jar, 'POST', '/demo/reset', { title: 'ignored' });
    check('64 status', noToken.status === 403, noToken.status);
    const afterNoToken = await request(base, robin.jar, 'GET', '/dashboard');
    check('64 unchanged', afterNoToken.text.includes(marker), 'wiped');
    check('64 had token page', resetTokenPage.status === 200, resetTokenPage.status);

    const pastBrief = await request(base, robin.jar, 'GET', `/visits/${pastId}`);
    check('past old id', pastBrief.status === 404
      || (pastBrief.status === 200 && pastBrief.text.includes('Last visit at Sample Street Clinic (fictional)')), String(pastBrief.status));
    const pastNow = Number(resetDash.text.match(/href="\/visits\/(\d+)">Last visit/)[1]);
    const nextNow = Number(resetDash.text.match(/href="\/visits\/(\d+)">Check-up/)[1]);
    const pastPage = await request(base, robin.jar, 'GET', `/visits/${pastNow}`);
    check('past asked', /id="asked-\d+"[^>]*checked/.test(pastPage.text) && pastPage.text.includes('Keep walking. Write down headache times.'), 'past');

    const nextPage = await request(base, robin.jar, 'GET', `/visits/${nextNow}`);
    check('prior visit is seed past',
      nextPage.text.includes(`From Last visit at Sample Street Clinic (fictional) (${shiftDays(-30)})`),
      `expected Last visit at Sample Street Clinic (fictional) (${shiftDays(-30)})`);
    const carrySources = [...nextPage.text.matchAll(/name="source_question_id" value="(\d+)"/g)].map((match) => match[1]);
    check('carry source', carrySources.length === 1 && nextPage.text.includes('Who do I call if the headache comes back on a weekend?'), String(carrySources.length));
    const beforeCarry = questionsOn(nextPage.text);
    check('carry not yet listed', !beforeCarry.some((item) => item.text.includes('Who do I call')), beforeCarry.map((item) => item.text).join(' | '));
    const carried = await postForm(base, robin.jar, `/visits/${nextNow}`, `/visits/${nextNow}/carry`, {
      source_question_id: carrySources[0]
    });
    check('carry status', carried.res.status === 302 && loc(carried.res).includes('#questions'), `${carried.res.status} ${loc(carried.res)}`);
    const carriedPage = await request(base, robin.jar, 'GET', `/visits/${nextNow}`);
    const carriedQs = questionsOn(carriedPage.text);
    check('carry appended', carriedQs.length === beforeCarry.length + 1
      && carriedQs[carriedQs.length - 1].text === 'Who do I call if the headache comes back on a weekend?',
      carriedQs.map((item) => item.text).join(' | '));
    const duplicate = await postForm(base, robin.jar, `/visits/${nextNow}`, `/visits/${nextNow}/carry`, {
      source_question_id: carrySources[0]
    });
    check('carry duplicate status', duplicate.res.status === 302, duplicate.res.status);
    const duplicateQs = questionsOn((await request(base, robin.jar, 'GET', `/visits/${nextNow}`)).text);
    check('carry duplicate noop', duplicateQs.length === carriedQs.length
      && duplicateQs.filter((item) => item.text.includes('Who do I call')).length === 1, String(duplicateQs.length));
    const askedSource = (pastPage.text.match(/id="asked-(\d+)"[^>]*checked/) || [])[1];
    check('carry asked id', Boolean(askedSource), 'missing asked source');
    const askedCarry = await postForm(base, robin.jar, `/visits/${nextNow}`, `/visits/${nextNow}/carry`, {
      source_question_id: askedSource
    });
    check('carry asked 404', askedCarry.res.status === 404, askedCarry.res.status);
    const afterAsked = questionsOn((await request(base, robin.jar, 'GET', `/visits/${nextNow}`)).text);
    check('carry asked unchanged', afterAsked.length === carriedQs.length, String(afterAsked.length));
    const crossCarry = await postForm(base, sandboxB.jar, `/visits/${sandboxCheck}`, `/visits/${sandboxCheck}/carry`, {
      source_question_id: carrySources[0]
    });
    check('carry cross 404', crossCarry.res.status === 404, crossCarry.res.status);
    const sandboxQuestions = questionsOn((await request(base, sandboxB.jar, 'GET', `/visits/${sandboxCheck}`)).text);
    check('carry cross unchanged', !sandboxQuestions.some((item) => item.text.includes('Who do I call')), sandboxQuestions.map((item) => item.text).join(' | '));

    const other = await login(base, 'demo@visitsheet.example', 'demo-pass-48');
    const otherDash = await request(base, other.jar, 'GET', '/dashboard');
    check('sandbox', !otherDash.text.includes(marker) && otherDash.text.includes('in 7 days'), 'shared');

    const files = walk(path.join(__dirname, '..')).filter((file) => {
      return !file.includes(`${path.sep}node_modules${path.sep}`)
        && !file.includes(`${path.sep}tests${path.sep}`)
        && !file.endsWith('.db');
    });
    const blob = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    check('66 accura', !/accura/i.test(blob), 'accura');
    check('66 proven', !/proven/i.test(blob), 'proven');
    check('66 clinically', !/clinically/i.test(blob), 'clinically');
    const diagnoseHits = blob.match(/diagnos\w*/gi) || [];
    check('66 diagnos', diagnoseHits.every((word) => word.toLowerCase() === 'diagnose'), diagnoseHits.join(','));
    check('69 env', !fs.existsSync(path.join(__dirname, '..', '.env')) && !/process\.env\.(?!PORT\b|SESSION_SECRET\b|DB_PATH\b)/.test(blob), 'env');
    check('65 names', !/\b(John|Jane|Smith|Memorial|Mayo|Pfizer|Aspirin)\b/.test(blob), 'names');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    for (const suffix of ['', '-shm', '-wal']) {
      fs.rmSync(dbPath + suffix, { force: true });
    }
  }

  assert.deepEqual(failures, [], failures.join('\n'));
});

function safeErrorPage(html) {
  return html.includes(DISCLAIMER)
    && html.includes('Something went wrong')
    && html.includes('<html lang="en">')
    && html.includes('href="/css/app.css"')
    && html.includes('>VisitSheet<')
    && !html.includes('ReferenceError')
    && !html.includes('display is not defined')
    && !html.includes('/workspace')
    && !html.includes('node_modules')
    && !/<pre[\s>]/i.test(html);
}

function cssOutsidePrint(source) {
  let out = '';
  let index = 0;
  while (index < source.length) {
    const start = source.indexOf('@media print', index);
    if (start === -1) {
      out += source.slice(index);
      break;
    }
    out += source.slice(index, start);
    const brace = source.indexOf('{', start);
    let depth = 0;
    let cursor = brace;
    for (; cursor < source.length; cursor += 1) {
      if (source[cursor] === '{') depth += 1;
      else if (source[cursor] === '}') {
        depth -= 1;
        if (depth === 0) {
          cursor += 1;
          break;
        }
      }
    }
    index = cursor;
  }
  return out;
}

async function sendRaw(base, jar, method, urlPath, options) {
  const headers = {};
  const cookie = Object.entries(jar).map(([key, value]) => `${key}=${value}`).join('; ');
  if (cookie) headers.cookie = cookie;
  if (options.contentType) headers['content-type'] = options.contentType;
  const res = await fetch(base + urlPath, {
    method,
    headers,
    body: options.body,
    redirect: 'manual'
  });
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const line of setCookies) {
    const pair = line.split(';')[0];
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!value || /max-age=0/i.test(line)) delete jar[name];
    else jar[name] = value;
  }
  return {
    status: res.status,
    headers: res.headers,
    text: await res.text(),
    location: res.headers.get('location'),
    setCookies
  };
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(js|ejs|css|md|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}

async function request(base, jar, method, urlPath, body) {
  const headers = {};
  const cookie = Object.entries(jar).map(([key, value]) => `${key}=${value}`).join('; ');
  if (cookie) headers.cookie = cookie;
  let payload;
  if (body) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(body).toString();
  }
  const res = await fetch(base + urlPath, { method, headers, body: payload, redirect: 'manual' });
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const line of setCookies) {
    const pair = line.split(';')[0];
    const index = pair.indexOf('=');
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!value || /max-age=0/i.test(line)) delete jar[name];
    else jar[name] = value;
  }
  return {
    status: res.status,
    headers: res.headers,
    text: await res.text(),
    location: res.headers.get('location'),
    setCookies
  };
}

async function login(base, email, password) {
  const jar = {};
  return loginWithJar(base, jar, email, password);
}

async function loginWithJar(base, jar, email, password) {
  const page = await request(base, jar, 'GET', '/login');
  const res = await request(base, jar, 'POST', '/login', {
    _csrf: csrf(page.text),
    email,
    password
  });
  return { jar, page, res };
}

async function postForm(base, jar, pagePath, action, fields) {
  const page = await request(base, jar, 'GET', pagePath);
  const res = await request(base, jar, 'POST', action, { _csrf: csrf(page.text), ...fields });
  return { page, res };
}

function csrf(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  if (!match) throw new Error('CSRF token missing');
  return match[1];
}

function loc(res) {
  const value = res.location || '';
  try {
    const url = new URL(value, 'http://127.0.0.1');
    return `${url.pathname}${url.search}${url.hash}`;
  } catch (_err) {
    return value;
  }
}

function questionsOn(html) {
  return [...html.matchAll(/<li id="q-(\d+)"[\s\S]*?<span class="q-num">(\d+)\.<\/span> ([^<]*)<\/p>/g)]
    .map((match) => ({ id: Number(match[1]), n: Number(match[2]), text: match[3] }));
}

function formProblems(html) {
  const problems = [];
  const tags = html.match(/<(input|textarea|select)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const type = ((tag.match(/\btype="([^"]+)"/i) || [])[1] || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'image'].includes(type)) continue;
    const id = (tag.match(/\bid="([^"]+)"/) || [])[1];
    if (!id) {
      problems.push(`no id ${tag.slice(0, 80)}`);
      continue;
    }
    if (!new RegExp(`<label[^>]*\\bfor="${id}"`).test(html)) problems.push(`no label ${id}`);
    if (/aria-invalid="true"/.test(tag)) {
      const described = tag.match(/aria-describedby="([^"]+)"/);
      if (!described) problems.push(`no describedby ${id}`);
      else {
        for (const ref of described[1].split(/\s+/)) {
          if (!html.includes(`id="${ref}"`)) problems.push(`missing ${ref}`);
        }
      }
    }
  }
  return problems;
}

function contrast(a, b) {
  const lum = (hex) => {
    const n = hex.slice(1);
    const channels = [0, 2, 4].map((index) => {
      const channel = parseInt(n.slice(index, index + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const left = lum(a);
  const right = lum(b);
  const hi = Math.max(left, right);
  const lo = Math.min(left, right);
  return (hi + 0.05) / (lo + 0.05);
}
