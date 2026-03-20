import initSqlJs from 'sql.js';
import { SEED_WORKOUTS } from './seed.js';

const DB_NAME = 'racer';
const DB_STORE = 'sqlitedb';
const DB_KEY = 'workouts';

let db = null;
let SQL = null;

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(idb) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(DB_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(idb, data) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(data, DB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDb() {
  if (db) return db;

  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`,
    });
  }

  const idb = await openIDB();
  const saved = await idbGet(idb);

  if (saved) {
    db = new SQL.Database(new Uint8Array(saved));
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

  const countResult = db.exec('SELECT COUNT(*) FROM workouts');
  const rowCount = countResult.length ? countResult[0].values[0][0] : 0;

  if (rowCount === 0 && SEED_WORKOUTS.length) {
    for (const w of SEED_WORKOUTS) {
      db.run(
        `INSERT INTO workouts (date, distance_km, duration_minutes, avg_heart_rate, elevation_m, workout_type, notes, warmup_km, cooldown_km, interval_distance_m, interval_reps, interval_recovery_type, interval_recovery_time, interval_time_seconds, tempo_distance_km, tempo_time_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [w.date, w.distance_km, w.duration_minutes, w.avg_heart_rate, w.elevation_m, w.workout_type, w.notes, w.warmup_km, w.cooldown_km, w.interval_distance_m, w.interval_reps, w.interval_recovery_type, w.interval_recovery_time, w.interval_time_seconds, w.tempo_distance_km, w.tempo_time_seconds]
      );
    }
    // Signal the UI to show a one-time notice about sample data
    localStorage.setItem('racer_seed_notice', 'true');
  }

  await save();
  return db;
}

export async function save() {
  if (!db) return;
  const data = db.export();
  const idb = await openIDB();
  await idbPut(idb, data);
}

export function queryRows(db, sql) {
  const results = db.exec(sql);
  if (!results.length) return [];
  const cols = results[0].columns;
  return results[0].values.map(row => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = row[i]);
    return obj;
  });
}
