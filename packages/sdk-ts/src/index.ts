// Official TypeScript SDK for BiOS, the protein-design API.
//
//   import { BiOS } from "@bios/sdk";
//   const bios = new BiOS({ apiKey: process.env.BIOS_API_KEY });
//   const design = await bios.designs.create({ intent: "an enzyme that..." });
//   for await (const ev of bios.designs.stream({ intent })) { ... }

export interface ParsedIntent {
  targetFunction: string;
  organism: string;
  constraints: string[];
  similarProteins: string[];
  keywords: string[];
}
export type ProteinOrigin = "proteinmpnn" | "scaffold";
export interface DesignCandidate {
  name: string;
  sequence: string;
  confidence: number | null;
  pdb: string | null;
  origin?: ProteinOrigin;
}
export interface DesignReference {
  id: string;
  title: string;
  organism: string;
  accession: string;
}
export type ResultKind = "protein" | "dna" | "crispr" | "decline";
export interface DesignResult {
  id?: string;
  intent: string;
  modality: string;
  kind: ResultKind;
  computed: "real" | "deterministic" | "reference-only";
  confidence: number | null;
  parsed: ParsedIntent;
  references: DesignReference[];
  explanation: string;
  candidates: DesignCandidate[];
  construct?: unknown;
  guides?: unknown[];
  target?: { name: string; lengthBp: number };
  declineReason?: string;
  alternative?: string;
}

export type StreamEvent =
  | { type: "route"; modality: string; confidence: number }
  | { type: "stages"; stages: { id: string; label: string }[] }
  | { type: "stage"; stage: string; status: "start" | "done" }
  | { type: "token"; text: string }
  | { type: "saved"; id: string; title: string }
  | { type: "result"; result: DesignResult }
  | { type: "done" }
  | { type: "error"; message: string };

export interface BiOSOptions {
  apiKey?: string;
  baseUrl?: string;
}

export class BiOSError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string
  ) {
    super(message);
    this.name = "BiOSError";
  }
}

export class BiOS {
  readonly designs: Designs;
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(opts: BiOSOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.BIOS_API_KEY;
    this.baseUrl = (opts.baseUrl ?? "http://localhost:3001").replace(/\/$/, "");
    this.designs = new Designs(this);
  }

  /** @internal */
  headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`;
    return h;
  }
  /** @internal */
  url(path: string): string {
    return `${this.baseUrl}/v1${path}`;
  }

  async fold(
    sequence: string
  ): Promise<{ pdb: string; confidence: number; folded: number }> {
    const res = await fetch(this.url("/fold"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ sequence }),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  async search(
    query: string
  ): Promise<{ query: string; results: DesignReference[] }> {
    const res = await fetch(this.url("/search"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }
}

class Designs {
  constructor(private client: BiOS) {}

  /** Design a biological artifact and wait for the full result. */
  async create(params: { intent: string; parentId?: string }): Promise<DesignResult> {
    const res = await fetch(this.client.url("/designs"), {
      method: "POST",
      headers: this.client.headers(),
      body: JSON.stringify(params),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Fetch a design by its permalink id. */
  async get(id: string): Promise<DesignResult> {
    const res = await fetch(this.client.url(`/designs/${id}`), {
      headers: this.client.headers(),
    });
    if (!res.ok) throw await toError(res);
    const body = await res.json();
    // The registry wraps the result with id/title/parent/forkCount; merge the
    // id back so callers keep the permalink alongside the design.
    return { id: body.id, ...(body.result ?? body) };
  }

  /** Stream the design pipeline as it runs (async iterator of events). */
  async *stream(params: {
    intent: string;
    parentId?: string;
  }): AsyncGenerator<StreamEvent> {
    const res = await fetch(this.client.url("/designs/stream"), {
      method: "POST",
      headers: this.client.headers(),
      body: JSON.stringify(params),
    });
    if (!res.ok || !res.body) throw await toError(res);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    const parse = (chunk: string): StreamEvent | null => {
      const line = chunk.trim();
      if (!line.startsWith("data:")) return null;
      try {
        return JSON.parse(line.slice(5).trim()) as StreamEvent;
      } catch {
        return null; // skip malformed frame
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const chunks = buf.split("\n\n");
      buf = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const ev = parse(chunk);
        if (ev) yield ev;
      }
    }
    // Flush any multi-byte tail + a final frame without a trailing blank line.
    buf += decoder.decode();
    if (buf.trim()) {
      const ev = parse(buf);
      if (ev) yield ev;
    }
  }
}

async function toError(res: Response): Promise<BiOSError> {
  const requestId = res.headers.get("BiOS-Request-Id") ?? undefined;
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    message = body?.error?.message ?? body?.error ?? message;
  } catch {
    // keep default
  }
  return new BiOSError(message, res.status, requestId);
}
