export const runtime = 'nodejs';
import db from '@/lib/db';
import { AntColonyTimetableSolver } from '@/lib/solver';
import { setGeneratedTimetable, replaceSubOffers, replaceCancellationRequests } from '@/lib/state';

export async function POST() {
  replaceSubOffers([]); replaceCancellationRequests([]); setGeneratedTimetable(null);
  const teachers = db.prepare('SELECT * FROM teachers').all();
  const students = db.prepare('SELECT * FROM students').all();
  const courses = db.prepare('SELECT * FROM courses').all();
  const classrooms = db.prepare('SELECT * FROM classrooms').all();
  const feedback = db.prepare('SELECT * FROM feedback').all();
  const electiveChoices = db.prepare('SELECT * FROM student_electives').all();
  if (teachers.length === 0 || students.length === 0 || courses.length === 0 || classrooms.length === 0)
    return Response.json({ error: 'Not enough base data.' }, { status: 400 });
  const constraints = { working_days: 5, periods_per_day: 8, minimum_total_credits: 120 };
  const solver = new AntColonyTimetableSolver(courses, teachers, students, classrooms, feedback, electiveChoices, constraints);
  const finalTimetable = solver.solve();
  if (finalTimetable && finalTimetable.length > 0) {
    setGeneratedTimetable(finalTimetable);
    return Response.json({ message: 'Semester-aware timetables generated!', best_score: solver.bestTimetableScore });
  }
  return Response.json({ error: 'Failed to generate a valid timetable.' }, { status: 500 });
}
