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
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive: drop anything that isn't a well-formed Thread so a schema-
    // drifted or partially-written record can't crash the transcript on render.
    return parsed.filter(
      (t): t is Thread =>
        t &&
        typeof t.id === "string" &&
        typeof t.title === "string" &&
        Array.isArray(t.messages)
    );
  } catch {
    return [];
  }
}

export function saveThreads(threads: Thread[]): void {
  if (typeof window === "undefined") return;
  // Drop threads that hold no completed turn (e.g. a design that only ever
  // failed) so a transient error never lingers in the sidebar after a reload.
  const persistable = threads.map(sanitize).filter((t) => t.messages.length > 0);
  try {
    localStorage.setItem(KEY, JSON.stringify(persistable));
  } catch {
    // Quota or serialization error: drop the oldest half and retry once.
    try {
      const trimmed = persistable.slice(0, Math.ceil(persistable.length / 2));
      localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
      // give up silently
    }
  }
}

// Persist only SETTLED, SUCCESSFUL turns. A turn is a user message plus the
// assistant "done" result that answered it; streaming, errored, and orphaned
// user turns are dropped so a transient pipeline failure never persists as a
// dead "design failed" card. Heavy PDB blobs are stripped (refolded on demand).
function sanitize(t: Thread): Thread {
  const messages: ChatMessage[] = [];
  t.messages.forEach((m, i) => {
    if (m.role === "assistant" && m.status === "done" && m.result) {
      messages.push({
        ...m,
        result: {
          ...m.result,
          candidates: (m.result.candidates ?? []).map((c) => ({
            ...c,
            pdb: null,
          })),
        },
      });
    } else if (m.role === "user") {
      // Keep a user turn only if the next message is its completed answer.
      const next = t.messages[i + 1];
      if (next && next.role === "assistant" && next.status === "done") {
        messages.push(m);
      }
    }
    // else: drop streaming/error assistants and orphaned user turns
  });
  return { ...t, messages };
}

export function titleFrom(intent: string): string {
  const t = intent.trim().replace(/\s+/g, " ");
  return t.length > 46 ? `${t.slice(0, 46)}...` : t;
}
