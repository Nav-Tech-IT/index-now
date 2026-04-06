'use client';

import { useState, useRef, useEffect } from 'react';

const SAMPLE_URLS = [
  'https://www.example.com/',
  'https://www.example.com/about',
  'https://www.example.com/contact',
  'https://www.example.com/blog',
  'https://www.example.com/blog/getting-started',
  'https://www.example.com/blog/top-10-tips',
  'https://www.example.com/products',
  'https://www.example.com/services',
  'https://www.example.com/faq',
  'https://www.example.com/pricing',
];

const CSV_TEMPLATE = `URL\nhttps://www.example.com/\nhttps://www.example.com/about\nhttps://www.example.com/contact\nhttps://www.example.com/blog`;

interface EngineResult {
  engine: string;
  endpoint: string;
  statusCode: number;
  statusText: string;
  message: string;
  success: boolean;
}

interface SubmitResponse {
  results: EngineResult[];
  urlCount: number;
}

function parseUrls(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('http'));
}

function parseCsv(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const urls: string[] = [];
  for (const line of lines) {
    const firstCol = line.split(',')[0].replace(/^"|"$/g, '').trim();
    if (firstCol.startsWith('http')) urls.push(firstCol);
  }
  return urls;
}

function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'indexnow-urls-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function statusBadge(code: number, success: boolean) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold';
  if (success) return `${base} bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300`;
  if (code === 0) return `${base} bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400`;
  return `${base} bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300`;
}

export default function SubmitTab() {
  const [host, setHost] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [keyLocation, setKeyLocation] = useState('');
  const [urlText, setUrlText] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'csv'>('text');
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState('');
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (host && apiKey) {
      const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
      setKeyLocation(`https://${cleanHost}/${apiKey}.txt`);
    } else {
      setKeyLocation('');
    }
  }, [host, apiKey]);

  function loadSampleData() {
    const base = host ? `https://${host.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : 'https://www.example.com';
    const samples = [
      `${base}/`,
      `${base}/about`,
      `${base}/contact`,
      `${base}/blog`,
      `${base}/blog/getting-started`,
      `${base}/blog/top-10-tips`,
      `${base}/products`,
      `${base}/services`,
      `${base}/faq`,
      `${base}/pricing`,
    ];
    setUrlText(samples.join('\n'));
    setInputMode('text');
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const urls = parseCsv(text);
      setUrlText(urls.join('\n'));
      setInputMode('text');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const parsedUrls = parseUrls(urlText);

  async function handleSubmit() {
    if (!host || !apiKey || !parsedUrls.length) return;
    setSubmitting(true);
    setResponse(null);
    setError('');

    const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: cleanHost,
          key: apiKey,
          keyLocation: keyLocation || `https://${cleanHost}/${apiKey}.txt`,
          urls: parsedUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = host && apiKey && parsedUrls.length > 0 && !submitting;

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Host <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="www.example.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-full text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">API Key <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Your IndexNow API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full font-mono text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Key File Location (auto-computed)</label>
            <input
              type="text"
              value={keyLocation}
              onChange={(e) => setKeyLocation(e.target.value)}
              placeholder="https://www.example.com/your-key.txt"
              className="w-full font-mono text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-500 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* URL Input */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">URLs to Submit</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSampleData}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg transition-colors"
            >
              Load Sample Data
            </button>
            <button
              onClick={downloadCsvTemplate}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg transition-colors"
            >
              Download CSV Template
            </button>
            <button
              onClick={() => csvInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
            >
              Upload CSV
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvUpload}
            />
          </div>
        </div>

        <textarea
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
          placeholder={'Paste URLs here, one per line:\nhttps://www.example.com/page-1\nhttps://www.example.com/page-2\nhttps://www.example.com/page-3'}
          rows={10}
          className="w-full font-mono text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />

        <div className="flex items-center justify-between mt-3">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {parsedUrls.length > 0 ? (
              <span className="text-blue-600 dark:text-blue-400 font-medium">{parsedUrls.length} URL{parsedUrls.length !== 1 ? 's' : ''} ready to submit</span>
            ) : (
              'No valid URLs detected'
            )}
          </span>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {submitting ? 'Submitting...' : `Submit to IndexNow →`}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {response && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Submission Results</h2>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {response.urlCount} URL{response.urlCount !== 1 ? 's' : ''} submitted to {response.results.length} search engines
            </span>
          </div>

          {/* Engine results table */}
          <div>
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Search Engine Responses</h3>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Search Engine</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Status Code</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {response.results.map((r) => (
                    <tr key={r.engine} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.engine}</td>
                      <td className="px-4 py-3 font-mono text-zinc-700 dark:text-zinc-300">
                        {r.statusCode === 0 ? '—' : r.statusCode}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadge(r.statusCode, r.success)}>
                          {r.success ? '✓ Success' : r.statusCode === 0 ? 'Error' : '✗ Failed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-xs">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Submitted URLs list */}
          <div>
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Submitted URLs</h3>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              {parsedUrls.map((url, i) => {
                const anySuccess = response.results.some((r) => r.success);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <span className={`text-sm font-bold ${anySuccess ? 'text-green-500' : 'text-red-500'}`}>
                      {anySuccess ? '✓' : '✗'}
                    </span>
                    <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400 truncate">{url}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
