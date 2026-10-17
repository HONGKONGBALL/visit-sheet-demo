'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const { ACCESS_NEEDS, STARTER_QUESTIONS, needLabel } = require('./access');
const { todayISO, daysBetween, dayLabel } = require('./dates');
const dbApi = require('./db');
const {
  validateLogin,
  validateVisit,
  validateQuestion,
  validateDiary,
  validateMedicine,
  validateTakeaways,
  validateProfile,
  str
} = require('./validators');

const DISCLAIMER = 'VisitSheet organizes your own notes. It is not medical advice. All demo data is fictional.';

function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));

  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; '));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.get('/health', (_req, res) => {
    res.status(200);
    res.setHeader('Content-Type', 'application/json');
    res.end('{"ok":true}');
  });

  app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));
  app.use('/js', express.static(path.join(__dirname, '..', 'public', 'js')));
  app.use('/fonts', express.static(path.join(__dirname, '..', 'public', 'fonts')));
  app.get('/favicon.ico', (_req, res) => {
    res.type('image/png');
    res.sendFile(path.join(__dirname, '..', 'public', 'favicon.png'));
  });
  app.get('/favicon.png', (_req, res) => {
    res.type('image/png');
    res.sendFile(path.join(__dirname, '..', 'public', 'favicon.png'));
  });

  // Session and template locals run before the body parser. A rejected body
  // (oversized payload, bad charset) must still be able to render error.ejs.
  app.use(session({
    name: 'visitsheet.sid',
    secret: process.env.SESSION_SECRET || 'visitsheet-local-demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  }));

  app.use((req, res, next) => {
    assignLocals(req, res);
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  app.get('/', (req, res) => {
    if (res.locals.user) return res.redirect(302, '/dashboard');
    return res.redirect(302, '/login');
  });

  app.get('/login', (req, res) => {
    if (res.locals.user) return res.redirect(302, '/dashboard');
    const fill = req.query.fill === '1';
    res.render('login', {
      title: 'Log in',
      errors: {},
      values: {
        email: fill ? 'demo@visitsheet.example' : '',
        password: fill ? dbApi.DEMO_PASSWORD : ''
      },
      statusCode: 200
    });
  });

  app.post('/login', (req, res, next) => {
    if (!csrfOk(req)) return forbidden(res);
    const check = validateLogin(req.body);
    if (!check.ok) {
      return res.status(400).render('login', {
        title: 'Log in',
        errors: check.errors,
        values: { email: check.email, password: '' }
      });
    }
    const userId = dbApi.authenticate(db, check.email, check.password);
    if (!userId) {
      return res.status(401).render('login', {
        title: 'Log in',
        errors: { form: 'Email or password is wrong.' },
        values: { email: check.email, password: '' }
      });
    }
    const csrf = crypto.randomBytes(32).toString('hex');
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = userId;
      req.session.csrf = csrf;
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.redirect(302, '/dashboard');
      });
    });
  });

  app.post('/logout', (req, res, next) => {
    if (!csrfOk(req)) return forbidden(res);
    if (!res.locals.user) return res.redirect(302, '/login');
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('visitsheet.sid', { path: '/' });
      res.redirect(302, '/login');
    });
  });

  app.get('/about', (_req, res) => {
    res.render('about', { title: 'About VisitSheet' });
  });

  app.get('/display', (_req, res) => {
    res.render('display', { title: 'Display' });
  });

  app.post('/display', (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const display = displayFromBody(req.body);
    if (res.locals.user) dbApi.updatePrefs(db, res.locals.user.id, display.large, display.contrast);
    writeDisplay(res, display);
    res.redirect(302, '/display?saved=1&focus=saved#saved');
  });

  app.get('/dashboard', requireLogin, (req, res) => {
    res.render('dashboard', {
      title: `Hello, ${res.locals.user.display_name}`,
      visits: annotateVisits(dbApi.listVisits(db, res.locals.user.id)),
      errors: {},
      values: { title: '', visit_date: '', with_whom: '' }
    });
  });

  app.post('/visits', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const check = validateVisit(req.body);
    if (!check.ok) {
      return res.status(400).render('dashboard', {
        title: `Hello, ${res.locals.user.display_name}`,
        visits: annotateVisits(dbApi.listVisits(db, res.locals.user.id)),
        errors: check.errors,
        values: check.values
      });
    }
    const id = dbApi.createVisit(db, res.locals.user.id, check.values);
    res.redirect(302, `/visits/${id}?focus=title#title`);
  });

  app.post('/visits/:id/details', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const loaded = loadVisit(req, res);
    if (!loaded) return notFound(res);
    const check = validateVisit(req.body);
    if (!check.ok) {
      return res.status(400).render('visit', {
        title: loaded.visit.title,
        ...loaded,
        visitErrors: check.errors,
        visitValues: check.values,
        errors: {},
        questionValue: '',
        diaryErrors: {},
        diaryValues: { entry_date: '', text: '', bother: '0' },
        takeawaysError: '',
        takeawaysValue: loaded.visit.takeaways,
        focus: 'visit-details'
      });
    }
    dbApi.updateVisit(db, res.locals.user.id, loaded.visit.id, check.values);
    res.redirect(302, `/visits/${loaded.visit.id}?saved=1&focus=title#title`);
  });

  app.get('/visits/:id', requireLogin, (req, res) => {
    const loaded = loadVisit(req, res);
    if (!loaded) return notFound(res);
    res.render('visit', {
      title: loaded.visit.title,
      ...loaded,
      errors: {},
      questionValue: '',
      diaryErrors: {},
      diaryValues: { entry_date: '', text: '', bother: '0' },
      takeawaysError: '',
      takeawaysValue: loaded.visit.takeaways
    });
  });

  app.get('/visits/:id/delete', requireLogin, (req, res) => {
    const visit = ownedVisit(req, res);
    if (!visit) return notFound(res);
    res.render('confirm-delete', { title: 'Delete this visit?', visit });
  });

  app.post('/visits/:id/delete', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const id = parseId(req.params.id);
    if (!id || !dbApi.deleteVisit(db, res.locals.user.id, id)) return notFound(res);
    res.redirect(302, '/dashboard');
  });

  app.post('/visits/:id/takeaways', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const loaded = loadVisit(req, res);
    if (!loaded) return notFound(res);
    const check = validateTakeaways(req.body);
    if (!check.ok) {
      return res.status(400).render('visit', {
        title: loaded.visit.title,
        ...loaded,
        errors: {},
        questionValue: '',
        diaryErrors: {},
        diaryValues: { entry_date: '', text: '', bother: '0' },
        takeawaysError: check.error,
        takeawaysValue: check.value,
        focus: 'takeaways'
      });
    }
    dbApi.updateTakeaways(db, res.locals.user.id, loaded.visit.id, check.value);
    res.redirect(302, `/visits/${loaded.visit.id}?saved=1&focus=takeaways#takeaways`);
  });

  app.post('/visits/:id/questions', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const loaded = loadVisit(req, res);
    if (!loaded) return notFound(res);
    const check = validateQuestion(req.body);
    if (!check.ok) {
      return res.status(400).render('visit', {
        title: loaded.visit.title,
        ...loaded,
        errors: { text: check.error },
        questionValue: check.value,
        diaryErrors: {},
        diaryValues: { entry_date: '', text: '', bother: '0' },
        takeawaysError: '',
        takeawaysValue: loaded.visit.takeaways,
        focus: 'questions'
      });
    }
    dbApi.addQuestion(db, res.locals.user.id, loaded.visit.id, check.value);
    res.redirect(302, `/visits/${loaded.visit.id}?saved=1&focus=questions#questions`);
  });

  app.post('/visits/:id/carry', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const id = parseId(req.params.id);
    const sourceId = parseId(req.body.source_question_id);
    if (!id || !sourceId) return notFound(res);
    const result = dbApi.carryQuestion(db, res.locals.user.id, id, sourceId);
    if (result.status === 404) return notFound(res);
    res.redirect(302, `/visits/${id}?saved=1&focus=questions#questions`);
  });

  app.post('/visits/:id/diary', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const loaded = loadVisit(req, res);
    if (!loaded) return notFound(res);
    const check = validateDiary(req.body);
    if (!check.ok) {
      return res.status(400).render('visit', {
        title: loaded.visit.title,
        ...loaded,
        errors: {},
        questionValue: '',
        diaryErrors: check.errors,
        diaryValues: check.values,
        takeawaysError: '',
        takeawaysValue: loaded.visit.takeaways,
        focus: 'diary'
      });
    }
    dbApi.addDiary(db, res.locals.user.id, loaded.visit.id, check.values);
    res.redirect(302, `/visits/${loaded.visit.id}?saved=1&focus=diary#diary`);
  });

  app.post('/questions/:id/move', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const result = dbApi.moveQuestion(db, res.locals.user.id, id, str(req.body.dir));
    if (result.status === 404) return notFound(res);
    if (result.status === 400) {
      return res.status(400).render('bad-move', {
        title: 'That move is not valid',
        visitId: result.visitId || null
      });
    }
    res.redirect(302, `/visits/${result.visitId}?focus=q-${result.questionId}#q-${result.questionId}`);
  });

  app.post('/questions/:id/asked', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const asked = flagOn(req.body.asked);
    const question = dbApi.setAsked(db, res.locals.user.id, id, asked);
    if (!question) return notFound(res);
    res.redirect(302, `/visits/${question.visit_id}?saved=1&focus=q-${question.id}#q-${question.id}`);
  });

  app.post('/questions/:id/delete', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const visitId = dbApi.deleteQuestion(db, res.locals.user.id, id);
    if (!visitId) return notFound(res);
    res.redirect(302, `/visits/${visitId}?saved=1&focus=questions#questions`);
  });

  app.post('/diary/:id/delete', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const visitId = dbApi.deleteDiary(db, res.locals.user.id, id);
    if (!visitId) return notFound(res);
    res.redirect(302, `/visits/${visitId}?saved=1&focus=diary#diary`);
  });

  app.get('/visits/:id/brief', requireLogin, (req, res) => {
    const loaded = loadVisit(req, res);
    if (!loaded) return notFound(res);
    const largePrint = req.query.text === 'large';
    res.render('brief', {
      title: loaded.visit.title,
      ...loaded,
      medicines: dbApi.listMedicines(db, res.locals.user.id),
      largePrint,
      needLabels: res.locals.user.needs.map((id) => needLabel(id)).filter(Boolean)
    });
  });

  app.get('/visits/:id/export.json', requireLogin, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const bundle = dbApi.exportBundle(db, res.locals.user.id, id);
    if (!bundle) return notFound(res);
    res.status(200);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="visitsheet-visit-${id}.json"`);
    res.end(JSON.stringify(bundle, null, 2));
  });

  app.get('/medicines', requireLogin, (req, res) => {
    res.render('medicines', {
      title: 'Medicines',
      medicines: dbApi.listMedicines(db, res.locals.user.id),
      errors: {},
      values: { name: '', dose_text: '', when_text: '' },
      editId: null,
      editErrors: {},
      editValues: null
    });
  });

  app.post('/medicines', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const check = validateMedicine(req.body);
    if (!check.ok) {
      return res.status(400).render('medicines', {
        title: 'Medicines',
        medicines: dbApi.listMedicines(db, res.locals.user.id),
        errors: check.errors,
        values: check.values,
        editId: null,
        editErrors: {},
        editValues: null
      });
    }
    dbApi.addMedicine(db, res.locals.user.id, check.values);
    res.redirect(302, '/medicines?saved=1&focus=list#list');
  });

  app.post('/medicines/:id', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const id = parseId(req.params.id);
    if (!id || !dbApi.getMedicine(db, res.locals.user.id, id)) return notFound(res);
    const check = validateMedicine(req.body);
    if (!check.ok) {
      return res.status(400).render('medicines', {
        title: 'Medicines',
        medicines: dbApi.listMedicines(db, res.locals.user.id),
        errors: {},
        values: { name: '', dose_text: '', when_text: '' },
        editId: id,
        editErrors: check.errors,
        editValues: check.values
      });
    }
    dbApi.updateMedicine(db, res.locals.user.id, id, check.values);
    res.redirect(302, `/medicines?saved=1&focus=med-${id}#med-${id}`);
  });

  app.post('/medicines/:id/delete', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const id = parseId(req.params.id);
    if (!id || !dbApi.deleteMedicine(db, res.locals.user.id, id)) return notFound(res);
    res.redirect(302, '/medicines?saved=1&focus=list#list');
  });

  app.get('/about-me', requireLogin, (req, res) => {
    const user = res.locals.user;
    res.render('about-me', {
      title: 'About me',
      errors: {},
      values: {
        display_name: user.display_name,
        helper_name: user.helper_name,
        access_note: user.access_note,
        needs: user.needs
      }
    });
  });

  app.post('/about-me', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const check = validateProfile(req.body);
    const needs = selectedNeeds(req.body);
    if (!check.ok) {
      return res.status(400).render('about-me', {
        title: 'About me',
        errors: check.errors,
        values: { ...check.values, needs }
      });
    }
    dbApi.updateProfile(db, res.locals.user.id, check.values, needs);
    res.redirect(302, '/about-me?saved=1&focus=saved#saved');
  });

  app.get('/settings', requireLogin, (_req, res) => {
    res.render('settings', { title: 'Settings' });
  });

  app.post('/settings', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    const display = displayFromBody(req.body);
    dbApi.updatePrefs(db, res.locals.user.id, display.large, display.contrast);
    writeDisplay(res, display);
    res.redirect(302, '/settings?saved=1&focus=saved#saved');
  });

  app.get('/demo/reset', requireLogin, (_req, res) => {
    if (!dbApi.isDemoEmail(res.locals.user.email)) return notAllowed(res);
    res.render('confirm-reset', { title: 'Reset demo data?' });
  });

  app.post('/demo/reset', requireLogin, (req, res) => {
    if (!csrfOk(req)) return forbidden(res);
    if (!dbApi.isDemoEmail(res.locals.user.email)) return notAllowed(res);
    dbApi.resetSandbox(db, res.locals.user.id);
    dbApi.updatePrefs(db, res.locals.user.id, false, false);
    clearDisplay(res);
    res.redirect(302, '/dashboard');
  });

  app.use((req, res) => {
    notFound(res);
  });

  // Do not call next(err). Express's default handler prints the stack and paths.
  app.use((err, req, res, _next) => {
    const status = clientErrorStatus(err);
    if (status >= 500) console.error(err);
    else console.error(`Request rejected ${status}${err && err.type ? ` ${err.type}` : ''}`);
    if (res.headersSent) return;
    try {
      assignLocals(req, res);
    } catch (localsErr) {
      console.error(localsErr);
    }
    res.status(status);
    try {
      res.render('error', { title: 'Something went wrong' }, (renderErr, html) => {
        if (renderErr || !html || responseLeaks(html)) {
          if (renderErr) console.error(renderErr);
          sendSafeError(res, status);
          return;
        }
        res.type('html').send(html);
      });
    } catch (renderErr) {
      console.error(renderErr);
      sendSafeError(res, status);
    }
  });

  return app;

  function assignLocals(req, res) {
    const session = req.session;
    if (session) {
      if (!session.csrf) session.csrf = crypto.randomBytes(32).toString('hex');
      res.locals.csrf = session.csrf;
      res.locals.user = session.userId ? dbApi.getUser(db, session.userId) : null;
      if (session.userId && !res.locals.user) session.userId = null;
    } else {
      res.locals.csrf = '';
      res.locals.user = null;
    }
    res.locals.display = readDisplay(req);
    res.locals.largePrint = false;
    res.locals.saved = Boolean(req.query && req.query.saved === '1');
    res.locals.focus = req.query && typeof req.query.focus === 'string' ? req.query.focus : '';
    res.locals.currentPath = req.path || '';
    res.locals.disclaimer = DISCLAIMER;
    res.locals.today = todayISO();
    res.locals.message = '';
    res.locals.accessNeeds = ACCESS_NEEDS;
    res.locals.demoAccounts = dbApi.ACCOUNTS.map((account) => ({
      email: account.email,
      display_name: account.display_name,
      password: dbApi.DEMO_PASSWORD
    }));
  }

  function requireLogin(req, res, next) {
    if (!res.locals.user) return res.redirect(302, '/login');
    return next();
  }

  function ownedVisit(req, res) {
    const id = parseId(req.params.id);
    if (!id) return null;
    return dbApi.getVisit(db, res.locals.user.id, id);
  }

  function loadVisit(req, res) {
    const visit = ownedVisit(req, res);
    if (!visit) return null;
    const questions = dbApi.listQuestions(db, visit.id);
    const diary = dbApi.listDiary(db, visit.id);
    const previous = dbApi.previousVisit(db, res.locals.user.id, visit);
    let carry = [];
    if (previous) {
      const have = new Set(questions.map((question) => question.text));
      carry = dbApi.listQuestions(db, previous.id).filter((question) => !question.asked && !have.has(question.text));
    }
    const starters = STARTER_QUESTIONS.filter((text) => !questions.some((question) => question.text === text));
    return {
      visit,
      questions,
      top: questions.slice(0, 3),
      rest: questions.slice(3),
      diary,
      previous,
      carry,
      starters,
      visitErrors: {},
      visitValues: {
        title: visit.title,
        visit_date: visit.visit_date,
        with_whom: visit.with_whom
      }
    };
  }
}

function parseId(value) {
  if (!/^[0-9]+$/.test(String(value || ''))) return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

function csrfOk(req) {
  const sent = str(req.body && req.body._csrf) || str(req.get('x-csrf-token'));
  const expected = req.session && req.session.csrf;
  if (!sent || !expected) return false;
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function flagOn(value) {
  if (Array.isArray(value)) return value.includes('1') || value.includes('on');
  return value === '1' || value === 'on';
}

function displayFromBody(body) {
  return {
    large: flagOn(body.large_text),
    contrast: flagOn(body.high_contrast)
  };
}

function selectedNeeds(body) {
  let raw = body.needs;
  if (raw == null) return [];
  if (!Array.isArray(raw)) raw = [raw];
  const allowed = new Set(ACCESS_NEEDS.map((item) => item.id));
  return raw.filter((id) => allowed.has(id));
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch (_err) {
      out[key] = value;
    }
  }
  return out;
}

function readDisplay(req) {
  const raw = parseCookies(req.headers.cookie || '').vs_display || '';
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  return {
    large: parts.includes('large'),
    contrast: parts.includes('contrast')
  };
}

function writeDisplay(res, display) {
  const parts = [];
  if (display.large) parts.push('large');
  if (display.contrast) parts.push('contrast');
  res.append('Set-Cookie', `vs_display=${encodeURIComponent(parts.join(','))}; Path=/; Max-Age=31536000; SameSite=Lax`);
}

function clearDisplay(res) {
  res.append('Set-Cookie', 'vs_display=; Path=/; Max-Age=0; SameSite=Lax');
}

function annotateVisits(visits) {
  const today = todayISO();
  let nextId = null;
  for (const visit of visits) {
    if (visit.visit_date >= today) {
      nextId = visit.id;
      break;
    }
  }
  return visits.map((visit) => {
    const days = daysBetween(today, visit.visit_date);
    return {
      ...visit,
      isNext: visit.id === nextId,
      days,
      whenLabel: dayLabel(days)
    };
  });
}

function clientErrorStatus(err) {
  const type = err && err.type;
  if (type === 'entity.too.large' || type === 'parameters.too.many') return 413;
  if (type === 'charset.unsupported' || type === 'encoding.unsupported') return 415;
  if (
    type === 'entity.parse.failed'
    || type === 'entity.verify.failed'
    || type === 'request.aborted'
    || type === 'request.size.invalid'
    || type === 'querystring.parse.rangeError'
  ) return 400;
  const status = Number(err && (err.status || err.statusCode));
  if (status === 413 || status === 415) return status;
  if (status >= 400 && status < 500) return status;
  return 500;
}

function responseLeaks(html) {
  return /ReferenceError|TypeError|\/workspace\/|\/home\/|node_modules|<pre[\s>]|at Object\.|\.ejs:/i.test(html);
}

function sendSafeError(res, status) {
  if (res.headersSent) return;
  res.status(status);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>Something went wrong · VisitSheet</title></head><body><main id="main">'
    + '<h1>Something went wrong</h1><p>Please try that again.</p>'
    + '<p><a href="/">Back to the start</a></p></main><footer><p>'
    + DISCLAIMER
    + '</p></footer></body></html>'
  );
}

function notFound(res) {
  res.status(404).render('not-found', { title: 'Page not found' });
}

function forbidden(res) {
  res.status(403).render('forbidden', { title: 'Form expired' });
}

function notAllowed(res) {
  res.status(403).render('forbidden', {
    title: 'Not allowed',
    message: 'Reset is only available on the fictional demo account.'
  });
}

module.exports = { createApp, DISCLAIMER };
