'use client';

import { useState, useEffect, useCallback } from 'react';

export interface EngineResult {
  engine: string;
  endpoint: string;
  statusCode: number;
  statusText: string;
  message: string;
  success: boolean;
  pending: boolean;
}

export interface SubmissionRecord {
  id: string;
  timestamp: number;
  host: string;
  key: string;
  keyLocation: string;
  urls: string[];
  results: EngineResult[];
}

const STORAGE_KEY = 'indexnow_submission_history';
const MAX_RECORDS = 100;

function readStorage(): SubmissionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeStorage(records: SubmissionRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function useSubmissionHistory() {
  const [history, setHistory] = useState<SubmissionRecord[]>([]);

  useEffect(() => {
    setHistory(readStorage());
  }, []);

  const addRecord = useCallback((record: Omit<SubmissionRecord, 'id' | 'timestamp'>) => {
    setHistory((prev) => {
      const next = [
        { ...record, id: crypto.randomUUID(), timestamp: Date.now() },
        ...prev,
      ].slice(0, MAX_RECORDS);
      writeStorage(next);
      return next;
    });
  }, []);

  const updateRecord = useCallback((id: string, results: EngineResult[]) => {
    setHistory((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, results } : r));
      writeStorage(next);
      return next;
    });
  }, []);

  const removeRecord = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((r) => r.id !== id);
      writeStorage(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    writeStorage([]);
  }, []);

  return { history, addRecord, updateRecord, removeRecord, clearHistory };
}
