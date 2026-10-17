'use strict';

const { isRealISODate } = require('./dates');

function str(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

function validateLogin(body) {
  const email = str(body.email);
  const password = str(body.password);
  const errors = {};
  if (!email.trim()) errors.email = 'Email is required.';
  if (!password) errors.password = 'Password is required.';
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    email,
    password
  };
}

function validateVisit(body) {
  const title = str(body.title).trim();
  const visit_date = str(body.visit_date).trim();
  const with_whom = str(body.with_whom).trim();
  const errors = {};
  if (!title) errors.title = 'Title is required.';
  else if ([...title].length > 120) errors.title = 'Title must be 120 characters or fewer.';
  if (!isRealISODate(visit_date)) errors.visit_date = 'Enter a real date as YYYY-MM-DD.';
  if ([...with_whom].length > 120) errors.with_whom = 'With whom must be 120 characters or fewer.';
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values: { title, visit_date, with_whom }
  };
}

function validateQuestion(body) {
  const raw = str(body.text);
  const text = raw.trim();
  if (!text) {
    return { ok: false, error: 'Question cannot be empty', value: raw };
  }
  if ([...text].length > 300) {
    return { ok: false, error: 'Question must be 300 characters or fewer.', value: text };
  }
  return { ok: true, error: '', value: text };
}

function validateDiary(body) {
  const entry_date = str(body.entry_date).trim();
  const text = str(body.text).trim();
  const botherRaw = str(body.bother).trim();
  const errors = {};
  if (!isRealISODate(entry_date)) errors.entry_date = 'Enter a real date as YYYY-MM-DD.';
  if (!text) errors.text = 'Note cannot be empty.';
  else if ([...text].length > 500) errors.text = 'Note must be 500 characters or fewer.';
  const bother = parseBother(botherRaw);
  if (bother === null) errors.bother = 'Bother must be a whole number from 0 to 10.';
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values: {
      entry_date,
      text: str(body.text).trim() ? text : str(body.text),
      bother: bother === null ? botherRaw : String(bother),
      botherNumber: bother
    }
  };
}

function parseBother(raw) {
  if (!/^-?\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 10) return null;
  return n;
}

function validateMedicine(body) {
  const name = str(body.name).trim();
  const dose_text = str(body.dose_text).trim();
  const when_text = str(body.when_text).trim();
  const errors = {};
  if (!name) errors.name = 'Name is required.';
  else if ([...name].length > 80) errors.name = 'Name must be 80 characters or fewer.';
  if ([...dose_text].length > 80) errors.dose_text = 'Dose must be 80 characters or fewer.';
  if ([...when_text].length > 80) errors.when_text = 'When must be 80 characters or fewer.';
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values: { name, dose_text, when_text }
  };
}

function validateTakeaways(body) {
  const takeaways = str(body.takeaways);
  if ([...takeaways].length > 2000) {
    return {
      ok: false,
      error: 'Takeaways must be 2000 characters or fewer.',
      value: takeaways
    };
  }
  return { ok: true, error: '', value: takeaways };
}

function validateProfile(body) {
  const display_name = str(body.display_name).trim();
  const helper_name = str(body.helper_name).trim();
  const access_note = str(body.access_note).trim();
  const errors = {};
  if (!display_name) errors.display_name = 'Name is required.';
  else if ([...display_name].length > 80) errors.display_name = 'Name must be 80 characters or fewer.';
  if ([...helper_name].length > 120) errors.helper_name = 'Helper name must be 120 characters or fewer.';
  if ([...access_note].length > 300) errors.access_note = 'Note must be 300 characters or fewer.';
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values: { display_name, helper_name, access_note }
  };
}

module.exports = {
  str,
  validateLogin,
  validateVisit,
  validateQuestion,
  validateDiary,
  validateMedicine,
  validateTakeaways,
  validateProfile
};
