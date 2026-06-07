import type { Metadata } from "next";
import Link from "next/link";
import { GitFork } from "lucide-react";
import { BiosMark } from "@/components/bios/bios-mark";

export const metadata: Metadata = {
  title: "Explore designs | BiOS",
  description:
    "The open gallery of protein designs on BiOS. Browse, fork, and build on what others have designed.",
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

interface GalleryItem {
  id: string;
  title: string;
  createdAt: number;
  bestConfidence: number | null;
  forkCount: number;
  organism: string | null;
}

const SORTS = [
  { key: "recent", label: "Recent" },
  { key: "top", label: "Top confidence" },
  { key: "forked", label: "Most forked" },
];

function confColor(c: number | null): string {
  if (c == null) return "var(--color-muted-foreground)";
  if (c >= 0.7) return "var(--color-confidence-high)";
  if (c >= 0.5) return "var(--color-confidence-mid)";
  return "var(--color-confidence-low)";
}

async function fetchGallery(sort: string): Promise<GalleryItem[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/designs?sort=${sort}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.designs ?? [];
  } catch {
    return [];
  }
}

export default async function ExplorePage(props: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: sortParam } = await props.searchParams;
  const sort = SORTS.some((s) => s.key === sortParam) ? sortParam! : "recent";
  const designs = await fetchGallery(sort);

  return (
    <div className="min-h-[100dvh]">
      <header className="flex h-14 items-center justify-between border-b border-border px-5">
        <Link href="/" className="flex items-center gap-2">
          <BiosMark className="size-4 text-foreground" />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            BiOS
          </span>
          <span className="font-mono text-[12px] text-muted-foreground">
            / explore
          </span>
        </Link>
        <Link
          href="/"
          className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Design your own
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[64rem] px-6 py-10">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-foreground">
          Explore designs
        </h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Every design on BiOS is public, permalinked, and forkable. Build on
          what others have made.
        </p>

        <div className="mt-6 flex gap-1">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={`/explore?sort=${s.key}`}
              className={`rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                s.key === sort
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>

        {designs.length === 0 ? (
          <div className="mt-24 flex flex-col items-center text-center">
            <BiosMark className="size-8 text-muted-foreground/25" />
            <p className="mt-5 text-[15px] text-foreground/85">
              No public designs yet.
            </p>
            <p className="mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-muted-foreground">
              Every design on BiOS is public the moment it&apos;s made. Be the
              first.
            </p>
            <Link
              href="/"
              className="press mt-6 inline-flex items-center rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Design a protein
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {designs.map((d) => (
              <Link
                key={d.id}
                href={`/d/${d.id}`}
                className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/25"
              >
                <p className="text-[14px] leading-snug text-foreground line-clamp-3">
                  {d.title}
                </p>
                <div className="mt-4 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: confColor(d.bestConfidence) }}
                    />
                    {d.bestConfidence != null
                      ? `pLDDT ${Math.round(d.bestConfidence * 100)}`
                      : "unfolded"}
                  </span>
                  {d.forkCount > 0 && (
                    <span className="flex items-center gap-1">
                      <GitFork className="size-3" />
                      {d.forkCount}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
