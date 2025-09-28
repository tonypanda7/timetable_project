export const runtime = 'nodejs';
import { loadCsvToDb, saveUploadedFile } from '@/lib/utils';

export async function POST(request) {
  const form = await request.formData();
  const file = form.get('file');
  if (!file) return Response.json({ error: 'No file part' }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const path = saveUploadedFile('classrooms.csv', buf);
  loadCsvToDb(path, 'classrooms');
  return Response.json({ message: 'Classroom data uploaded!' }, { status: 201 });
}
