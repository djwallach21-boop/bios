import type { DesignResult, StageStatus } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

export interface StreamHandlers {
  onRoute?: (modality: string) => void;
  onStages?: (stages: { id: string; label: string }[]) => void;
  onStage: (id: string, status: StageStatus) => void;
  onToken: (text: string) => void;
  onResult: (result: DesignResult) => void;
  onSaved?: (id: string, title: string) => void;
  onError: (message: string) => void;
}

// Consumes the SSE design pipeline: real stage events + token-by-token prose +
// the final structured result. Pass a signal to allow Stop/abort.
export async function streamDesign(
  intent: string,
  h: StreamHandlers,
  signal?: AbortSignal,
  parentId?: string | null
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/design/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent, parentId: parentId ?? undefined }),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    h.onError("Could not reach the backend. Is it running on :3001?");
    return;
  }

  if (!res.ok || !res.body) {
    h.onError(`Stream failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (chunk: string) => {
    const line = chunk.trim();
    if (!line.startsWith("data:")) return;
    const json = line.slice(5).trim();
    if (!json) return;

    let evt: Record<string, unknown>;
    try {
      evt = JSON.parse(json);
    } catch {
      return;
    }

    if (evt.type === "route") {
      h.onRoute?.(evt.modality as string);
    } else if (evt.type === "stages") {
      h.onStages?.(evt.stages as { id: string; label: string }[]);
    } else if (evt.type === "stage") {
      h.onStage(evt.stage as string, evt.status === "done" ? "done" : "active");
    } else if (evt.type === "token") {
      h.onToken(evt.text as string);
    } else if (evt.type === "saved") {
      h.onSaved?.(evt.id as string, evt.title as string);
    } else if (evt.type === "result") {
      h.onResult(evt.result as DesignResult);
    } else if (evt.type === "error") {
      h.onError(evt.message as string);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) dispatch(chunk);
    }
    // Flush any multi-byte tail and process a final frame without a trailing
    // blank line.
    buffer += decoder.decode();
    if (buffer.trim()) dispatch(buffer);
  } catch (e) {
    // Aborted by the user (Stop): swallow; the caller handles UI state.
    if (e instanceof DOMException && e.name === "AbortError") return;
    h.onError("The stream was interrupted.");
  }
}

export interface FoldResponse {
  pdb: string;
  confidence: number;
  folded: number;
}

export async function foldSequence(sequence: string): Promise<FoldResponse> {
  const res = await fetch(`${API_BASE}/api/fold`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sequence }),
  });
  if (!res.ok) {
    let detail = `Fold failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body.details || body.error || detail;
    } catch {
      // use default
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function designProtein(intent: string): Promise<DesignResult> {
  const res = await fetch(`${API_BASE}/api/design`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent }),
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body.details || body.error || detail;
    } catch {
      // ignore parse errors, use default detail
    }
    throw new Error(detail);
  }

  return res.json();
}
