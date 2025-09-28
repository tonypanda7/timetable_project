export const runtime = 'nodejs';
import { getState } from '@/lib/state';
export async function GET() { const { CANCELLATION_REQUESTS } = getState(); return Response.json(CANCELLATION_REQUESTS); }
