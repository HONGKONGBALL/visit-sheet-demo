'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const { shiftDays } = require('./dates');
const { needLabel } = require('./access');

const DEMO_PASSWORD = 'demo-pass-48';
const DUMMY_HASH = bcrypt.hashSync('visitsheet-dummy-not-a-password', 8);

const ACCOUNTS = [
  {
    email: 'demo@visitsheet.example',
    display_name: 'Robin Sample',
    account_key: 'robin',
    helper_name: '',
    access_note: 'Please say one thing at a time.',
    access_needs: ['write']
  }
];

function openDatabase(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  migrate(db);
  removeRetiredAccounts(db);
  ensureTemplates(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      helper_name TEXT NOT NULL DEFAULT '',
      access_note TEXT NOT NULL DEFAULT '',
      access_needs TEXT NOT NULL DEFAULT '[]',
      pref_large_text INTEGER NOT NULL DEFAULT 0,
      pref_high_contrast INTEGER NOT NULL DEFAULT 0,
      account_key TEXT NOT NULL,
      is_template INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      with_whom TEXT NOT NULL DEFAULT '',
      takeaways TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY,
      visit_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      position INTEGER NOT NULL,
      asked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (visit_id) REFERENCES visits(id)
    );

    CREATE TABLE IF NOT EXISTS diary_entries (
      id INTEGER PRIMARY KEY,
      visit_id INTEGER NOT NULL,
      entry_date TEXT NOT NULL,
      text TEXT NOT NULL,
      bother INTEGER NOT NULL,
      FOREIGN KEY (visit_id) REFERENCES visits(id)
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      dose_text TEXT NOT NULL DEFAULT '',
      when_text TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_visits_user ON visits(user_id, visit_date);
    CREATE INDEX IF NOT EXISTS idx_questions_visit ON questions(visit_id, position);
    CREATE INDEX IF NOT EXISTS idx_diary_visit ON diary_entries(visit_id, entry_date);
    CREATE INDEX IF NOT EXISTS idx_medicines_user ON medicines(user_id);
  `);
}

function ensureTemplates(db) {
  const insert = db.prepare(`
    INSERT INTO users (
      email, password_hash, display_name, helper_name, access_note, access_needs,
      pref_large_text, pref_high_contrast, account_key, is_template
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 1)
  `);
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 8);
  const tx = db.transaction(() => {
    for (const account of ACCOUNTS) {
      const existing = db.prepare(
        'SELECT id FROM users WHERE email = ? AND is_template = 1'
      ).get(account.email);
      if (existing) continue;
      insert.run(
        account.email,
        hash,
        account.display_name,
        account.helper_name,
        account.access_note,
        JSON.stringify(account.access_needs),
        account.account_key
      );
    }
  });
  tx();
}

function resetAll(db) {
  db.exec(`
    DELETE FROM diary_entries;
    DELETE FROM questions;
    DELETE FROM medicines;
    DELETE FROM visits;
    DELETE FROM users;
  `);
  ensureTemplates(db);
}

function publicUser(row) {
  if (!row) return null;
  let needs = [];
  try {
    const parsed = JSON.parse(row.access_needs || '[]');
    if (Array.isArray(parsed)) needs = parsed.filter((id) => typeof id === 'string');
  } catch (_err) {
    needs = [];
  }
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    helper_name: row.helper_name,
    access_note: row.access_note,
    needs,
    pref_large_text: row.pref_large_text,
    pref_high_contrast: row.pref_high_contrast,
    account_key: row.account_key,
    is_template: row.is_template
  };
}

function getUser(db, id) {
  return publicUser(db.prepare('SELECT * FROM users WHERE id = ? AND is_template = 0').get(id));
}

function isDemoEmail(email) {
  return ACCOUNTS.some((account) => account.email === email);
}

function authenticate(db, email, password) {
  const lookup = String(email || '').trim().toLowerCase();
  const template = db.prepare(
    'SELECT * FROM users WHERE email = ? AND is_template = 1'
  ).get(lookup);
  if (!template) {
    bcrypt.compareSync(String(password || ''), DUMMY_HASH);
    return null;
  }
  const match = bcrypt.compareSync(String(password || ''), template.password_hash);
  if (!match) return null;
  return createSandbox(db, template);
}

function createSandbox(db, template) {
  const insert = db.prepare(`
    INSERT INTO users (
      email, password_hash, display_name, helper_name, access_note, access_needs,
      pref_large_text, pref_high_contrast, account_key, is_template
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 0)
  `);
  const tx = db.transaction(() => {
    const info = insert.run(
      template.email,
      template.password_hash,
      template.display_name,
      template.helper_name,
      template.access_note,
      template.access_needs,
      template.account_key
    );
    const userId = Number(info.lastInsertRowid);
    seedRobin(db, userId, new Date());
    return userId;
  });
  return tx();
}

function seedRobin(db, userId, today) {
  const nextId = insertVisit(db, userId, {
    title: 'Check-up at Example Family Clinic (fictional)',
    visit_date: shiftDays(7, today),
    with_whom: 'Dr. Placeholder (fictional)',
    takeaways: ''
  });
  insertQuestion(db, nextId, 'Is it OK to keep doing my morning walk?', 0);
  insertQuestion(db, nextId, 'Can we go over when I take Sample Tablet A?', 0);
  insertQuestion(db, nextId, 'Can we look at the notes I wrote down?', 0);
  insertQuestion(db, nextId, 'How do I tell the clinic how I communicate?', 0);
  insertDiary(db, nextId, shiftDays(-8, today), 'Mild headache after lunch, gone by evening.', 3);
  insertDiary(db, nextId, shiftDays(-5, today), 'Slept badly, felt tired all day.', 5);

  const pastId = insertVisit(db, userId, {
    title: 'Last visit at Sample Street Clinic (fictional)',
    visit_date: shiftDays(-30, today),
    with_whom: 'Nurse Demo (fictional)',
    takeaways: 'Keep walking. Write down headache times.'
  });
  insertQuestion(db, pastId, 'Is it OK to keep doing my morning walk?', 1);
  insertQuestion(db, pastId, 'Who do I call if the headache comes back on a weekend?', 0);

  const laterId = insertVisit(db, userId, {
    title: 'Follow-up at Sample Street Clinic (fictional)',
    visit_date: shiftDays(25, today),
    with_whom: 'Nurse Demo (fictional)',
    takeaways: ''
  });
  insertQuestion(db, laterId, 'What should I bring next time?', 0);

  insertMedicine(db, userId, 'Sample Tablet A', '1 tablet', 'morning');
  insertMedicine(db, userId, 'Example Drops B', '2 drops', 'evening');
}

function insertVisit(db, userId, visit) {
  const info = db.prepare(`
    INSERT INTO visits (user_id, title, visit_date, with_whom, takeaways)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, visit.title, visit.visit_date, visit.with_whom, visit.takeaways || '');
  return Number(info.lastInsertRowid);
}

function insertQuestion(db, visitId, text, asked) {
  const row = db.prepare(
    'SELECT COALESCE(MAX(position), 0) AS max_pos FROM questions WHERE visit_id = ?'
  ).get(visitId);
  const info = db.prepare(`
    INSERT INTO questions (visit_id, text, position, asked) VALUES (?, ?, ?, ?)
  `).run(visitId, text, row.max_pos + 1, asked ? 1 : 0);
  return Number(info.lastInsertRowid);
}

function insertDiary(db, visitId, entryDate, text, bother) {
  const info = db.prepare(`
    INSERT INTO diary_entries (visit_id, entry_date, text, bother) VALUES (?, ?, ?, ?)
  `).run(visitId, entryDate, text, bother);
  return Number(info.lastInsertRowid);
}

function insertMedicine(db, userId, name, dose, when) {
  const info = db.prepare(`
    INSERT INTO medicines (user_id, name, dose_text, when_text) VALUES (?, ?, ?, ?)
  `).run(userId, name, dose, when);
  return Number(info.lastInsertRowid);
}

function removeRetiredAccounts(db) {
  const retired = db.prepare(
    "SELECT id FROM users WHERE email = 'caregiver@visitsheet.example'"
  ).all();
  if (!retired.length) return;
  const remove = db.transaction(() => {
    for (const row of retired) {
      clearContent(db, row.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(row.id);
    }
  });
  remove();
}

function clearContent(db, userId) {
  db.prepare(`
    DELETE FROM diary_entries WHERE visit_id IN (SELECT id FROM visits WHERE user_id = ?)
  `).run(userId);
  db.prepare(`
    DELETE FROM questions WHERE visit_id IN (SELECT id FROM visits WHERE user_id = ?)
  `).run(userId);
  db.prepare('DELETE FROM visits WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM medicines WHERE user_id = ?').run(userId);
}

function resetSandbox(db, userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_template = 0').get(userId);
  if (!user || !isDemoEmail(user.email)) return false;
  const template = db.prepare(
    'SELECT * FROM users WHERE email = ? AND is_template = 1'
  ).get(user.email);
  if (!template) return false;
  const tx = db.transaction(() => {
    clearContent(db, userId);
    db.prepare(`
      UPDATE users
      SET display_name = ?, helper_name = ?, access_note = ?, access_needs = ?,
          pref_large_text = 0, pref_high_contrast = 0
      WHERE id = ?
    `).run(
      template.display_name,
      template.helper_name,
      template.access_note,
      template.access_needs,
      userId
    );
    seedRobin(db, userId, new Date());
  });
  tx();
  return true;
}

function updatePrefs(db, userId, large, contrast) {
  db.prepare(
    'UPDATE users SET pref_large_text = ?, pref_high_contrast = ? WHERE id = ?'
  ).run(large ? 1 : 0, contrast ? 1 : 0, userId);
}

function updateProfile(db, userId, profile, needs) {
  db.prepare(`
    UPDATE users
    SET display_name = ?, helper_name = ?, access_note = ?, access_needs = ?
    WHERE id = ? AND is_template = 0
  `).run(
    profile.display_name,
    profile.helper_name,
    profile.access_note,
    JSON.stringify(needs),
    userId
  );
}

function listVisits(db, userId) {
  return db.prepare(`
    SELECT v.id, v.user_id, v.title, v.visit_date, v.with_whom, v.takeaways,
           (SELECT COUNT(*) FROM questions q WHERE q.visit_id = v.id) AS question_count
    FROM visits v
    WHERE v.user_id = ?
    ORDER BY v.visit_date ASC, v.id ASC
  `).all(userId);
}

function getVisit(db, userId, visitId) {
  return db.prepare(`
    SELECT id, user_id, title, visit_date, with_whom, takeaways
    FROM visits WHERE id = ? AND user_id = ?
  `).get(visitId, userId) || null;
}

function createVisit(db, userId, values) {
  return insertVisit(db, userId, {
    title: values.title,
    visit_date: values.visit_date,
    with_whom: values.with_whom,
    takeaways: ''
  });
}

function updateVisit(db, userId, visitId, values) {
  const info = db.prepare(`
    UPDATE visits
    SET title = ?, visit_date = ?, with_whom = ?
    WHERE id = ? AND user_id = ?
  `).run(values.title, values.visit_date, values.with_whom, visitId, userId);
  return info.changes > 0;
}

function deleteVisit(db, userId, visitId) {
  const visit = getVisit(db, userId, visitId);
  if (!visit) return false;
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM diary_entries WHERE visit_id = ?').run(visitId);
    db.prepare('DELETE FROM questions WHERE visit_id = ?').run(visitId);
    db.prepare('DELETE FROM visits WHERE id = ? AND user_id = ?').run(visitId, userId);
  });
  tx();
  return true;
}

function updateTakeaways(db, userId, visitId, text) {
  const info = db.prepare(
    'UPDATE visits SET takeaways = ? WHERE id = ? AND user_id = ?'
  ).run(text, visitId, userId);
  return info.changes > 0;
}

function listQuestions(db, visitId) {
  return db.prepare(`
    SELECT id, visit_id, text, position, asked
    FROM questions WHERE visit_id = ?
    ORDER BY position ASC, id ASC
  `).all(visitId);
}

function getQuestionOwned(db, userId, questionId) {
  return db.prepare(`
    SELECT q.id, q.visit_id, q.text, q.position, q.asked
    FROM questions q
    JOIN visits v ON v.id = q.visit_id
    WHERE q.id = ? AND v.user_id = ?
  `).get(questionId, userId) || null;
}

function renumberQuestions(db, visitId) {
  const rows = db.prepare(
    'SELECT id FROM questions WHERE visit_id = ? ORDER BY position ASC, id ASC'
  ).all(visitId);
  const update = db.prepare('UPDATE questions SET position = ? WHERE id = ?');
  rows.forEach((row, index) => update.run(index + 1, row.id));
}

function addQuestion(db, userId, visitId, text) {
  if (!getVisit(db, userId, visitId)) return null;
  const id = insertQuestion(db, visitId, text, 0);
  renumberQuestions(db, visitId);
  return id;
}

function moveQuestion(db, userId, questionId, dir) {
  const question = getQuestionOwned(db, userId, questionId);
  if (!question) return { status: 404 };
  if (dir !== 'up' && dir !== 'down') return { status: 400, visitId: question.visit_id };
  const all = listQuestions(db, question.visit_id);
  const index = all.findIndex((row) => row.id === question.id);
  const swapIndex = dir === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= all.length) {
    return { status: 302, visitId: question.visit_id, questionId: question.id };
  }
  const other = all[swapIndex];
  const tx = db.transaction(() => {
    const update = db.prepare('UPDATE questions SET position = ? WHERE id = ?');
    update.run(other.position, question.id);
    update.run(question.position, other.id);
    renumberQuestions(db, question.visit_id);
  });
  tx();
  return { status: 302, visitId: question.visit_id, questionId: question.id };
}

function setAsked(db, userId, questionId, asked) {
  const question = getQuestionOwned(db, userId, questionId);
  if (!question) return null;
  db.prepare('UPDATE questions SET asked = ? WHERE id = ?').run(asked ? 1 : 0, questionId);
  return question;
}

function deleteQuestion(db, userId, questionId) {
  const question = getQuestionOwned(db, userId, questionId);
  if (!question) return null;
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM questions WHERE id = ?').run(questionId);
    renumberQuestions(db, question.visit_id);
  });
  tx();
  return question.visit_id;
}

function listDiary(db, visitId) {
  return db.prepare(`
    SELECT id, visit_id, entry_date, text, bother
    FROM diary_entries WHERE visit_id = ?
    ORDER BY entry_date DESC, id DESC
  `).all(visitId);
}

function addDiary(db, userId, visitId, entry) {
  if (!getVisit(db, userId, visitId)) return null;
  return insertDiary(db, visitId, entry.entry_date, entry.text, entry.botherNumber);
}

function deleteDiary(db, userId, entryId) {
  const row = db.prepare(`
    SELECT d.id, d.visit_id
    FROM diary_entries d
    JOIN visits v ON v.id = d.visit_id
    WHERE d.id = ? AND v.user_id = ?
  `).get(entryId, userId);
  if (!row) return null;
  db.prepare('DELETE FROM diary_entries WHERE id = ?').run(entryId);
  return row.visit_id;
}

function listMedicines(db, userId) {
  return db.prepare(`
    SELECT id, user_id, name, dose_text, when_text
    FROM medicines WHERE user_id = ?
    ORDER BY id ASC
  `).all(userId);
}

function getMedicine(db, userId, medicineId) {
  return db.prepare(`
    SELECT id, user_id, name, dose_text, when_text
    FROM medicines WHERE id = ? AND user_id = ?
  `).get(medicineId, userId) || null;
}

function addMedicine(db, userId, values) {
  return insertMedicine(db, userId, values.name, values.dose_text, values.when_text);
}

function updateMedicine(db, userId, medicineId, values) {
  const info = db.prepare(`
    UPDATE medicines SET name = ?, dose_text = ?, when_text = ?
    WHERE id = ? AND user_id = ?
  `).run(values.name, values.dose_text, values.when_text, medicineId, userId);
  return info.changes > 0;
}

function deleteMedicine(db, userId, medicineId) {
  const info = db.prepare('DELETE FROM medicines WHERE id = ? AND user_id = ?').run(medicineId, userId);
  return info.changes > 0;
}

function previousVisit(db, userId, visit) {
  return db.prepare(`
    SELECT id, user_id, title, visit_date, with_whom, takeaways
    FROM visits
    WHERE user_id = ?
      AND (visit_date < ? OR (visit_date = ? AND id < ?))
    ORDER BY visit_date DESC, id DESC
    LIMIT 1
  `).get(userId, visit.visit_date, visit.visit_date, visit.id) || null;
}

function carryQuestion(db, userId, visitId, sourceQuestionId) {
  const visit = getVisit(db, userId, visitId);
  if (!visit) return { status: 404 };
  const source = getQuestionOwned(db, userId, sourceQuestionId);
  if (!source || source.asked) return { status: 404 };
  const previous = previousVisit(db, userId, visit);
  if (!previous || source.visit_id !== previous.id) return { status: 404 };
  const existing = listQuestions(db, visitId);
  if (existing.some((question) => question.text === source.text)) {
    return { status: 302, visitId, duplicate: true };
  }
  const id = insertQuestion(db, visitId, source.text, 0);
  renumberQuestions(db, visitId);
  return { status: 302, visitId, questionId: id };
}

function exportBundle(db, userId, visitId) {
  const visit = getVisit(db, userId, visitId);
  if (!visit) return null;
  const user = getUser(db, userId);
  return {
    person: {
      display_name: user.display_name,
      helper_name: user.helper_name,
      access_needs: user.needs.map((id) => needLabel(id)).filter(Boolean),
      access_note: user.access_note
    },
    visit: {
      id: visit.id,
      title: visit.title,
      visit_date: visit.visit_date,
      with_whom: visit.with_whom,
      takeaways: visit.takeaways
    },
    questions: listQuestions(db, visitId).map((question) => ({
      id: question.id,
      text: question.text,
      position: question.position,
      asked: question.asked
    })),
    diary: listDiary(db, visitId).map((entry) => ({
      id: entry.id,
      entry_date: entry.entry_date,
      text: entry.text,
      bother: entry.bother
    })),
    medicines: listMedicines(db, userId).map((medicine) => ({
      id: medicine.id,
      name: medicine.name,
      dose_text: medicine.dose_text,
      when_text: medicine.when_text
    }))
  };
}

module.exports = {
  ACCOUNTS,
  DEMO_PASSWORD,
  openDatabase,
  resetAll,
  getUser,
  isDemoEmail,
  authenticate,
  resetSandbox,
  updatePrefs,
  updateProfile,
  listVisits,
  getVisit,
  createVisit,
  updateVisit,
  deleteVisit,
  updateTakeaways,
  listQuestions,
  addQuestion,
  moveQuestion,
  setAsked,
  deleteQuestion,
  listDiary,
  addDiary,
  deleteDiary,
  listMedicines,
  getMedicine,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  previousVisit,
  carryQuestion,
  exportBundle
};
