import "dotenv/config";
import express from "express";
import cors from "cors";
import { designRouter } from "./routes/design";
import { designStreamRouter } from "./routes/design-stream";
import { designsRouter } from "./routes/designs";
import { searchRouter } from "./routes/search";
import { foldRouter } from "./routes/fold";
import { keysRouter } from "./routes/keys";
import { metaRouter } from "./routes/meta";
import { requestId } from "./middleware/errors";
import { apiKeyAuth } from "./middleware/auth";
import { rateLimit } from "./middleware/rateLimit";

const app = express();
const PORT = process.env.PORT || 3001;

// Behind Render's proxy: trust one hop so req.ip is the real client (not the
// proxy), otherwise every anonymous user collapses into one shared bucket.
app.set("trust proxy", 1);

// CORS allowlist. Server-to-server / curl requests (no Origin) are allowed;
// browser requests must come from an allowed origin. API auth is via key, so
// this only limits cross-site browser abuse.
const ALLOWED = (process.env.BIOS_ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || ALLOWED.includes(origin)) return cb(null, true);
      cb(null, false);
    },
  })
);

// Cap request body size; protein structures are large but not unbounded.
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "bios-api" });
});

// Shared protected middleware: request id -> optional API-key auth -> rate
// limit. Applied to BOTH the public /v1 API and the legacy /api/* aliases so
// the paid upstreams (Claude / NIM) can never be hit unmetered.
const protect = [requestId, apiKeyAuth, rateLimit];

const v1 = express.Router();
v1.use(...protect);
v1.use("/", metaRouter); // /v1/openapi.json + /v1/llms.txt (agent self-integration)
v1.get("/health", (_req, res) =>
  res.json({ status: "ok", version: "v1", request_id: res.locals.requestId })
);
v1.use("/keys", keysRouter);
v1.use("/designs/stream", designStreamRouter);
v1.use("/designs", designsRouter);
v1.use("/designs", designRouter);
v1.use("/fold", foldRouter);
v1.use("/search", searchRouter);
app.use("/v1", v1);

// Legacy aliases (the current frontend uses these) -- same protection.
// Mount the specific /stream route BEFORE the /api/design prefix so protect
// and rateLimit run exactly once per stream call (mirrors the /v1 order).
app.use("/api/design/stream", protect, designStreamRouter);
app.use("/api/design", protect, designRouter);
app.use("/api/designs", protect, designsRouter);
app.use("/api/search", protect, searchRouter);
app.use("/api/fold", protect, foldRouter);

app.listen(PORT, () => {
  console.log(`BiOS API running on port ${PORT}`);
});
