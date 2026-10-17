'use strict';

const path = require('path');
const { openDatabase, resetAll } = require('./db');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'visitsheet.db');
const db = openDatabase(dbPath);
resetAll(db);
db.close();
console.log(`Seeded fictional demo account in ${dbPath}`);
