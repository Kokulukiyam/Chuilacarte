import { COLLECTORS } from '@/lib/server/collect';

export const runtime = 'nodejs';

export async function GET() {
  return Response.json(COLLECTORS.map((c) => ({ id: c.id, label: c.label, description: c.description, defaultOn: c.defaultOn !== false })));
}
