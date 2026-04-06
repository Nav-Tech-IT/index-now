'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Check, Clock, XCircle, RefreshCw, X, Trash2 } from 'lucide-react';
import { useSubmissionHistory, type SubmissionRecord, type EngineResult } from '@/hooks/useSubmissionHistory';
import { statusBadge, statusLabel } from './SubmitTab';

function formatDate(ts: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ts));
}

function EnginePills({ results }: { results: EngineResult[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {results.map((r) => (
        <span key={r.engine} className={statusBadge(r)}>{r.engine} {statusLabel(r)}</span>
      ))}
    </div>
  );
}

function HistoryRow({
  record,
  onRemove,
  onRecheck,
}: {
  record: SubmissionRecord;
  onRemove: () => void;
  onRecheck: (record: SubmissionRecord) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [rechecking, setRechecking] = useState(false);

  const pendingEngines = record.results.filter((r) => r.pending);
  const successCount = record.results.filter((r) => r.success).length;
  const pendingCount = pendingEngines.length;
  const failedCount = record.results.filter((r) => !r.success && !r.pending).length;

  async function handleRecheck() {
    setRechecking(true);
    await onRecheck(record);
    setRechecking(false);
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
        <button onClick={() => setOpen((o) => !o)} className="flex-1 flex items-center gap-3 text-left min-w-0">
          {open ? <ChevronDown size={14} className="text-zinc-400 shrink-0" /> : <ChevronRight size={14} className="text-zinc-400 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{record.host}</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">{formatDate(record.timestamp)} · {record.urls.length} URL{record.urls.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {successCount > 0 && <span className="flex items-center gap-0.5 text-xs font-medium text-green-600 dark:text-green-400"><Check size={11} /> {successCount}</span>}
            {pendingCount > 0 && <span className="flex items-center gap-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"><Clock size={11} /> {pendingCount}</span>}
            {failedCount > 0 && <span className="flex items-center gap-0.5 text-xs font-medium text-red-600 dark:text-red-400"><XCircle size={11} /> {failedCount}</span>}
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <button
              onClick={handleRecheck}
              disabled={rechecking}
              className="px-3 py-1 text-xs font-medium bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-400 rounded-lg transition-colors disabled:opacity-50"
            >
              {rechecking ? 'Checking…' : <span className="flex items-center gap-1"><RefreshCw size={12} /> Re-check ({pendingCount})</span>}
            </button>
          )}
          <button
            onClick={onRemove}
            className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded"
            title="Delete record"
          ><X size={13} /></button>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 p-4 space-y-4">
          {/* Engine results */}
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Search Engine Results</p>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="w-full text-sm">
                <thead className="bg-white dark:bg-zinc-900 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Engine</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Code</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {record.results.map((r) => (
                    <tr key={r.engine} className="bg-white dark:bg-zinc-900">
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{r.engine}</td>
                      <td className="px-3 py-2 font-mono text-zinc-600 dark:text-zinc-400">{r.statusCode === 0 ? '—' : r.statusCode}</td>
                      <td className="px-3 py-2"><span className={statusBadge(r)}>{statusLabel(r)}</span></td>
                      <td className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* URL list */}
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">URLs ({record.urls.length})</p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
              {record.urls.map((url, i) => (
                <div key={i} className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
                  <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{url}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryTab() {
  const { history, updateRecord, removeRecord, clearHistory } = useSubmissionHistory();

  async function handleRecheck(record: SubmissionRecord) {
    const pendingEngines = record.results.filter((r) => r.pending).map((r) => r.engine);
    if (!pendingEngines.length) return;
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: record.host,
          key: record.key,
          keyLocation: record.keyLocation,
          urls: record.urls,
          engines: pendingEngines,
        }),
      });
      const data = await res.json();
      if (!res.ok) return;
      const merged = record.results.map((existing) => {
        const updated = (data.results as EngineResult[]).find((r) => r.engine === existing.engine);
        return updated ?? existing;
      });
      updateRecord(record.id, merged);
    } catch {
      // silent — user can retry
    }
  }

  if (history.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-12 text-center">
        <p className="text-zinc-400 dark:text-zinc-500 text-sm">No submissions yet.</p>
        <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">Go to <strong>Bulk Submit URLs</strong> to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{history.length} submission{history.length !== 1 ? 's' : ''} stored</p>
        <button
          onClick={clearHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
        >
          <Trash2 size={13} /> Clear All
        </button>
      </div>

      {history.map((record) => (
        <HistoryRow
          key={record.id}
          record={record}
          onRemove={() => removeRecord(record.id)}
          onRecheck={handleRecheck}
        />
      ))}
    </div>
  );
}
