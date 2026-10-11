// @ts-nocheck
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

let sqlite3 = null;
let db = null;
let isOpfsVfs = false;

const DB_FILENAME = '/ACCDB.sqlite';
const OPFS_RAW_NAME = 'ACCDB.sqlite';

// Helper: Open OPFS FileHandle in worker
async function getOpfsFileHandle(name, create = true) {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.getDirectory) {
    const root = await navigator.storage.getDirectory();
    return await root.getFileHandle(name, { create });
  }
  return null;
}

// Helper: Read raw binary from OPFS file
async function readOpfsBinary(name) {
  try {
    const handle = await getOpfsFileHandle(name, false);
    if (!handle) return null;
    const file = await handle.getFile();
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (err) {
    // File not found or OPFS error
    return null;
  }
}

// Helper: Write raw binary to OPFS file
async function writeOpfsBinary(name, uint8Array) {
  try {
    const handle = await getOpfsFileHandle(name, true);
    if (!handle) return false;
    if (typeof handle.createSyncAccessHandle === 'function') {
      const accessHandle = await handle.createSyncAccessHandle();
      accessHandle.truncate(0);
      accessHandle.write(uint8Array, { at: 0 });
      accessHandle.flush();
      accessHandle.close();
      return true;
    } else if (typeof handle.createWritable === 'function') {
      const writable = await handle.createWritable();
      await writable.write(uint8Array);
      await writable.close();
      return true;
    }
  } catch (err) {
    console.warn('writeOpfsBinary warning:', err);
  }
  return false;
}

// Helper: Delete OPFS file
async function deleteOpfsFile(name) {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.getDirectory) {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(name);
      return true;
    }
  } catch {
    // Ignore if not found
  }
  return false;
}

// Initialize SQLite Schema
function initSchema(database) {
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS teacher_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      instrument TEXT NOT NULL,
      certificate TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS rate_templates (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      grade TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      default_student_fee REAL NOT NULL,
      default_teacher_rate REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (category_id) REFERENCES teacher_categories(id)
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      ic TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      preferred_name TEXT,
      birthday TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS teacher_qualifications (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      instrument TEXT NOT NULL,
      certificate TEXT NOT NULL,
      category_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id),
      FOREIGN KEY (category_id) REFERENCES teacher_categories(id)
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      ic TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      preferred_name TEXT,
      birthday TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      emergency_contact TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS customized_rates (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      instrument TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      custom_student_fee REAL NOT NULL,
      custom_teacher_rate REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    );

    CREATE TABLE IF NOT EXISTS monthly_scheduled_lessons (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      instrument TEXT NOT NULL,
      grade TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      monthly_student_fee REAL NOT NULL,
      monthly_teacher_rate REAL NOT NULL,
      is_custom_rate INTEGER NOT NULL DEFAULT 0,
      customized_rate_id TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id),
      FOREIGN KEY (customized_rate_id) REFERENCES customized_rates(id)
    );

    CREATE TABLE IF NOT EXISTS adhoc_lessons (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      instrument TEXT NOT NULL,
      lesson_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      student_fee REAL NOT NULL,
      teacher_pay REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    );

    CREATE TABLE IF NOT EXISTS student_payments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      amount_paid REAL NOT NULL,
      payment_type TEXT NOT NULL,
      billing_period TEXT,
      monthly_lesson_id TEXT,
      adhoc_lesson_id TEXT,
      payment_method TEXT NOT NULL,
      receipt_no TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (monthly_lesson_id) REFERENCES monthly_scheduled_lessons(id),
      FOREIGN KEY (adhoc_lesson_id) REFERENCES adhoc_lessons(id)
    );

    CREATE TABLE IF NOT EXISTS teacher_salaries (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      payout_date TEXT NOT NULL,
      amount_paid REAL NOT NULL,
      salary_type TEXT NOT NULL,
      period TEXT NOT NULL,
      monthly_lesson_id TEXT,
      adhoc_lesson_id TEXT,
      payment_method TEXT NOT NULL,
      voucher_no TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id),
      FOREIGN KEY (monthly_lesson_id) REFERENCES monthly_scheduled_lessons(id),
      FOREIGN KEY (adhoc_lesson_id) REFERENCES adhoc_lessons(id)
    );

    CREATE INDEX IF NOT EXISTS idx_teachers_ic ON teachers(ic);
    CREATE INDEX IF NOT EXISTS idx_students_ic ON students(ic);
    CREATE INDEX IF NOT EXISTS idx_monthly_lessons_student ON monthly_scheduled_lessons(student_id);
    CREATE INDEX IF NOT EXISTS idx_monthly_lessons_teacher ON monthly_scheduled_lessons(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_adhoc_lessons_date ON adhoc_lessons(lesson_date);
    CREATE INDEX IF NOT EXISTS idx_student_payments_student ON student_payments(student_id);
    CREATE INDEX IF NOT EXISTS idx_student_payments_period ON student_payments(billing_period);
    CREATE INDEX IF NOT EXISTS idx_teacher_salaries_teacher ON teacher_salaries(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_teacher_salaries_period ON teacher_salaries(period);
  `);
}

// Seed initial default categories and rate templates if empty
function seedDefaultsIfEmpty(database) {
  const countRows = [];
  database.exec({
    sql: 'SELECT COUNT(*) as count FROM teacher_categories WHERE deleted_at IS NULL;',
    rowMode: 'object',
    resultRows: countRows
  });

  if (countRows.length > 0 && countRows[0].count === 0) {
    const seedCategories = [
      { id: 'cat-piano-senior', name: 'Senior Piano Specialist', instrument: 'Piano', certificate: 'Trinity ATCL / ABRSM Dip' },
      { id: 'cat-piano-standard', name: 'Standard Piano Instructor', instrument: 'Piano', certificate: 'ABRSM Grade 8' },
      { id: 'cat-violin-senior', name: 'Senior Violin Specialist', instrument: 'Violin', certificate: 'Trinity ATCL / Dip' },
      { id: 'cat-vocal-standard', name: 'Contemporary Vocal Coach', instrument: 'Vocal', certificate: 'Grade 8 / Degree' },
      { id: 'cat-guitar-standard', name: 'Acoustic & Classical Guitar', instrument: 'Guitar', certificate: 'Grade 8 / Professional' },
      { id: 'cat-drums-standard', name: 'Drum Kit Instructor', instrument: 'Drums', certificate: 'Rockschool Grade 8' },
    ];

    for (const cat of seedCategories) {
      database.exec({
        sql: `INSERT OR IGNORE INTO teacher_categories (id, name, instrument, certificate) VALUES (?, ?, ?, ?)`,
        bind: [cat.id, cat.name, cat.instrument, cat.certificate]
      });
    }

    const grades = [
      { grade: 'Beginner', fee30: 120, fee45: 160, fee60: 200, pay30: 70, pay45: 95, pay60: 120 },
      { grade: 'Grade 1', fee30: 130, fee45: 170, fee60: 210, pay30: 75, pay45: 100, pay60: 125 },
      { grade: 'Grade 2', fee30: 140, fee45: 180, fee60: 220, pay30: 80, pay45: 105, pay60: 130 },
      { grade: 'Grade 3', fee30: 150, fee45: 195, fee60: 240, pay30: 85, pay45: 115, pay60: 140 },
      { grade: 'Grade 4', fee30: 160, fee45: 210, fee60: 260, pay30: 90, pay45: 125, pay60: 155 },
      { grade: 'Grade 5', fee30: 180, fee45: 230, fee60: 280, pay30: 100, pay45: 135, pay60: 165 },
      { grade: 'Grade 6', fee30: 200, fee45: 260, fee60: 320, pay30: 115, pay45: 155, pay60: 190 },
      { grade: 'Grade 7', fee30: 220, fee45: 290, fee60: 360, pay30: 130, pay45: 175, pay60: 215 },
      { grade: 'Grade 8', fee30: 250, fee45: 330, fee60: 400, pay30: 150, pay45: 200, pay60: 240 },
      { grade: 'Diploma', fee30: 300, fee45: 400, fee60: 500, pay30: 180, pay45: 240, pay60: 300 }
    ];

    for (const cat of seedCategories) {
      for (const g of grades) {
        // 30 mins
        database.exec({
          sql: `INSERT OR IGNORE INTO rate_templates (id, category_id, grade, duration_minutes, default_student_fee, default_teacher_rate) VALUES (?, ?, ?, ?, ?, ?)`,
          bind: [`rt-${cat.id}-${g.grade}-30`, cat.id, g.grade, 30, g.fee30, g.pay30]
        });
        // 45 mins
        database.exec({
          sql: `INSERT OR IGNORE INTO rate_templates (id, category_id, grade, duration_minutes, default_student_fee, default_teacher_rate) VALUES (?, ?, ?, ?, ?, ?)`,
          bind: [`rt-${cat.id}-${g.grade}-45`, cat.id, g.grade, 45, g.fee45, g.pay45]
        });
        // 60 mins
        database.exec({
          sql: `INSERT OR IGNORE INTO rate_templates (id, category_id, grade, duration_minutes, default_student_fee, default_teacher_rate) VALUES (?, ?, ?, ?, ?, ?)`,
          bind: [`rt-${cat.id}-${g.grade}-60`, cat.id, g.grade, 60, g.fee60, g.pay60]
        });
      }
    }
  }
}

// Master init function
async function initDb() {
  if (!sqlite3) {
    sqlite3 = await sqlite3InitModule({
      print: console.log,
      printErr: console.error
    });
  }

  // 1. Try native OPFS VFS first
  if (sqlite3.oo1 && sqlite3.oo1.OpfsDb) {
    try {
      db = new sqlite3.oo1.OpfsDb(DB_FILENAME);
      isOpfsVfs = true;
      console.log('Opened SQLite database via native OpfsDb:', DB_FILENAME);
    } catch (e) {
      console.warn('Native OpfsDb open failed, falling back to in-memory + OPFS stream:', e);
      db = null;
    }
  }

  // 2. Fallback: In-memory DB populated from raw OPFS file
  if (!db) {
    isOpfsVfs = false;
    const existingBytes = await readOpfsBinary(OPFS_RAW_NAME);
    if (existingBytes && existingBytes.byteLength > 0) {
      try {
        const p = sqlite3.wasm.allocFromTypedArray(existingBytes);
        db = new sqlite3.oo1.DB();
        const rc = sqlite3.capi.sqlite3_deserialize(
          db.pointer,
          'main',
          p,
          existingBytes.byteLength,
          existingBytes.byteLength,
          sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE
        );
        console.log('Deserialized database from raw OPFS, rc:', rc);
      } catch (err) {
        console.warn('Failed to deserialize existing OPFS binary, creating fresh DB:', err);
        db = new sqlite3.oo1.DB(':memory:');
      }
    } else {
      db = new sqlite3.oo1.DB(':memory:');
      console.log('Created fresh in-memory SQLite database');
    }
  }

  initSchema(db);
  seedDefaultsIfEmpty(db);

  // Auto-sync initial state to OPFS raw backup
  await exportAndFlushToOpfs();

  return { isOpfsVfs };
}

// Export binary and flush to raw OPFS backup file
async function exportAndFlushToOpfs() {
  if (!db) return null;
  try {
    if (isOpfsVfs) {
      db.exec('PRAGMA wal_checkpoint(FULL);');
    }
    const binary = sqlite3.capi.sqlite3_js_db_export(db);
    await writeOpfsBinary(OPFS_RAW_NAME, binary);
    return binary;
  } catch (err) {
    console.error('Error exporting/flushing to OPFS:', err);
    return null;
  }
}

// Conflict merge function using ATTACH DATABASE 'remote.sqlite' AS remote_db;
async function mergeRemoteDatabase(remoteBinary) {
  if (!db || !remoteBinary) throw new Error('Database or remote binary is missing');

  // Step 1: Write remote binary to temporary OPFS file 'remote.sqlite'
  const TEMP_REMOTE_NAME = 'remote.sqlite';
  await writeOpfsBinary(TEMP_REMOTE_NAME, remoteBinary);

  let tempRemoteDbPath = TEMP_REMOTE_NAME;
  if (isOpfsVfs) {
    tempRemoteDbPath = '/remote.sqlite';
  }

  const tables = [
    'teacher_categories',
    'rate_templates',
    'teachers',
    'teacher_qualifications',
    'students',
    'customized_rates',
    'monthly_scheduled_lessons',
    'adhoc_lessons',
    'student_payments',
    'teacher_salaries'
  ];

  let attached = false;
  let stats = { inserted: 0, updated: 0, tablesChecked: tables.length };

  try {
    // Attempt ATTACH
    try {
      db.exec(`ATTACH DATABASE '${tempRemoteDbPath}' AS remote_db;`);
      attached = true;
    } catch (attachErr) {
      console.warn('Direct ATTACH failed, attempting with alternate path:', attachErr);
      db.exec(`ATTACH DATABASE 'remote.sqlite' AS remote_db;`);
      attached = true;
    }

    // Step 2: Synchronize data table by table
    for (const table of tables) {
      // Insert rows present in remote but missing locally
      try {
        db.exec(`
          INSERT OR IGNORE INTO main.${table}
          SELECT * FROM remote_db.${table}
          WHERE id NOT IN (SELECT id FROM main.${table});
        `);
      } catch (insertErr) {
        console.warn(`Merge insert error for table ${table}:`, insertErr);
      }

      // Update rows where remote has a newer updated_at timestamp
      try {
        db.exec(`
          INSERT OR REPLACE INTO main.${table}
          SELECT r.* FROM remote_db.${table} r
          JOIN main.${table} m ON r.id = m.id
          WHERE r.updated_at > m.updated_at;
        `);
      } catch (updateErr) {
        console.warn(`Merge update error for table ${table}:`, updateErr);
      }
    }

    // Cleanly detach
    if (attached) {
      db.exec(`DETACH DATABASE remote_db;`);
      attached = false;
    }

    // Remove temp file
    await deleteOpfsFile(TEMP_REMOTE_NAME);

    // Persist merged database
    const mergedBinary = await exportAndFlushToOpfs();
    return { success: true, stats, binary: mergedBinary };
  } catch (err) {
    if (attached) {
      try { db.exec(`DETACH DATABASE remote_db;`); } catch {}
    }
    await deleteOpfsFile(TEMP_REMOTE_NAME);
    throw err;
  }
}

// Replace database with a completely new binary (e.g. Keep Remote / Restore)
async function replaceDatabase(newBinary) {
  if (!sqlite3 || !newBinary) throw new Error('Invalid binary or sqlite not initialized');
  try {
    if (db) {
      try { db.close(); } catch {}
    }

    // Save directly to raw OPFS
    await writeOpfsBinary(OPFS_RAW_NAME, newBinary);

    // Reopen
    if (sqlite3.oo1 && sqlite3.oo1.OpfsDb && isOpfsVfs) {
      try {
        // If OpfsDb, write to file in OPFS
        db = new sqlite3.oo1.OpfsDb(DB_FILENAME);
      } catch {
        const p = sqlite3.wasm.allocFromTypedArray(newBinary);
        db = new sqlite3.oo1.DB();
        sqlite3.capi.sqlite3_deserialize(
          db.pointer,
          'main',
          p,
          newBinary.byteLength,
          newBinary.byteLength,
          sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE
        );
      }
    } else {
      const p = sqlite3.wasm.allocFromTypedArray(newBinary);
      db = new sqlite3.oo1.DB();
      sqlite3.capi.sqlite3_deserialize(
        db.pointer,
        'main',
        p,
        newBinary.byteLength,
        newBinary.byteLength,
        sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE
      );
    }

    initSchema(db);
    await exportAndFlushToOpfs();
    return true;
  } catch (err) {
    console.error('replaceDatabase error:', err);
    throw err;
  }
}

// Worker message dispatcher
self.onmessage = async (e) => {
  const { id, type, payload } = e.data;

  try {
    switch (type) {
      case 'INIT': {
        const res = await initDb();
        self.postMessage({ id, success: true, data: res });
        break;
      }

      case 'QUERY': {
        if (!db) throw new Error('Database not initialized');
        const rows = [];
        db.exec({
          sql: payload.sql,
          bind: payload.bind || [],
          rowMode: 'object',
          resultRows: rows
        });
        self.postMessage({ id, success: true, data: rows });
        break;
      }

      case 'EXEC': {
        if (!db) throw new Error('Database not initialized');
        db.exec({
          sql: payload.sql,
          bind: payload.bind || []
        });
        const changes = db.changes();
        self.postMessage({ id, success: true, data: { changes } });
        break;
      }

      case 'SAVE_TO_OPFS': {
        const binary = await exportAndFlushToOpfs();
        self.postMessage({ id, success: true, data: { size: binary ? binary.byteLength : 0 } });
        break;
      }

      case 'EXPORT_BINARY': {
        const binary = await exportAndFlushToOpfs();
        self.postMessage({ id, success: true, data: binary });
        break;
      }

      case 'IMPORT_BINARY': {
        await replaceDatabase(payload.binary);
        self.postMessage({ id, success: true });
        break;
      }

      case 'MERGE_REMOTE': {
        const mergeResult = await mergeRemoteDatabase(payload.binary);
        self.postMessage({ id, success: true, data: mergeResult });
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (err) {
    console.error(`Worker error [${type}]:`, err);
    self.postMessage({ id, success: false, error: err.message || String(err) });
  }
};
