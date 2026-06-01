import type { Metadata } from "next";
import Link from "next/link";
import { BiosMark } from "@/components/bios/bios-mark";

export const metadata: Metadata = {
  title: "Developers | BiOS",
  description:
    "The open protein-design API. One call returns a sequence (a ProteinMPNN redesign of the closest natural scaffold when enabled, otherwise that scaffold), folded and scored by ESMFold. Build biology into any app or agent.",
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-recess p-4 font-mono text-[13px] leading-[1.6] text-foreground/90">
      {children}
    </pre>
  );
}

function Section({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-8">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export default function DevelopersPage() {
  return (
    <div className="min-h-[100dvh]">
      <header className="flex h-14 items-center justify-between border-b border-border px-5">
        <Link href="/" className="flex items-center gap-2">
          <BiosMark className="size-4 text-foreground" />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            BiOS
          </span>
          <span className="font-mono text-[12px] text-muted-foreground">
            / developers
          </span>
        </Link>
        <Link
          href="/"
          className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Open app
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[52rem] px-6 py-12">
        <h1 className="text-[32px] font-semibold tracking-[-0.02em] text-foreground">
          The protein design API
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          One call turns a plain-language goal into a sequence &mdash; a
          ProteinMPNN redesign of the closest natural scaffold when enabled,
          otherwise that scaffold returned as a labeled reference &mdash; folded
          and scored by ESMFold. No biology code, no models to host. Build
          biology into any app or AI agent.
        </p>

        <Section label="1. Get a key" title="Mint an API key">
          <Code>{`curl -X POST ${API_BASE}/v1/keys \\
  -H "Content-Type: application/json" \\
  -d '{"label":"my-app"}'

# => { "key": "bios_sk_live_...", "tier": "free" }`}</Code>
        </Section>

        <Section label="2. Design" title="Design a protein">
          <Code>{`curl -X POST ${API_BASE}/v1/designs \\
  -H "Authorization: Bearer $BIOS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"intent":"an enzyme that breaks down PET plastic at room temperature"}'

# => {
#   "id": "d_...",                       permalink: /d/<id>
#   "candidates": [{ "name", "sequence", "confidence", "pdb" }],
#   "references": [{ "accession", "organism", "title" }],
#   "explanation": "..."
# }`}</Code>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            The pipeline: parse intent (Claude) &rarr; find the closest natural
            scaffold (GenBank) &rarr; redesign the sequence on that backbone
            (ProteinMPNN, when enabled; otherwise the scaffold is returned as a
            labeled reference) &rarr; predict + score the structure (ESMFold,
            mean pLDDT). This is inverse-folding redesign, not de novo backbone
            generation. Every design is saved to an immutable permalink at{" "}
            <span className="font-mono text-foreground">/d/&lt;id&gt;</span>.
          </p>
        </Section>

        <Section label="3. Stream" title="Stream the pipeline (SSE)">
          <Code>{`curl -N -X POST ${API_BASE}/v1/designs/stream \\
  -H "Authorization: Bearer $BIOS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"intent":"a thermostable variant of green fluorescent protein"}'

# Server-Sent Events:
#   data: {"type":"stage","stage":"design","status":"start"}
#   data: {"type":"token","text":"We set out to ..."}
#   data: {"type":"saved","id":"d_...","title":"..."}
#   data: {"type":"result","result":{...}}
#   data: {"type":"done"}`}</Code>
        </Section>

        <Section label="Reference" title="Endpoints">
          <Code>{`POST   /v1/designs              design a protein (json)
POST   /v1/designs/stream       design with live SSE
GET    /v1/designs/:id          fetch a design by permalink
GET    /v1/designs              public gallery (recent)
POST   /v1/fold                 fold a sequence -> structure + pLDDT
POST   /v1/search               search natural proteins (GenBank)
POST   /v1/keys                 mint an API key
GET    /v1/health               status`}</Code>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Auth is{" "}
            <span className="font-mono text-foreground">
              Authorization: Bearer bios_sk_live_...
            </span>
            . Anonymous requests work at a reduced rate so you can try it in 60
            seconds. Every response carries a{" "}
            <span className="font-mono text-foreground">BiOS-Request-Id</span>;
            errors use a stable envelope. Validate all designs experimentally.
          </p>
        </Section>
      </main>
    </div>
  );
}
