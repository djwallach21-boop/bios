"use client";

import { useEffect, useRef } from "react";

// Renders an ESMFold PDB structure with 3Dmol.js, colored by per-residue pLDDT
// using our confidence tiers (low = red, mid = amber, confident = green), so a
// well-folded design literally glows green.
export function StructureViewer({ pdb }: { pdb: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let viewer: { clear?: () => void } | null = null;
    let cancelled = false;

    (async () => {
      const mod = await import("3dmol/build/3Dmol.js");
      const $3Dmol = (mod as { default?: unknown }).default ?? mod;
      if (cancelled || !ref.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lib = $3Dmol as any;
      viewer = lib.createViewer(ref.current, { backgroundColor: "#000000" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = viewer as any;
      v.addModel(pdb, "pdb");
      v.setStyle(
        {},
        {
          cartoon: {
            colorscheme: {
              prop: "b",
              gradient: "linear",
              min: 0,
              max: 1,
              colors: ["#E5484D", "#E5A000", "#3DD68C"],
            },
          },
        }
      );
      v.zoomTo();
      v.render();
      v.zoom(1.15, 600);
    })();

    return () => {
      cancelled = true;
      try {
        const v = viewer as { stopAnimate?: () => void; clear?: () => void } | null;
        v?.stopAnimate?.(); // stop the render loop so it cannot leak/repaint
        v?.clear?.();
      } catch {
        // ignore teardown errors
      }
    };
  }, [pdb]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Predicted 3D structure colored by per-residue pLDDT confidence"
      className="relative h-full w-full"
    />
  );
}
