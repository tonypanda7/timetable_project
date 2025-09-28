export const runtime = 'nodejs';
import { importCsvToFirestoreAndStorage } from '@/lib/firebaseCsv';

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file) return Response.json({ error: 'No file part' }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await importCsvToFirestoreAndStorage('students.csv', buf, 'students');
    return Response.json({ message: 'Student data uploaded!', ...result }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message || 'Upload failed' }, { status: 500 });
  }
}
