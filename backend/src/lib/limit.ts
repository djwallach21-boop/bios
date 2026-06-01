// Process-wide concurrency cap on the paid design pipeline. Bounds how many
// design requests can hit the metered upstreams (Claude / NVIDIA NIM /
// ESMFold) at once, and rejects (rather than queueing forever) once a bounded
// waiting room is full -- defense against denial-of-wallet and SSE/socket
// exhaustion. Single-instance, in-memory; moves to a shared limiter when this
// goes multi-instance.

const MAX_INFLIGHT = Number(process.env.BIOS_MAX_INFLIGHT ?? 6);
const MAX_QUEUE = Number(process.env.BIOS_MAX_QUEUE ?? 24);

let active = 0;
const waiters: Array<() => void> = [];

export class OverloadError extends Error {
  status = 503;
  constructor() {
    super("Server at capacity. Please retry shortly.");
    this.name = "OverloadError";
  }
}

// Acquire a pipeline slot. Returns a release fn (idempotent). Throws
// OverloadError when both the in-flight slots and the waiting room are full.
export async function acquireSlot(): Promise<() => void> {
  if (active >= MAX_INFLIGHT && waiters.length >= MAX_QUEUE) {
    throw new OverloadError();
  }
  if (active >= MAX_INFLIGHT) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  active++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active--;
    const next = waiters.shift();
    if (next) next();
  };
}
