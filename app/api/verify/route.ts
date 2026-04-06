import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');
  const key = searchParams.get('key');

  if (!domain || !key) {
    return NextResponse.json({ error: 'Missing domain or key' }, { status: 400 });
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const keyFileUrl = `https://${cleanDomain}/${key}.txt`;

  try {
    const response = await fetch(keyFileUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'IndexNow-Verifier/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    const content = await response.text();
    const isKeyMatch = content.trim() === key;

    return NextResponse.json({
      accessible: response.ok && isKeyMatch,
      statusCode: response.status,
      keyFileUrl,
      isKeyMatch,
      content: content.trim().substring(0, 100),
    });
  } catch (error) {
    return NextResponse.json({
      accessible: false,
      keyFileUrl,
      error: error instanceof Error ? error.message : 'Failed to reach key file',
    });
  }
}
