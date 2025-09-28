import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import db from './db';

export function ensureUploads() {
  const dir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveUploadedFile(name, file) {
  const uploads = ensureUploads();
  const target = path.join(uploads, name);
  fs.writeFileSync(target, Buffer.from(file));
  return target;
}

export function loadCsvToDb(filePath, tableName) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true });
  const trx = db.transaction((rows) => {
    db.prepare(`DELETE FROM ${tableName}`).run();
    if (rows.length === 0) return;
    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => '?').join(',');
    const stmt = db.prepare(`INSERT INTO ${tableName} (${cols.join(',')}) VALUES (${placeholders})`);
    for (const row of rows) stmt.run(cols.map(c => row[c]));
  });
  trx(records);
}
