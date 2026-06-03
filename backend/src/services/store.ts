import { randomBytes, createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "fs";
import { join } from "path";
import type { DesignResult } from "../types";
import { contentId } from "../lib/id";

// Server-side design registry. File-backed for now (zero deps, ships today)
// behind a narrow interface so it can be swapped for Supabase/Postgres without
// touching callers. Every completed design persists here and gets a permanent
// shareable id -> /d/<id>. This is the network-effect layer.
const DATA_DIR = join(process.cwd(), "data");
const DESIGNS_FILE = join(DATA_DIR, "designs.json");
const KEYS_FILE = join(DATA_DIR, "apikeys.json");

export interface StoredDesign {
  id: string;
  title: string;
  result: DesignResult;
  createdAt: number;
  parentId: string | null;
  forkCount: number;
}

interface DesignsDB {
  [id: string]: StoredDesign;
}

function ensure(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  if (!existsSync(DESIGNS_FILE)) writeFileSync(DESIGNS_FILE, "{}", { mode: 0o600 });
}

function readDB(): DesignsDB {
  ensure();
  try {
    return JSON.parse(readFileSync(DESIGNS_FILE, "utf8")) as DesignsDB;
  } catch {
    // The registry is corrupt/truncated. Returning {} here is fine for THIS
    // read, but the next saveDesign would write {} + the new record back,
    // silently destroying every recoverable design. Move the bad file aside
    // first so the next ensure() starts clean and the data stays recoverable.
    try {
      renameSync(DESIGNS_FILE, `${DESIGNS_FILE}.corrupt-${Date.now()}`);
      console.error(
        "designs.json was unparseable; moved aside to .corrupt-* and started a fresh registry."
      );
    } catch {
      /* best effort; fall through to an empty in-memory registry */
    }
    return {};
  }
}

// Write to a temp file then rename: rename is atomic, so a crash mid-write
// can never leave a half-written (and thus unparseable) registry behind.
function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = `${file}.tmp`;
  // 0o600: the registry + key hashes are owner-only, never world-readable.
  writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
  renameSync(tmp, file);
}

function writeDB(db: DesignsDB): void {
  ensure();
  writeJsonAtomic(DESIGNS_FILE, db);
}

function titleFor(result: DesignResult): string {
  const fn = result.parsed?.targetFunction?.trim();
  const base = fn && fn.length ? fn : result.intent;
  const clause = base.split(/[,;.]/)[0] ?? base;
  const t = clause.trim().replace(/\s+/g, " ");
  const capped = t.length > 60 ? `${t.slice(0, 60)}...` : t;
  return capped.charAt(0).toUpperCase() + capped.slice(1);
}

export function saveDesign(
  result: DesignResult,
  createdAt: number,
  parentId: string | null = null
): StoredDesign {
  const db = readDB();
  const id = contentId(result);
  // Immutable + content-addressed: identical designs dedup to one record.
  if (db[id]) return db[id];
  const design: StoredDesign = {
    id,
    title: titleFor(result),
    result,
    createdAt,
    parentId: parentId && db[parentId] ? parentId : null,
    forkCount: 0,
  };
  db[id] = design;
  writeDB(db);
  return design;
}

// forkCount is DERIVED from the stored parentId lineage edges, never a mutable
// counter. A caller can set parentId to any design, but each child is one real
// (rate-limited, content-addressed, deduplicated) design -- so the count
// reflects genuine forks and cannot be cheaply inflated against a victim.
function countForks(db: DesignsDB, id: string): number {
  let n = 0;
  for (const k in db) if (db[k].parentId === id) n++;
  return n;
}

export function getDesign(id: string): StoredDesign | null {
  const db = readDB();
  const d = db[id];
  if (!d) return null;
  return { ...d, forkCount: countForks(db, id) };
}

export type GallerySort = "recent" | "forked" | "top";

export interface GalleryItem {
  id: string;
  title: string;
  createdAt: number;
  bestConfidence: number | null;
  forkCount: number;
  organism: string | null;
}

export function listDesigns(sort: GallerySort = "recent", limit = 60): GalleryItem[] {
  const db = readDB();
  // Single pass: tally fork edges once (O(N)) instead of a full scan per row
  // (which made the gallery O(N^2) and could block the event loop at scale).
  const forkCounts = new Map<string, number>();
  for (const d of Object.values(db)) {
    if (d.parentId)
      forkCounts.set(d.parentId, (forkCounts.get(d.parentId) ?? 0) + 1);
  }
  const items: GalleryItem[] = Object.values(db).map((d) => ({
    id: d.id,
    title: d.title,
    createdAt: d.createdAt,
    forkCount: forkCounts.get(d.id) ?? 0,
    bestConfidence: d.result.candidates.reduce<number | null>(
      (best, c) =>
        c.confidence != null && (best == null || c.confidence > best)
          ? c.confidence
          : best,
      null
    ),
    organism: d.result.references[0]?.organism ?? null,
  }));

  const sorters: Record<GallerySort, (a: GalleryItem, b: GalleryItem) => number> = {
    recent: (a, b) => b.createdAt - a.createdAt,
    forked: (a, b) => b.forkCount - a.forkCount || b.createdAt - a.createdAt,
    top: (a, b) => (b.bestConfidence ?? 0) - (a.bestConfidence ?? 0),
  };
  return items.sort(sorters[sort] ?? sorters.recent).slice(0, limit);
}

// ---- API keys ----
// We store only sha256(key) + a display prefix; the plaintext key is shown
// once at creation and never persisted.
export interface ApiKeyRecord {
  id: string;
  hash: string;
  prefix: string;
  tier: "free" | "dev" | "scale";
  label: string;
  createdAt: number;
}

interface KeysDB {
  [hash: string]: ApiKeyRecord;
}

function readKeys(): KeysDB {
  if (!existsSync(KEYS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(KEYS_FILE, "utf8")) as KeysDB;
  } catch {
    return {};
  }
}

function writeKeys(db: KeysDB): void {
  ensure();
  writeJsonAtomic(KEYS_FILE, db);
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// Hard cap on stored keys so anonymous minting cannot grow apikeys.json without
// bound (disk-fill DoS on the file-backed registry).
const MAX_KEYS = Number(process.env.BIOS_MAX_KEYS ?? 10000);

export function createApiKey(label = "default"): { key: string; record: ApiKeyRecord } {
  const existing = readKeys();
  if (Object.keys(existing).length >= MAX_KEYS) {
    const err = new Error("API key limit reached.") as Error & { status?: number };
    err.status = 503;
    throw err;
  }
  const secret = randomBytes(24).toString("base64url"); // 32 url-safe chars
  const key = `bios_sk_live_${secret}`;
  const hash = sha256(key);
  const record: ApiKeyRecord = {
    id: `key_${randomBytes(6).toString("base64url")}`,
    hash,
    prefix: key.slice(0, 20),
    tier: "free",
    label,
    createdAt: Date.now(),
  };
  existing[hash] = record;
  writeKeys(existing);
  return { key, record };
}

export function validateApiKey(rawKey: string): ApiKeyRecord | null {
  const db = readKeys();
  return db[sha256(rawKey)] ?? null;
}
