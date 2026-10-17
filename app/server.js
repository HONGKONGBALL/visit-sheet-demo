'use strict';

const path = require('path');
const { createApp } = require('./src/app');
const { openDatabase } = require('./src/db');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'visitsheet.db');
const db = openDatabase(dbPath);
const app = createApp(db);
const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`VisitSheet listening on http://localhost:${port}`);
});
