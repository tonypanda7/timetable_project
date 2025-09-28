export const runtime = 'nodejs';
import { getState } from '@/lib/state';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const student_id = searchParams.get('student_id');
  if (!student_id) return Response.json({ error: 'Student ID must be provided.' }, { status: 400 });
  let { GENERATED_TIMETABLE } = getState();
  if (!Array.isArray(GENERATED_TIMETABLE)) {
    try {
      const { getTimetableFromStorage } = await import('@/lib/supabaseCsv');
      GENERATED_TIMETABLE = await getTimetableFromStorage();
    } catch (_) {}
  }
  if (!Array.isArray(GENERATED_TIMETABLE)) return Response.json({ error: 'No timetable has been generated.' }, { status: 404 });
  const student_schedule = [];
  for (const entry of GENERATED_TIMETABLE) {
    if ((entry.students || []).includes(student_id)) {
      const [day, period] = String(entry.slot).split('_');
      student_schedule.push({ day, period: parseInt(period,10), course_name: entry.course.course_name, teacher_name: entry.teacher.id, room_name: entry.room.location });
    }
  }
  return Response.json({ timetable: student_schedule, days: ['Mon','Tue','Wed','Thu','Fri'], periods: 8 });
}
