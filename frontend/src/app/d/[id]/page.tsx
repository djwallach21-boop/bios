import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultView } from "@/components/bios/result-view";
import { BiosMark } from "@/components/bios/bios-mark";
import type { DesignResult } from "@/lib/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

interface StoredDesign {
  id: string;
  title: string;
  result: DesignResult;
  createdAt: number;
  parentId: string | null;
  forkCount: number;
  parent: { id: string; title: string } | null;
}

async function fetchDesign(id: string): Promise<StoredDesign | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/designs/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const design = await fetchDesign(id);
  if (!design) return { title: "Design not found | BiOS" };

  const best = design.result.candidates.reduce<number | null>(
    (b, c) => (c.confidence != null && (b == null || c.confidence > b) ? c.confidence : b),
    null
  );
  const plddt = best != null ? ` · pLDDT ${Math.round(best * 100)}` : "";
  return {
    title: `${design.title} | BiOS`,
    description: `${design.result.candidates.length} candidate protein design${plddt}. Designed on BiOS, the open protein-design platform.`,
    openGraph: {
      title: `${design.title} | BiOS`,
      description: `Protein design${plddt} on BiOS.`,
      type: "article",
    },
  };
}

export default async function DesignPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const design = await fetchDesign(id);
  if (!design) notFound();

  return (
    <div className="min-h-[100dvh]">
      <header className="flex h-14 items-center justify-between border-b border-border px-5">
        <Link href="/" className="flex items-center gap-2">
          <BiosMark className="size-4 text-foreground" />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            BiOS
          </span>
        </Link>
        <Link
          href="/"
          className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Design your own
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[52rem] px-6 py-10">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <span>Shared design · {design.id}</span>
          {design.forkCount > 0 && (
            <span className="text-foreground/70">
              {design.forkCount} fork{design.forkCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-foreground">
          {design.title}
        </h1>
        {design.parent && (
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Forked from{" "}
            <Link
              href={`/d/${design.parent.id}`}
              className="text-foreground underline-offset-2 hover:underline"
            >
              {design.parent.title}
            </Link>
          </p>
        )}
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
          {design.result.explanation}
        </p>

        <div className="mt-5 flex items-center gap-3">
          <Link
            href={`/?intent=${encodeURIComponent(design.result.intent)}&parent=${design.id}`}
            className="press inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Fork &amp; iterate
          </Link>
          <Link
            href={`/?intent=${encodeURIComponent(design.result.intent)}`}
            className="press inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-[13px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
          >
            Open in chat
          </Link>
        </div>

        <div className="mt-6">
          <ResultView result={design.result} />
        </div>
        <p className="mt-6 font-mono text-[11px] text-muted-foreground/50">
          Powered by Claude · ProteinMPNN · ESMFold · GenBank. Validate all
          designs experimentally.
        </p>
      </main>
    </div>
  );
}
