'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, X, Clock, XCircle, AlertTriangle, RefreshCw, ArrowRight, Upload, FileDown, LayoutList } from 'lucide-react';
import { useSavedSites, type SavedSite } from '@/hooks/useSavedSites';
import { useSubmissionHistory, type EngineResult } from '@/hooks/useSubmissionHistory';

const CSV_TEMPLATE = `URL\nhttps://www.example.com/\nhttps://www.example.com/about\nhttps://www.example.com/contact\nhttps://www.example.com/blog`;

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

export function statusBadge(r: EngineResult) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold';
  if (r.success) return `${base} bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300`;
  if (r.pending) return `${base} bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300`;
  if (r.statusCode === 0) return `${base} bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400`;
  return `${base} bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300`;
}

export function statusLabel(r: EngineResult) {
  if (r.success) return <><Check size={11} /> Submitted</>;
  if (r.pending) return <><Clock size={11} /> Pending</>;
  if (r.statusCode === 0) return <>Error</>;
  return <><XCircle size={11} /> Failed</>;
}

export default function SubmitTab() {
  const { sites, removeSite } = useSavedSites();
  const { addRecord, updateRecord } = useSubmissionHistory();

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [host, setHost] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [keyLocation, setKeyLocation] = useState('');
  const [urlText, setUrlText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [response, setResponse] = useState<SubmitResponse | null>(null);
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const csvInputRef = useRef<HTMLInputElement>(null);

  function selectSite(site: SavedSite) {
    setSelectedSiteId(site.id);
    setHost(site.domain);
    setApiKey(site.key);
    setKeyLocation(site.keyFileUrl);
    setResponse(null);
    setCurrentRecordId(null);
    setError('');
  }

  function clearSelection() {
    setSelectedSiteId(null);
    setHost('');
    setApiKey('');
    setKeyLocation('');
  }

  useEffect(() => {
    if (selectedSiteId) return;
    if (host && apiKey) {
      const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
      setKeyLocation(`https://${cleanHost}/${apiKey}.txt`);
    } else {
      setKeyLocation('');
    }
  }, [host, apiKey, selectedSiteId]);

  function loadSampleData() {
    const base = host
      ? `https://${host.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
      : 'https://www.example.com';
    setUrlText(
      [`${base}/`, `${base}/about`, `${base}/contact`, `${base}/blog`,
       `${base}/blog/getting-started`, `${base}/blog/top-10-tips`,
       `${base}/products`, `${base}/services`, `${base}/faq`, `${base}/pricing`]
        .join('\n')
    );
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const urls = parseCsv(ev.target?.result as string);
      setUrlText(urls.join('\n'));
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const parsedUrls = parseUrls(urlText);
  const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const resolvedKeyLocation = keyLocation || `https://${cleanHost}/${apiKey}.txt`;

  async function handleSubmit() {
    if (!host || !apiKey || !parsedUrls.length) return;
    setSubmitting(true);
    setResponse(null);
    setCurrentRecordId(null);
    setError('');
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: cleanHost, key: apiKey, keyLocation: resolvedKeyLocation, urls: parsedUrls }),
      });
      const data: SubmitResponse = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Submission failed');
      setResponse(data);
      // Save to history
      addRecord({
        host: cleanHost,
        key: apiKey,
        keyLocation: resolvedKeyLocation,
        urls: parsedUrls,
        results: data.results,
      });
      // Store the id so re-check can update the same record
      // We can't get it back from addRecord directly — read it via a callback trick
      // Instead we'll let HistoryTab handle updates; re-check below will use updateRecord
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecheck() {
    if (!response || !host || !apiKey) return;
    const pendingEngines = response.results.filter((r) => r.pending).map((r) => r.engine);
    if (!pendingEngines.length) return;
    setRechecking(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: cleanHost,
          key: apiKey,
          keyLocation: resolvedKeyLocation,
          urls: parsedUrls,
          engines: pendingEngines,
        }),
      });
      const data: SubmitResponse = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Re-check failed');

      // Merge: replace only the re-checked engines
      const merged = response.results.map((existing) => {
        const updated = data.results.find((r) => r.engine === existing.engine);
        return updated ?? existing;
      });
      const newResponse = { ...response, results: merged };
      setResponse(newResponse);

      // Update localStorage record if we have its id
      if (currentRecordId) updateRecord(currentRecordId, merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRechecking(false);
    }
  }

  const canSubmit = host && apiKey && parsedUrls.length > 0 && !submitting;
  const pendingCount = response?.results.filter((r) => r.pending).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Configuration</h2>

        {sites.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Saved websites — click to select</p>
            <div className="flex flex-wrap gap-2">
              {sites.map((site) => {
                const isSelected = site.id === selectedSiteId;
                return (
                  <div
                    key={site.id}
                    className={`group flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-blue-400 dark:hover:border-blue-500'
                    }`}
                    onClick={() => (isSelected ? clearSelection() : selectSite(site))}
                  >
                    <span className="font-medium">{site.domain}</span>
                    {site.verifiedAt && (
                      <Check size={12} className={isSelected ? 'text-blue-200' : 'text-green-500 dark:text-green-400'} />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); if (isSelected) clearSelection(); removeSite(site.id); }}
                      className={`ml-1 rounded p-0.5 transition-colors ${isSelected ? 'hover:bg-blue-500 text-blue-200 hover:text-white' : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-red-500'}`}
                      title="Remove from history"
                    ><X size={12} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Host <span className="text-red-500">*</span></label>
            <input type="text" placeholder="www.example.com" value={host} onChange={(e) => setHost(e.target.value)}
              className="w-full text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">API Key <span className="text-red-500">*</span></label>
            <input type="text" placeholder="Your IndexNow API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              className="w-full font-mono text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Key File Location (auto-computed)</label>
            <input type="text" value={keyLocation} onChange={(e) => setKeyLocation(e.target.value)}
              placeholder="https://www.example.com/your-key.txt"
              className="w-full font-mono text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-500 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* URL Input */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">URLs to Submit</h2>
          <div className="flex items-center gap-2">
            <button onClick={loadSampleData} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg transition-colors">
              <LayoutList size={13} /> Sample Data
            </button>
            <button onClick={downloadCsvTemplate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg transition-colors">
              <FileDown size={13} /> CSV Template
            </button>
            <button onClick={() => csvInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-lg transition-colors">
              <Upload size={13} /> Upload CSV
            </button>
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} />
          </div>
        </div>
        <textarea value={urlText} onChange={(e) => setUrlText(e.target.value)}
          placeholder={'Paste URLs here, one per line:\nhttps://www.example.com/page-1\nhttps://www.example.com/page-2'}
          rows={10}
          className="w-full font-mono text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
        <div className="flex items-center justify-between mt-3">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {parsedUrls.length > 0
              ? <span className="text-blue-600 dark:text-blue-400 font-medium">{parsedUrls.length} URL{parsedUrls.length !== 1 ? 's' : ''} ready</span>
              : 'No valid URLs detected'}
          </span>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors">
            {submitting ? 'Submitting…' : <span className="flex items-center gap-1.5">Submit to IndexNow <ArrowRight size={14} /></span>}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">{error}</div>
      )}

      {/* Results */}
      {response && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Submission Results</h2>
            <div className="flex items-center gap-3">
              {pendingCount > 0 && (
                <button onClick={handleRecheck} disabled={rechecking}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-400 rounded-lg transition-colors disabled:opacity-50">
                  {rechecking ? 'Checking…' : <span className="flex items-center gap-1.5"><RefreshCw size={13} /> Re-check {pendingCount} pending</span>}
                </button>
              )}
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {response.urlCount} URL{response.urlCount !== 1 ? 's' : ''} · {response.results.length} engines
              </span>
            </div>
          </div>

          {/* Pending notice */}
          {pendingCount > 0 && !rechecking && (
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">{pendingCount} engine{pendingCount !== 1 ? 's' : ''} pending key verification</p>
                <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                  Make sure your key file is uploaded, then click <strong>Re-check</strong> to see if they have processed your URLs.
                </p>
              </div>
            </div>
          )}

          {/* Engine table */}
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
                    <td className="px-4 py-3 font-mono text-zinc-700 dark:text-zinc-300">{r.statusCode === 0 ? '—' : r.statusCode}</td>
                    <td className="px-4 py-3"><span className={statusBadge(r)}>{statusLabel(r)}</span></td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-xs">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* URL list */}
          <div>
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Submitted URLs</h3>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              {parsedUrls.map((url, i) => {
                const anySuccess = response.results.some((r) => r.success);
                const anyPending = !anySuccess && response.results.some((r) => r.pending);
                const Icon = anySuccess ? Check : anyPending ? Clock : XCircle;
                const color = anySuccess ? 'text-green-500' : anyPending ? 'text-amber-500' : 'text-red-500';
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <Icon size={13} className={color} />
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
