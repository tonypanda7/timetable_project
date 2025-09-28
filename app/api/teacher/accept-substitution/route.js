export const runtime = 'nodejs';
import db from '@/lib/db';
import { getState, replaceSubOffers } from '@/lib/state';

export async function POST(request) {
  const data = await request.json();
  const offer_id = data.offer_id; const accepting_teacher_id = data.accepting_teacher_id;
  if (!offer_id || !accepting_teacher_id) return Response.json({ error: 'Missing data' }, { status: 400 });
  const { SUBSTITUTION_OFFERS, GENERATED_TIMETABLE } = getState();
  const offer_found = SUBSTITUTION_OFFERS.find(o => o.id === offer_id);
  if (!offer_found) return Response.json({ error: 'Offer not found or already taken.' }, { status: 404 });
  const details = offer_found.details;
  const newTeacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(accepting_teacher_id);
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(details.course_id);
  const room = db.prepare('SELECT * FROM classrooms WHERE id = ?').get(details.room_id);
  if (!newTeacher || !course || !room) return Response.json({ error: 'Database inconsistency found.' }, { status: 500 });
  const newEntry = { course, teacher: newTeacher, group: details.group, students: details.students, room, slot: details.slot };
  if (Array.isArray(GENERATED_TIMETABLE)) GENERATED_TIMETABLE.push(newEntry);
  replaceSubOffers(SUBSTITUTION_OFFERS.filter(o => JSON.stringify(o.details) !== JSON.stringify(offer_found.details)));
  return Response.json({ message: 'Substitution successful! Your timetable has been updated.' });
}
