export const runtime = 'nodejs';
import { importCsvToFirestoreAndStorage } from '@/lib/firebaseCsv';

export async function POST(request) {
  const form = await request.formData();
  const file = form.get('file');
  if (!file) return Response.json({ error: 'No file part' }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  await importCsvToFirestoreAndStorage('classrooms.csv', buf, 'classrooms');
  return Response.json({ message: 'Classroom data uploaded!' }, { status: 201 });
}
