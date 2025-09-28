export const runtime = 'nodejs';
import { pushCancellation } from '@/lib/state';
import { randomUUID } from 'crypto';

export async function POST(request) {
  const data = await request.json();
  if (!data) return Response.json({ error: 'Invalid request' }, { status: 400 });
  data.id = randomUUID();
  pushCancellation(data);
  return Response.json({ message: 'Request received and pending approval.' }, { status: 201 });
}
