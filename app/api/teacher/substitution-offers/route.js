export const runtime = 'nodejs';
import { getState } from '@/lib/state';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const teacher_id = searchParams.get('teacher_id');
  if (!teacher_id) return Response.json({ error: 'Teacher ID required.' }, { status: 400 });
  const { SUBSTITUTION_OFFERS } = getState();
  const offers_for_teacher = SUBSTITUTION_OFFERS.filter(o => o.offered_to_teacher_id === teacher_id);
  return Response.json(offers_for_teacher);
}
