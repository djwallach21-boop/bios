<div align="center">

# BiOS

**Design biology in plain language.**

The open API and registry for biological design. Describe what you want a
protein, gene, or guide RNA to do; get back a designed, structure-scored,
permalinked artifact you can share, fork, and build on.

</div>

---

## What it is

BiOS is one chat box and one public API in front of a multi-modal design
pipeline. You write an intent in plain English; an intent router sends it to the
right modality and streams back a real result.

| Modality | What you get | How it is computed |
|----------|--------------|--------------------|
| **Protein** | A ProteinMPNN-redesigned sequence on the closest natural scaffold, folded and scored by ESMFold (mean pLDDT) | live models (NVIDIA NIM + ESM Atlas) |
| **DNA** | A codon-optimized coding sequence for a host (E. coli / yeast / human) | deterministic |
| **CRISPR** | SpCas9 guide RNAs for a target gene, scored by a transparent sequence heuristic | deterministic |
| **Decline** | An honest refusal when a request is out of scope or fails the safety screen | n/a |

Every design is immutable and content-addressed, gets a permalink at
`/d/<id>`, and can be forked (the parent/child lineage is recorded).

## Honest scope

BiOS does not pretend. It is inverse-folding redesign, NOT de novo backbone
generation. Confidence is ESMFold mean pLDDT, a prediction and not a guarantee.
Every surface says: validate all designs experimentally. Requests that express
intent to cause harm are screened and refused before any model runs. The engines
it actually uses are credited honestly: Claude, GenBank, NVIDIA NIM ProteinMPNN,
and ESM Atlas ESMFold.

## Quickstart

API (curl):
```bash
# mint a key (anonymous use is also allowed at a low rate)
curl -X POST http://localhost:3001/v1/keys -d '{"label":"my-app"}'

# design a protein
curl -X POST http://localhost:3001/v1/designs \
  -H "Authorization: Bearer $BIOS_API_KEY" \
  -d '{"intent":"an enzyme that breaks down PET plastic at room temperature"}'
```

SDK (TypeScript):
```ts
import { BiOS } from "@bios/sdk";

const bios = new BiOS({ apiKey: process.env.BIOS_API_KEY });
const design = await bios.designs.create({ intent: "a thermostable GFP variant" });
for await (const ev of bios.designs.stream({ intent: "knock out human PCSK9" })) {
  // ev: route | stages | token | saved | result
}
```

The API is self-describing for agents: `GET /v1/openapi.json` and
`GET /v1/llms.txt`.

## Run locally

```bash
# backend (Node/TS, port 3001)
cd backend && npm install && npm run dev
#   .env: ANTHROPIC_API_KEY, NVIDIA_NIM_API_KEY, NCBI_API_KEY (optional)

# frontend (Next.js, port 3000)
cd frontend && npm install && npm run dev
```

Run the tests: `cd backend && npm test`.

## Architecture

```
frontend (Next.js 16 + Tailwind + 3Dmol)  ->  backend /v1 (Express/TS)
                                                 router (Claude) picks a modality
                                                 protein: GenBank -> ProteinMPNN (NIM) -> ESMFold
                                                 dna: codon optimization (deterministic)
                                                 crispr: SpCas9 guide scan (deterministic)
                                                 registry (content-addressed, forkable)
                                                 API keys + per-principal rate limiting
                                                 biosafety screen
```

The chat UI is built on the same public `/v1` API anyone else uses.

## Deploying

See [`DEPLOY.md`](./DEPLOY.md). The API runs as an always-on container (Render),
the frontend on Vercel. It is NOT serverless-safe (the pipeline holds SSE
sockets and polls models for minutes).

## Roadmap (honest)

Shipped: multi-modal design, public API with keys and rate limiting, registry
with permalinks, forking, and a gallery, an SDK, a biosafety screen, and tests.
Not yet: deployment, real users, higher-accuracy folding (Boltz-2 /
AlphaFold-class), de novo backbones (RFdiffusion), and a proprietary wet-lab
feedback loop. The last one is the real moat and is not a software task.

## License

MIT. Validate all designs experimentally.
