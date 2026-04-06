'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SavedSite {
  id: string;
  domain: string;
  key: string;
  keyFileUrl: string;
  verifiedAt?: number;
  addedAt: number;
}

const STORAGE_KEY = 'indexnow_saved_sites';

function readStorage(): SavedSite[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeStorage(sites: SavedSite[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
}

export function useSavedSites() {
  const [sites, setSites] = useState<SavedSite[]>([]);

  useEffect(() => {
    setSites(readStorage());
  }, []);

  const upsertSite = useCallback((
    site: Omit<SavedSite, 'id' | 'addedAt' | 'verifiedAt'> & { markVerified?: boolean }
  ) => {
    setSites((prev) => {
      const now = Date.now();
      const existing = prev.find((s) => s.domain === site.domain);
      let next: SavedSite[];
      if (existing) {
        next = prev.map((s) =>
          s.domain === site.domain
            ? { ...s, ...site, id: s.id, addedAt: s.addedAt, verifiedAt: site.markVerified ? now : s.verifiedAt }
            : s
        );
      } else {
        const newSite: SavedSite = {
          id: crypto.randomUUID(),
          addedAt: now,
          verifiedAt: site.markVerified ? now : undefined,
          ...site,
        };
        next = [newSite, ...prev];
      }
      writeStorage(next);
      return next;
    });
  }, []);

  const removeSite = useCallback((id: string) => {
    setSites((prev) => {
      const next = prev.filter((s) => s.id !== id);
      writeStorage(next);
      return next;
    });
  }, []);

  return { sites, upsertSite, removeSite };
}
