import { Router, Request, Response } from "express";

export const metaRouter = Router();

const BASE = process.env.BIOS_PUBLIC_URL ?? "http://localhost:3001";

// Machine-readable API description so any tool or AI agent can self-integrate.
const OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "BiOS API",
    version: "v1",
    description:
      "Design biology in plain language. One call returns a designed, scored biological artifact (protein redesign, codon-optimized DNA, or CRISPR guides).",
  },
  servers: [{ url: `${BASE}/v1` }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "bios_sk_live_..." },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/designs": {
      post: {
        summary: "Design a biological artifact from a plain-language intent.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["intent"],
                properties: {
                  intent: { type: "string", description: "What you want, in plain language." },
                  parentId: { type: "string", description: "Fork lineage: parent design id." },
                },
              },
            },
          },
        },
        responses: { "200": { description: "A design result (kind: protein | dna | crispr | decline)." } },
      },
      get: {
        summary: "Public gallery of designs.",
        parameters: [
          {
            name: "sort",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["recent", "forked", "top"], default: "recent" },
            description: "Ordering: most recent, most forked, or highest confidence.",
          },
        ],
        responses: { "200": { description: "Designs." } },
      },
    },
    "/designs/stream": {
      post: { summary: "Same as /designs but streamed over SSE (route, stages, tokens, result).", responses: { "200": { description: "text/event-stream" } } },
    },
    "/designs/{id}": {
      get: { summary: "Fetch a design by permalink id.", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Design." }, "404": { description: "Not found." } } },
    },
    "/fold": {
      post: { summary: "Fold a sequence (ESMFold): returns PDB + mean pLDDT.", responses: { "200": { description: "Structure." } } },
    },
    "/search": {
      post: { summary: "Search natural proteins (GenBank).", responses: { "200": { description: "Results." } } },
    },
    "/keys": {
      post: {
        summary: "Mint an API key (returned once). Anonymous: no bearer required.",
        security: [], // overrides the global bearerAuth; key minting is open
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  label: { type: "string", description: "Optional display label for the key." },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "The new key. Fields: key (plaintext, shown once), id, prefix, tier, message.",
          },
        },
      },
    },
  },
};

metaRouter.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(OPENAPI);
});

const LLMS_TXT = `# BiOS

Design biology in plain language. The API turns a natural-language intent into a
designed, structure-scored biological artifact.

Base: ${BASE}/v1
Auth: Authorization: Bearer bios_sk_live_...  (mint at POST /v1/keys; anonymous allowed at a low rate)
Spec: ${BASE}/v1/openapi.json

## Design something
POST /v1/designs   body: {"intent": "<plain language goal>"}
Returns {id, kind, candidates|construct|guides, explanation, references}.
- kind=protein: ProteinMPNN redesign on the closest natural scaffold, folded + scored by ESMFold (mean pLDDT). This is inverse-folding redesign, NOT de novo backbone generation.
- kind=dna: deterministic codon-optimized coding sequence for a host.
- kind=crispr: deterministic SpCas9 guide scan over a fetched gene.
- kind=decline: the request was refused (out of scope or safety-screened); nothing was designed.

## Stream
POST /v1/designs/stream  -> SSE events: route, stages, token, saved, result.

## Other
POST /v1/fold {"sequence"}   GET /v1/designs/{id}   GET /v1/designs (gallery)

## Honesty
Confidence is ESMFold mean pLDDT, a prediction, not a guarantee. Validate every
design experimentally. BiOS refuses requests that express intent to cause harm.
`;

metaRouter.get("/llms.txt", (_req: Request, res: Response) => {
  res.type("text/plain").send(LLMS_TXT);
});
