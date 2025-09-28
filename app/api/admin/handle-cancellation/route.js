export const runtime = 'nodejs';
import db from '@/lib/db';
import { getState, replaceCancellationRequests, pushSubOffer } from '@/lib/state';
import { randomUUID } from 'crypto';

export async function POST(request) {
  const body = await request.json();
  const reqId = body.request_id; const action = body.action;
  if (!reqId || !action) return Response.json({ error: 'Missing data' }, { status: 400 });
  const { GENERATED_TIMETABLE, CANCELLATION_REQUESTS } = getState();
  const original = CANCELLATION_REQUESTS.find(r => r.id === reqId);
  if (!original) return Response.json({ error: 'Request ID not found.' }, { status: 404 });
  replaceCancellationRequests(CANCELLATION_REQUESTS.filter(r => r.id !== reqId));
  if (action === 'approve' && Array.isArray(GENERATED_TIMETABLE)) {
    let cancelled = null;
    for (let i = 0; i < GENERATED_TIMETABLE.length; i++) {
      const e = GENERATED_TIMETABLE[i];
      if (e.teacher.id === original.teacher_id && e.slot === original.slot) { cancelled = GENERATED_TIMETABLE.splice(i,1)[0]; break; }
    }
    if (cancelled) {
      const allTeachers = db.prepare('SELECT * FROM teachers').all();
      const occupied = new Set(GENERATED_TIMETABLE.map(e => `${e.teacher.id}|${e.slot}`));
      for (const t of allTeachers) {
        const isFree = !occupied.has(`${t.id}|${cancelled.slot}`);
        const canTeach = [t.first_preference, t.second_preference].includes(cancelled.course.course_name);
        if (t.id !== original.teacher_id && isFree && canTeach) {
          const offer = { id: randomUUID(), details: { course_id: cancelled.course.id, group: cancelled.group, students: cancelled.students, room_id: cancelled.room.id, slot: cancelled.slot }, course_name: cancelled.course.course_name, group: cancelled.group, students: cancelled.students, slot: cancelled.slot, offered_to_teacher_id: t.id };
          pushSubOffer(offer);
        }
      }
    }
  }
  return Response.json({ message: `Request ${action}d.` });
}
