export const runtime = 'nodejs';
import { getState } from '@/lib/state';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const teacher_id = searchParams.get('teacher_id');
  if (!teacher_id) return Response.json({ error: 'Teacher ID required.' }, { status: 400 });
  let { GENERATED_TIMETABLE } = getState();
  if (!Array.isArray(GENERATED_TIMETABLE)) {
    try {
      const { getTimetableFromStorage } = await import('@/lib/supabaseCsv');
      GENERATED_TIMETABLE = await getTimetableFromStorage();
    } catch (_) {}
  }
  if (!Array.isArray(GENERATED_TIMETABLE)) return Response.json({ error: 'No timetable generated.' }, { status: 404 });
  const teacher_schedule = []; let total_hours = 0;
  for (const entry of GENERATED_TIMETABLE) {
    if (entry.teacher.id === teacher_id) {
      const [day, period] = String(entry.slot).split('_');
      teacher_schedule.push({ day, period: parseInt(period,10), course_name: entry.course.course_name, group: entry.group, students: entry.students, room_name: entry.room.location });
      total_hours += 1;
    }
  }
  const workload_left = 20 - total_hours;
  return Response.json({ timetable: teacher_schedule, days: ['Mon','Tue','Wed','Thu','Fri'], periods: 8, workload: workload_left });
}
