const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'workouts.db');

let db;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      distance_km REAL NOT NULL,
      duration_minutes REAL NOT NULL,
      avg_heart_rate INTEGER,
      elevation_m REAL,
      workout_type TEXT NOT NULL DEFAULT 'easy',
      perceived_effort TEXT NOT NULL DEFAULT 'moderate',
      notes TEXT,
      warmup_km REAL,
      cooldown_km REAL,
      interval_distance_m REAL,
      interval_reps INTEGER,
      interval_recovery_type TEXT,
      interval_recovery_time INTEGER,
      interval_time_seconds REAL,
      max_heart_rate INTEGER,
      tempo_distance_km REAL,
      tempo_time_seconds REAL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  save();
  return db;
}

function save() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

module.exports = { getDb, save };