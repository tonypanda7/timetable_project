import { parse } from 'csv-parse/sync';
import { supabase } from './supabaseAdmin';

async function ensureBucket(bucket = 'datasets') {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === bucket)) {
    await supabase.storage.createBucket(bucket, { public: false, fileSizeLimit: 10485760 });
  }
}

function coerceTypes(table, obj) {
  const out = { ...obj };
  const toInt = (k) => { if (out[k] !== undefined && out[k] !== null && out[k] !== '') out[k] = Number(out[k]); };
  const toFloat = (k) => { if (out[k] !== undefined && out[k] !== null && out[k] !== '') out[k] = parseFloat(out[k]); };
  switch (table) {
    case 'teachers': toInt('working_hours'); break;
    case 'students': toInt('semester'); break;
    case 'courses': toInt('semester'); toInt('credits'); break;
    case 'classrooms': toInt('capacity'); break;
    case 'feedback': toInt('course_id'); toFloat('teacher_rating'); toFloat('course_rating'); break;
    case 'student_electives': toInt('course_id'); break;
    default: break;
  }
  return out;
}

export async function importCsvToSupabase(fileName, buffer, table) {
  await ensureBucket('datasets');
  const content = Buffer.isBuffer(buffer) ? buffer.toString('utf-8') : String(buffer);
  const rowsRaw = parse(content, { columns: true, skip_empty_lines: true });
  const rows = rowsRaw.map((r, idx) => {
    const row = coerceTypes(table, r);
    if (row.id === undefined || row.id === null || `${row.id}`.trim() === '') row.id = `${idx + 1}`;
    return row;
  });

  // Save raw CSV to storage (root of bucket)
  await supabase.storage.from('datasets').upload(fileName, buffer, { contentType: 'text/csv', upsert: true });

  // Clear table then insert
  const del = await supabase.from(table).delete().neq('id', null);
  if (del.error) throw new Error(del.error.message);
  if (rows.length > 0) {
    const ins = await supabase.from(table).insert(rows);
    if (ins.error) throw new Error(ins.error.message);
  }
  return { count: rows.length };
}

export async function tableCount(name) {
  const res = await supabase.from(name).select('*', { count: 'exact', head: true });
  if (res.error) return 0;
  return res.count || 0;
}

export async function datasetExists(base) {
  const list = await supabase.storage.from('datasets').list('', { search: `${base}.csv` });
  if (list.error) return false;
  return (list.data || []).some((f) => f.name === `${base}.csv`);
}

export async function fetchAll(name) {
  const res = await supabase.from(name).select('*');
  if (res.error) throw new Error(res.error.message);
  return res.data || [];
}
