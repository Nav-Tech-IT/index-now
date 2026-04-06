import { NextRequest, NextResponse } from 'next/server';

const SEARCH_ENGINES = [
  { name: 'IndexNow', url: 'https://api.indexnow.org/indexnow' },
  { name: 'Bing', url: 'https://www.bing.com/indexnow' },
  { name: 'Yandex', url: 'https://yandex.com/indexnow' },
  { name: 'Naver', url: 'https://searchadvisor.naver.com/indexnow' },
  { name: 'Seznam', url: 'https://search.seznam.cz/indexnow' },
  { name: 'Yep', url: 'https://indexnow.yep.com/indexnow' },
];

const STATUS_MESSAGES: Record<number, string> = {
  200: 'URLs submitted successfully',
  202: 'Accepted — key not yet verified, will process when verified',
  400: 'Bad request — invalid format or missing required field',
  403: 'Forbidden — key not found or does not match host',
  422: 'Unprocessable — URLs do not belong to host or are invalid',
  429: 'Too many requests — rate limit exceeded',
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { host, key, keyLocation, urls, engines: engineFilter } = body as {
    host: string;
    key: string;
    keyLocation: string;
    urls: string[];
    engines?: string[]; // optional — only submit to these engine names
  };

  if (!host || !key || !urls?.length) {
    return NextResponse.json({ error: 'Missing host, key, or URLs' }, { status: 400 });
  }

  const payload = {
    host,
    key,
    keyLocation: keyLocation || `https://${host}/${key}.txt`,
    urlList: urls,
  };

  const targets = engineFilter?.length
    ? SEARCH_ENGINES.filter((e) => engineFilter.includes(e.name))
    : SEARCH_ENGINES;

  const results = await Promise.all(
    targets.map(async (engine) => {
      try {
        const response = await fetch(engine.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });

        const rawBody = await response.text().catch(() => '');
        const isHtml = rawBody.trimStart().startsWith('<');
        const message = STATUS_MESSAGES[response.status] ?? (isHtml ? `HTTP ${response.status}` : rawBody) ?? `HTTP ${response.status}`;

        return {
          engine: engine.name,
          endpoint: engine.url,
          statusCode: response.status,
          statusText: response.statusText,
          message,
          success: response.status === 200,
          pending: response.status === 202,
        };
      } catch (error) {
        return {
          engine: engine.name,
          endpoint: engine.url,
          statusCode: 0,
          statusText: 'Network Error',
          message: error instanceof Error ? error.message : 'Request failed',
          success: false,
        };
      }
    })
  );

  return NextResponse.json({ results, urlCount: urls.length });
}
