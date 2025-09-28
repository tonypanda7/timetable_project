export const runtime = 'nodejs';
import { collectionCount, datasetExistsInStorage } from '@/lib/firebaseCsv';

export async function GET() {
  try {
    const counts = {
      teachers: await collectionCount('teachers'),
      students: await collectionCount('students'),
      courses: await collectionCount('courses'),
      classrooms: await collectionCount('classrooms'),
      feedback: await collectionCount('feedback'),
      elective_choices: await collectionCount('student_electives'),
    };
    const uploads = {
      teachers: await datasetExistsInStorage('teachers'),
      students: await datasetExistsInStorage('students'),
      courses: await datasetExistsInStorage('courses'),
      classrooms: await datasetExistsInStorage('classrooms'),
      feedback: await datasetExistsInStorage('feedback'),
    };
    return Response.json({
      db_connected: true,
      counts,
      uploads,
      timetable_generated: false,
      pending_requests: 0,
      substitution_offers: 0,
    });
  } catch (e) {
    return Response.json({ db_connected: false, counts: {}, uploads: {}, timetable_generated: false, pending_requests: 0, substitution_offers: 0 }, { status: 200 });
  }
}
