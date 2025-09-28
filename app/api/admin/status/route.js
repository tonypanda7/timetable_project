export const runtime = 'nodejs';
import { tableCount, datasetExists } from '@/lib/supabaseCsv';
import { getState } from '@/lib/state';

export async function GET() {
  try {
    const counts = {
      teachers: await tableCount('teachers'),
      students: await tableCount('students'),
      courses: await tableCount('courses'),
      classrooms: await tableCount('classrooms'),
      feedback: await tableCount('feedback'),
      elective_choices: await tableCount('student_electives'),
    };
    const uploads = {
      teachers: await datasetExists('teachers'),
      students: await datasetExists('students'),
      courses: await datasetExists('courses'),
      classrooms: await datasetExists('classrooms'),
      feedback: await datasetExists('feedback'),
    };
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
