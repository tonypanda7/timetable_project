export const runtime = 'nodejs';
import db from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const student_id = searchParams.get('student_id');
  const program = searchParams.get('program');
  if (!student_id || !program) return Response.json({ error: 'Student ID and Program are required.' }, { status: 400 });
  const electiveTypes = ['Minor','Skill-Based','Ability Enhancement','Value-Added'];
  const available = db.prepare(`SELECT * FROM courses WHERE program_name = ? AND course_type IN (${electiveTypes.map(()=>'?').join(',')})`).all(program, ...electiveTypes);
  const selectedIds = new Set(db.prepare('SELECT course_id FROM student_electives WHERE student_id = ?').all(student_id).map(r => r.course_id));
  const data = available.map(c => ({ id: c.id, course_name: c.course_name, credits: c.credits, course_type: c.course_type, is_selected: selectedIds.has(c.id) }));
  return Response.json({ electives: data });
}
