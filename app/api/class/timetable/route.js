export const runtime = 'nodejs';
import { getState } from '@/lib/state';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const group = searchParams.get('group');
  if (!group) return Response.json({ error: 'Group (class) is required.' }, { status: 400 });
  let { GENERATED_TIMETABLE } = getState();
  if (!Array.isArray(GENERATED_TIMETABLE)) {
    try {
      const { getTimetableFromStorage } = await import('@/lib/supabaseCsv');
      GENERATED_TIMETABLE = await getTimetableFromStorage();
    } catch (_) {}
  }
  if (!Array.isArray(GENERATED_TIMETABLE)) return Response.json({ error: 'No timetable generated.' }, { status: 404 });
  const schedule = [];
  for (const entry of GENERATED_TIMETABLE) {
    if (String(entry.group) === String(group)) {
      const [day, period] = String(entry.slot).split('_');
      schedule.push({ day, period: parseInt(period,10), course_name: entry.course.course_name, teacher_id: entry.teacher.id, room_name: entry.room.location });
    }
  }
  return Response.json({ timetable: schedule, days: ['Mon','Tue','Wed','Thu','Fri'], periods: 8 });
}
