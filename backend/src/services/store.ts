import { randomBytes, createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "fs";
import { join } from "path";
import type { DesignResult } from "../types";
import { contentId } from "../lib/id";

class FileMutex {
  private queue: Promise<void> = Promise.resolve();
  acquire(): Promise<() => void> {
    let release!: () => void;
    const prev = this.queue;
    this.queue = new Promise<void>((r) => { release = r; });
    return prev.then(() => release);
  }
}

const designLock = new FileMutex();
const keyLock = new FileMutex();
const feedbackLock = new FileMutex();

const DATA_DIR = process.env.BIOS_DATA_DIR ?? join(process.cwd(), "data");
const DESIGNS_FILE = join(DATA_DIR, "designs.json");
const KEYS_FILE = join(DATA_DIR, "apikeys.json");
const FEEDBACK_FILE = join(DATA_DIR, "feedback.json");

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
    const tmpFile = `${DESIGNS_FILE}.tmp`;
    if (existsSync(tmpFile)) {
      try {
        const recovered = JSON.parse(readFileSync(tmpFile, "utf8")) as DesignsDB;
        console.error("[CRITICAL] designs.json corrupt; recovered from .tmp");
        writeJsonAtomic(DESIGNS_FILE, recovered);
        return recovered;
      } catch { /* .tmp also corrupt */ }
    }
    try {
      renameSync(DESIGNS_FILE, `${DESIGNS_FILE}.corrupt-${Date.now()}`);
      console.error("[CRITICAL] designs.json corrupt; moved to .corrupt-*");
    } catch { /* best effort */ }
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

const MAX_DESIGNS = Number(process.env.BIOS_MAX_DESIGNS ?? 5000);

export async function saveDesign(
  result: DesignResult,
  createdAt: number,
  parentId: string | null = null
): Promise<StoredDesign> {
  const release = await designLock.acquire();
  try {
    const db = readDB();
    const id = contentId(result);
    if (Object.hasOwn(db, id)) return db[id];
    if (Object.keys(db).length >= MAX_DESIGNS) {
      throw Object.assign(new Error("Design registry full."), { status: 503 });
    }
    const design: StoredDesign = {
      id,
      title: titleFor(result),
      result,
      createdAt,
      parentId: parentId && Object.hasOwn(db, parentId) ? parentId : null,
      forkCount: 0,
    };
    db[id] = design;
    writeDB(db);
    return design;
  } finally {
    release();
  }
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
  if (!Object.hasOwn(db, id)) return null;
  return { ...db[id], forkCount: countForks(db, id) };
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
    try {
      renameSync(KEYS_FILE, `${KEYS_FILE}.corrupt-${Date.now()}`);
      console.error("[CRITICAL] apikeys.json corrupt; moved to .corrupt-*");
    } catch { /* best effort */ }
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

export async function createApiKey(label = "default"): Promise<{ key: string; record: ApiKeyRecord }> {
  const release = await keyLock.acquire();
  try {
    const existing = readKeys();
    if (Object.keys(existing).length >= MAX_KEYS) {
      throw Object.assign(new Error("API key limit reached."), { status: 503 });
    }
    const secret = randomBytes(24).toString("base64url");
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
  } finally {
    release();
  }
}

export function validateApiKey(rawKey: string): ApiKeyRecord | null {
  const db = readKeys();
  return db[sha256(rawKey)] ?? null;
}

// ---- In-product feedback (the learning instrument) ----
export interface FeedbackRecord {
  id: string;
  rating: "yes" | "not_quite" | "no";
  text: string;
  designId: string | null;
  createdAt: number;
}

const MAX_FEEDBACK = Number(process.env.BIOS_MAX_FEEDBACK ?? 10000);

export async function saveFeedback(
  rating: FeedbackRecord["rating"],
  text: string,
  designId: string | null,
  createdAt: number
): Promise<FeedbackRecord> {
  const release = await feedbackLock.acquire();
  try {
    ensure();
    let db: Record<string, FeedbackRecord> = {};
    try {
      if (existsSync(FEEDBACK_FILE))
        db = JSON.parse(readFileSync(FEEDBACK_FILE, "utf8")) as Record<
          string,
          FeedbackRecord
        >;
    } catch {
      db = {};
    }
    if (Object.keys(db).length >= MAX_FEEDBACK) {
      throw Object.assign(new Error("Feedback capacity reached."), { status: 503 });
    }
    const id = `fb_${randomBytes(6).toString("base64url")}`;
    const record: FeedbackRecord = {
      id,
      rating,
      text: text.slice(0, 1000),
      designId,
      createdAt,
    };
    db[id] = record;
    writeJsonAtomic(FEEDBACK_FILE, db);
    const safeId = (designId ?? "-").replace(/[\r\n\x00-\x1f]/g, "_");
    console.log(`[feedback] rating=${rating} design=${safeId}`);
    return record;
  } finally {
    release();
  }
}
