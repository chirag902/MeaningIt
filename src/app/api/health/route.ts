import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { groq } from '@/ai/groq';
import { getServerEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const secret = process.env.HEALTHCHECK_SECRET;
  if (!secret) return false;

  const provided = Buffer.from(request.headers.get('x-health-secret') ?? '');
  const expected = Buffer.from(secret);

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get('deep') === '1';

  let env;
  try {
    env = getServerEnv();
  } catch {
    return NextResponse.json({ status: 'misconfigured' }, { status: 500 });
  }

  if (!deep) return NextResponse.json({ status: 'ok' });

  if (!isAuthorized(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  }

  try {
    const list = await groq.models.list();
    const available = new Set(list.data.map((model) => model.id));
    const wanted = [env.GROQ_VISION_MODEL, env.GROQ_TRANSLATE_MODEL];
    const missingModels = wanted.filter((model) => !available.has(model));

    return NextResponse.json(
      { status: missingModels.length ? 'degraded' : 'ok', missingModels },
      { status: missingModels.length ? 503 : 200 },
    );
  } catch {
    return NextResponse.json({ status: 'provider_unreachable' }, { status: 502 });
  }
}