export const runtime = 'nodejs';
import fs from 'fs';
import path from 'path';
import db from '@/lib/db';
import { getState } from '@/lib/state';

export async function GET() {
  try {
    const counts = {
      teachers: db.prepare('SELECT COUNT(*) as c FROM teachers').get().c,
      students: db.prepare('SELECT COUNT(*) as c FROM students').get().c,
      courses: db.prepare('SELECT COUNT(*) as c FROM courses').get().c,
      classrooms: db.prepare('SELECT COUNT(*) as c FROM classrooms').get().c,
      feedback: db.prepare('SELECT COUNT(*) as c FROM feedback').get().c,
      elective_choices: db.prepare('SELECT COUNT(*) as c FROM student_electives').get().c,
    };
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const uploads = ['teachers','students','courses','classrooms','feedback'].reduce((acc, name) => {
      acc[name] = fs.existsSync(path.join(uploadsDir, `${name}.csv`)); return acc; }, {});
    const { GENERATED_TIMETABLE, CANCELLATION_REQUESTS, SUBSTITUTION_OFFERS } = getState();
    return Response.json({
      db_connected: true,
      counts,
      uploads,
      timetable_generated: Array.isArray(GENERATED_TIMETABLE) && GENERATED_TIMETABLE.length > 0,
      pending_requests: CANCELLATION_REQUESTS.length,
      substitution_offers: SUBSTITUTION_OFFERS.length,
    });
  } catch (e) {
    return Response.json({ db_connected: false, counts: {}, uploads: {}, timetable_generated: false, pending_requests: 0, substitution_offers: 0 }, { status: 200 });
  }
}
