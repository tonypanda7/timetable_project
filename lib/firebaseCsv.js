import { parse } from 'csv-parse/sync';
import { firestore, storage } from './firebaseAdmin';

async function deleteCollection(collectionName, batchSize = 300) {
  const colRef = firestore.collection(collectionName);
  while (true) {
    const snapshot = await colRef.limit(batchSize).get();
    if (snapshot.empty) break;
    const batch = firestore.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

function coerceTypes(collectionName, obj) {
  const out = { ...obj };
  const toInt = (k) => { if (out[k] !== undefined && out[k] !== null && out[k] !== '') out[k] = Number(out[k]); };
  const toFloat = (k) => { if (out[k] !== undefined && out[k] !== null && out[k] !== '') out[k] = parseFloat(out[k]); };
  switch (collectionName) {
    case 'teachers':
      toInt('working_hours');
      break;
    case 'students':
      toInt('semester');
      break;
    case 'courses':
      toInt('semester'); toInt('credits');
      break;
    case 'classrooms':
      toInt('capacity');
      break;
    case 'feedback':
      toInt('course_id'); toFloat('teacher_rating'); toFloat('course_rating');
      break;
    case 'student_electives':
      toInt('course_id');
      break;
    default:
      break;
  }
  return out;
}

export async function importCsvToFirestoreAndStorage(fileName, buffer, collectionName) {
  // Save raw CSV to Cloud Storage under datasets/
  const file = storage.file(`datasets/${fileName}`);
  await file.save(Buffer.from(buffer), { contentType: 'text/csv', resumable: false });

  // Parse CSV
  const content = Buffer.isBuffer(buffer) ? buffer.toString('utf-8') : String(buffer);
  const rows = parse(content, { columns: true, skip_empty_lines: true });

  // Clear collection then write
  await deleteCollection(collectionName);

  // Prepare batch writes
  const batches = [];
  let batch = firestore.batch();
  let opCount = 0;
  const ensureDocId = (row, idx) => {
    if (row.id !== undefined && row.id !== null && `${row.id}`.trim() !== '') return `${row.id}`;
    // If no id column, generate a deterministic numeric id based on position (1-based)
    return `${idx + 1}`;
  };

  rows.forEach((raw, idx) => {
    const row = coerceTypes(collectionName, raw);
    const docId = ensureDocId(row, idx);
    const ref = firestore.collection(collectionName).doc(docId);
    batch.set(ref, { ...row, id: row.id !== undefined ? row.id : (isNaN(Number(docId)) ? docId : Number(docId)) });
    opCount++;
    if (opCount >= 400) { batches.push(batch.commit()); batch = firestore.batch(); opCount = 0; }
  });
  if (opCount > 0) batches.push(batch.commit());
  await Promise.all(batches);

  return { count: rows.length };
}

export async function collectionCount(name) {
  try {
    // Prefer count aggregation when available
    const snap = await firestore.collection(name).count().get();
    return snap.data().count || 0;
  } catch (_) {
    const snap = await firestore.collection(name).select().get();
    return snap.size;
  }
}

export async function datasetExistsInStorage(base) {
  const [exists] = await storage.file(`datasets/${base}.csv`).exists();
  return exists;
}

export async function fetchAllFrom(name) {
  const snap = await firestore.collection(name).get();
  return snap.docs.map((d) => d.data());
}
