'use client';

import { useState } from 'react';
import SetupTab from './SetupTab';
import SubmitTab from './SubmitTab';

const TABS = [
  { id: 'setup', label: 'Setup API Key', icon: '🔑' },
  { id: 'submit', label: 'Bulk Submit URLs', icon: '🚀' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function IndexNowApp() {
  const [activeTab, setActiveTab] = useState<TabId>('setup');

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
              ⚡
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">IndexNow Bulk Submitter</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Submit URLs to all IndexNow-enabled search engines instantly</p>
            </div>
          </div>

          {/* Supported engines badge row */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-xs text-zinc-400 dark:text-zinc-500">Submits to:</span>
            {['IndexNow', 'Bing', 'Yandex', 'Naver', 'Seznam', 'Yep'].map((engine) => (
              <span
                key={engine}
                className="px-2 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full"
              >
                {engine}
              </span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {activeTab === 'setup' && <SetupTab />}
        {activeTab === 'submit' && <SubmitTab />}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-xs text-zinc-400 dark:text-zinc-600">
          IndexNow is an open protocol supported by Bing, Yandex, and other search engines.{' '}
          <a
            href="https://www.indexnow.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-600 dark:hover:text-zinc-400"
          >
            Learn more
          </a>
        </div>
      </footer>
    </div>
  );
}
