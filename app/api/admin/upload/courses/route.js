export const runtime = 'nodejs';
import { importCsvToSupabase } from '@/lib/supabaseCsv';

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file) return Response.json({ error: 'No file part' }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await importCsvToSupabase('courses.csv', buf, 'courses');
    return Response.json({ message: 'Course data uploaded!', ...result }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message || 'Upload failed' }, { status: 500 });
  }
}
