import type { ChatMessage } from "./types";

// Local-first persistence for design threads. Structures (pdb) are stripped
// before saving (too large for localStorage) and re-folded on demand.
const KEY = "bios.threads.v1";

export interface Thread {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export function loadThreads(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Thread[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveThreads(threads: Thread[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(threads.map(sanitize)));
  } catch {
    // Quota or serialization error: drop the oldest half and retry once.
    try {
      const trimmed = threads.slice(0, Math.ceil(threads.length / 2));
      localStorage.setItem(KEY, JSON.stringify(trimmed.map(sanitize)));
    } catch {
      // give up silently
    }
  }
}

// Persist only settled turns, and drop heavy PDB blobs.
function sanitize(t: Thread): Thread {
  const messages = t.messages
    .filter((m) => !(m.role === "assistant" && m.status === "streaming"))
    .map((m) =>
      m.role === "assistant" && m.status === "done" && m.result
        ? {
            ...m,
            result: {
              ...m.result,
              candidates: (m.result.candidates ?? []).map((c) => ({
                ...c,
                pdb: null,
              })),
            },
          }
        : m
    );
  return { ...t, messages };
}

export function titleFrom(intent: string): string {
  const t = intent.trim().replace(/\s+/g, " ");
  return t.length > 46 ? `${t.slice(0, 46)}...` : t;
}
