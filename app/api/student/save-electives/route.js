export const runtime = 'nodejs';
import db from '@/lib/db';

export async function POST(request) {
  const data = await request.json();
  const student_id = data.student_id; const course_ids = data.course_ids || [];
  if (!student_id) return Response.json({ error: 'Student ID is required.' }, { status: 400 });
  const trx = db.transaction(() => {
    db.prepare('DELETE FROM student_electives WHERE student_id = ?').run(student_id);
    const stmt = db.prepare('INSERT INTO student_electives (student_id, course_id) VALUES (?, ?)');
    for (const cid of course_ids) stmt.run(student_id, parseInt(cid,10));
  });
  trx();
  return Response.json({ message: 'Your elective choices have been saved!' }, { status: 201 });
}
