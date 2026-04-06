'use client';

import { useState } from 'react';
import { useSavedSites } from '@/hooks/useSavedSites';

function generateKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

function downloadKeyFile(key: string) {
  const blob = new Blob([key], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${key}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface VerifyResult {
  accessible?: boolean;
  statusCode?: number;
  keyFileUrl?: string;
  isKeyMatch?: boolean;
  error?: string;
}

interface DomainEntry {
  id: string;
  domain: string;
  status: 'idle' | 'verifying' | 'success' | 'failed';
  result?: VerifyResult;
}

function newEntry(domain = ''): DomainEntry {
  return { id: crypto.randomUUID(), domain, status: 'idle' };
}

async function verifyDomain(domain: string, key: string): Promise<VerifyResult> {
  const res = await fetch(
    `/api/verify?domain=${encodeURIComponent(domain)}&key=${encodeURIComponent(key)}`
  );
  return res.json();
}

function cleanDomain(raw: string): string {
  return raw.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
}

export default function SetupTab() {
  const [websiteInput, setWebsiteInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState<'key' | 'url' | null>(null);
  const [verifyKey, setVerifyKey] = useState('');
  const [domains, setDomains] = useState<DomainEntry[]>([newEntry()]);
  const { upsertSite } = useSavedSites();

  const domain = cleanDomain(websiteInput);
  const keyFileUrl = domain && apiKey ? `https://${domain}/${apiKey}.txt` : '';

  function handleGenerate() {
    if (!domain) return;
    const key = generateKey();
    setApiKey(key);
    setVerifyKey(key);
    setDomains([newEntry(domain)]);
    // Save to history immediately — user can verify later
    upsertSite({ domain, key, keyFileUrl: `https://${domain}/${key}.txt` });
  }

  async function handleCopy(text: string, type: 'key' | 'url') {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }


  function updateEntry(id: string, patch: Partial<DomainEntry>) {
    setDomains((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function addDomain() {
    setDomains((prev) => [...prev, newEntry()]);
  }

  function removeDomain(id: string) {
    setDomains((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleVerifyOne(entry: DomainEntry) {
    if (!entry.domain || !verifyKey) return;
    updateEntry(entry.id, { status: 'verifying', result: undefined });
    try {
      const result = await verifyDomain(entry.domain, verifyKey);
      updateEntry(entry.id, { status: result.accessible ? 'success' : 'failed', result });
    } catch {
      updateEntry(entry.id, { status: 'failed', result: { error: 'Failed to connect to verification endpoint' } });
    }
  }

  async function handleVerifyAll() {
    const toVerify = domains.filter((d) => d.domain && (d.status === 'idle' || d.status === 'failed'));
    if (!toVerify.length || !verifyKey) return;
    // Mark all as verifying first
    setDomains((prev) =>
      prev.map((d) =>
        toVerify.some((t) => t.id === d.id) ? { ...d, status: 'verifying', result: undefined } : d
      )
    );
    // Run in parallel
    await Promise.all(
      toVerify.map(async (entry) => {
        try {
          const result = await verifyDomain(entry.domain, verifyKey);
          updateEntry(entry.id, { status: result.accessible ? 'success' : 'failed', result });
        } catch {
          updateEntry(entry.id, {
            status: 'failed',
            result: { error: 'Failed to connect to verification endpoint' },
          });
        }
      })
    );
  }

  const anyVerifying = domains.some((d) => d.status === 'verifying');
  const pendingCount = domains.filter((d) => d.domain && (d.status === 'idle' || d.status === 'failed')).length;

  return (
    <div className="space-y-6">
      {/* Step 1 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold">1</span>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Generate Your API Key</h2>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Enter your website domain first — the key file URL will be generated automatically.
        </p>

        {/* Website input */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Your Website <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://primepathaba.com or primepathaba.com"
              value={websiteInput}
              onChange={(e) => setWebsiteInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              className="flex-1 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleGenerate}
              disabled={!domain}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              Generate Key
            </button>
          </div>
        </div>

        {/* Results after generation */}
        {apiKey && (
          <div className="space-y-3">
            {/* Key field */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">API Key</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={apiKey}
                  className="flex-1 font-mono text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100"
                />
                <button
                  onClick={() => handleCopy(apiKey, 'key')}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-colors min-w-20"
                >
                  {copied === 'key' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Key file URL — the main output */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Key File URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={keyFileUrl}
                  className="flex-1 font-mono text-sm bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-blue-700 dark:text-blue-300"
                />
                <button
                  onClick={() => handleCopy(keyFileUrl, 'url')}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-colors min-w-20"
                >
                  {copied === 'url' ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => downloadKeyFile(apiKey)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  Download .txt
                </button>
              </div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5">
                Upload the downloaded file to your server so this URL returns the key as plain text.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Step 2 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold">2</span>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Place the Key File on Each Website</h2>
        </div>

        {apiKey ? (
          <div className="space-y-4">
            <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap mt-0.5">File name:</span>
                <code className="text-sm font-mono text-blue-600 dark:text-blue-400">{apiKey}.txt</code>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap mt-0.5">File content:</span>
                <code className="text-sm font-mono text-zinc-700 dark:text-zinc-300 break-all">{apiKey}</code>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap mt-0.5">Upload to:</span>
                <code className="text-sm font-mono text-zinc-700 dark:text-zinc-300 break-all">
                  https://yourdomain.com/{apiKey}.txt
                </code>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2 flex items-center gap-2">
                  <span>🌐</span> WordPress
                </h3>
                <ol className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 list-decimal list-inside">
                  <li>Install <strong>File Manager</strong> plugin</li>
                  <li>Navigate to <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">/public_html/</code></li>
                  <li>Upload <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{apiKey}.txt</code></li>
                  <li>Ensure file content is only the key</li>
                </ol>
              </div>
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2 flex items-center gap-2">
                  <span>🖥️</span> Any Website (FTP / cPanel)
                </h3>
                <ol className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 list-decimal list-inside">
                  <li>Download the key file above</li>
                  <li>Connect via FTP or cPanel File Manager</li>
                  <li>Upload to your site root directory</li>
                  <li>Verify the URL is publicly accessible</li>
                </ol>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">Generate a key in Step 1 first.</p>
        )}
      </div>

      {/* Step 3 — multi-domain verify */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold">3</span>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Verify Key is Live</h2>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
          Add all your websites and verify that the key file is accessible on each one.
        </p>

        {/* Shared key field */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">API Key to verify with</label>
          <input
            type="text"
            placeholder="Auto-filled from Step 1, or paste manually"
            value={verifyKey}
            onChange={(e) => setVerifyKey(e.target.value)}
            className="w-full font-mono text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Domain rows */}
        <div className="space-y-2 mb-4">
          {domains.map((entry, idx) => (
            <DomainRow
              key={entry.id}
              entry={entry}
              index={idx}
              canRemove={domains.length > 1}
              onDomainChange={(val) => updateEntry(entry.id, { domain: val, status: 'idle', result: undefined })}
              onVerify={() => handleVerifyOne(entry)}
              onRemove={() => removeDomain(entry.id)}
              verifyKey={verifyKey}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={addDomain}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span> Add Website
          </button>
          {pendingCount > 0 && (
            <button
              onClick={handleVerifyAll}
              disabled={anyVerifying || !verifyKey}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {anyVerifying ? 'Verifying...' : `Verify All (${pendingCount})`}
            </button>
          )}
        </div>

        {/* Summary */}
        {domains.some((d) => d.status === 'success' || d.status === 'failed') && (
          <div className="mt-4 flex items-center gap-4 text-sm">
            {domains.filter((d) => d.status === 'success').length > 0 && (
              <span className="text-green-600 dark:text-green-400 font-medium">
                ✓ {domains.filter((d) => d.status === 'success').length} verified
              </span>
            )}
            {domains.filter((d) => d.status === 'failed').length > 0 && (
              <span className="text-red-600 dark:text-red-400 font-medium">
                ✗ {domains.filter((d) => d.status === 'failed').length} failed
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Domain row sub-component ── */
interface DomainRowProps {
  entry: DomainEntry;
  index: number;
  canRemove: boolean;
  verifyKey: string;
  onDomainChange: (val: string) => void;
  onVerify: () => void;
  onRemove: () => void;
}

function DomainRow({ entry, index, canRemove, verifyKey, onDomainChange, onVerify, onRemove }: DomainRowProps) {
  const statusIcon = {
    idle: null,
    verifying: <span className="text-blue-500 text-xs animate-pulse">Checking…</span>,
    success: <span className="text-green-600 dark:text-green-400 text-lg leading-none">✓</span>,
    failed: <span className="text-red-500 text-lg leading-none">✗</span>,
  }[entry.status];

  const rowBorder = {
    idle: 'border-zinc-200 dark:border-zinc-700',
    verifying: 'border-blue-300 dark:border-blue-700',
    success: 'border-green-300 dark:border-green-700',
    failed: 'border-red-300 dark:border-red-700',
  }[entry.status];

  return (
    <div className={`rounded-lg border ${rowBorder} overflow-hidden transition-colors`}>
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-zinc-900">
        <span className="text-xs text-zinc-400 dark:text-zinc-600 w-5 text-right shrink-0">{index + 1}</span>
        <input
          type="text"
          placeholder="www.example.com"
          value={entry.domain}
          onChange={(e) => onDomainChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onVerify()}
          className="flex-1 text-sm bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
        />
        <div className="flex items-center gap-2 shrink-0">
          {statusIcon}
          <button
            onClick={onVerify}
            disabled={entry.status === 'verifying' || !entry.domain || !verifyKey}
            className="px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition-colors"
          >
            {entry.status === 'verifying' ? '…' : entry.status === 'success' ? 'Re-verify' : 'Verify'}
          </button>
          {canRemove && (
            <button
              onClick={onRemove}
              className="p-1 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded"
              title="Remove"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Result detail */}
      {entry.result && entry.status !== 'verifying' && (
        <div className={`px-4 py-2 text-xs border-t ${entry.status === 'success' ? 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'}`}>
          {entry.status === 'success' ? (
            <span>Key file found at <code className="font-mono">{entry.result.keyFileUrl}</code> — HTTP {entry.result.statusCode}</span>
          ) : (
            <span>
              {entry.result.error
                ? entry.result.error
                : entry.result.statusCode
                ? `HTTP ${entry.result.statusCode} — ${entry.result.isKeyMatch === false ? 'File found but content does not match key' : 'File not accessible'}`
                : 'Unknown error'}
              {entry.result.keyFileUrl && !entry.result.error && (
                <span className="ml-1">· Checked: <code className="font-mono">{entry.result.keyFileUrl}</code></span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
