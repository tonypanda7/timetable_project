export const runtime = 'nodejs';
import { AntColonyTimetableSolver } from '@/lib/solver';
import { setGeneratedTimetable, replaceSubOffers, replaceCancellationRequests } from '@/lib/state';
import { fetchAll } from '@/lib/supabaseCsv';

function coerceArray(arr) {
  return arr.map((obj) => {
    const out = { ...obj };
    if (out.working_hours !== undefined) out.working_hours = Number(out.working_hours);
    if (out.semester !== undefined) out.semester = Number(out.semester);
    if (out.credits !== undefined) out.credits = Number(out.credits);
    if (out.capacity !== undefined) out.capacity = Number(out.capacity);
    if (out.teacher_rating !== undefined) out.teacher_rating = Number(out.teacher_rating);
    if (out.course_rating !== undefined) out.course_rating = Number(out.course_rating);
    if (out.course_id !== undefined) out.course_id = Number(out.course_id);
    return out;
  });
}

export async function POST() {
  try {
    replaceSubOffers([]); replaceCancellationRequests([]); setGeneratedTimetable(null);
    const [teachers, students, courses, classrooms, feedback, electiveChoices] = await Promise.all([
      fetchAllFrom('teachers'),
      fetchAllFrom('students'),
      fetchAllFrom('courses'),
      fetchAllFrom('classrooms'),
      fetchAllFrom('feedback'),
      fetchAllFrom('student_electives'),
    ]);
    if (teachers.length === 0 || students.length === 0 || courses.length === 0 || classrooms.length === 0)
      return Response.json({ error: 'Not enough base data.' }, { status: 400 });
    const constraints = { working_days: 5, periods_per_day: 8, minimum_total_credits: 120 };
    const solver = new AntColonyTimetableSolver(coerceArray(courses), coerceArray(teachers), coerceArray(students), coerceArray(classrooms), coerceArray(feedback), coerceArray(electiveChoices), constraints);
    const finalTimetable = solver.solve();
    if (finalTimetable && finalTimetable.length > 0) {
      setGeneratedTimetable(finalTimetable);
      return Response.json({ message: 'Semester-aware timetables generated!', best_score: solver.bestTimetableScore });
    }
    return Response.json({ error: 'Failed to generate a valid timetable.' }, { status: 500 });
  } catch (e) {
    return Response.json({ error: e.message || 'Generation failed' }, { status: 500 });
  }
}
