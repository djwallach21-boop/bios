import { describe, it, expect } from "vitest";
import {
  reverseComplement,
  gcContent,
  codonOptimize,
  findCas9Guides,
  meltingTemp,
} from "../services/bio";
import { contentId } from "../lib/id";
import { screenText } from "../services/biosafety";
import type { DesignResult } from "../types";

describe("bio: reverseComplement", () => {
  it("complements and reverses", () => {
    expect(reverseComplement("ATGC")).toBe("GCAT");
    expect(reverseComplement("AAAA")).toBe("TTTT");
  });
  it("is an involution", () => {
    const s = "ATGCGTACCGGATTACA";
    expect(reverseComplement(reverseComplement(s))).toBe(s);
  });
});

describe("bio: gcContent", () => {
  it("computes GC fraction", () => {
    expect(gcContent("GGCC")).toBe(1);
    expect(gcContent("ATAT")).toBe(0);
    expect(gcContent("ATGC")).toBeCloseTo(0.5);
  });
});

describe("bio: codonOptimize", () => {
  it("back-translates to a valid CDS with a stop codon", () => {
    const { dna } = codonOptimize("MA", "ecoli");
    expect(dna.length % 3).toBe(0);
    expect(dna.startsWith("ATG")).toBe(true); // Met
    expect(["TAA", "TGA", "TAG"]).toContain(dna.slice(-3)); // stop appended
  });
  it("differs by host", () => {
    expect(codonOptimize("LLLL", "ecoli").dna).not.toBe(
      codonOptimize("LLLL", "yeast").dna
    );
  });
});

describe("bio: findCas9Guides", () => {
  it("finds NGG-PAM 20mers and never exceeds the limit", () => {
    const seq = "ATG" + "ACGT".repeat(20) + "AGG" + "TTTT".repeat(10);
    const guides = findCas9Guides(seq, 5);
    expect(guides.length).toBeLessThanOrEqual(5);
    for (const g of guides) {
      expect(g.sequence.length).toBe(20);
      expect(g.pam.endsWith("GG")).toBe(true);
      expect(g.score).toBeGreaterThanOrEqual(0);
      expect(g.score).toBeLessThanOrEqual(1);
    }
  });
  it("penalizes poly-T (Pol III terminator)", () => {
    const polyT = findCas9Guides("TTTTT" + "ACGTACGTACGTACG" + "AGG", 1);
    const clean = findCas9Guides("ACGCAGTCAGTCAGTCAGTC" + "AGG", 1);
    if (polyT.length && clean.length) {
      expect(clean[0].score).toBeGreaterThanOrEqual(polyT[0].score);
    }
  });
});

describe("bio: meltingTemp", () => {
  it("Wallace rule for short oligos", () => {
    expect(meltingTemp("ATGC")).toBe(2 * 2 + 4 * 2); // 2 AT, 2 GC
  });
});

function fakeResult(over: Partial<DesignResult>): DesignResult {
  return {
    intent: "x",
    modality: "protein",
    kind: "protein",
    computed: "real",
    confidence: null,
    parsed: { targetFunction: "", organism: "", constraints: [], similarProteins: [], keywords: [] },
    references: [],
    explanation: "",
    candidates: [],
    ...over,
  };
}

describe("contentId", () => {
  it("is deterministic", () => {
    const r = fakeResult({ candidates: [{ name: "a", sequence: "MKT", confidence: null, pdb: null }] });
    expect(contentId(r)).toBe(contentId(r));
  });
  it("differs across modalities with the same intent (no collision)", () => {
    const dna = fakeResult({ kind: "dna", modality: "dna", construct: { host: "E. coli", proteinName: "x", protein: "MA", dna: "ATGGCGTAA", lengthBp: 9, gc: 0.5 } });
    const crispr = fakeResult({ kind: "crispr", modality: "crispr", guides: [{ sequence: "ACGTACGTACGTACGTACGT", pam: "AGG", strand: "+", start: 0, gc: 0.5, score: 1 }] });
    expect(contentId(dna)).not.toBe(contentId(crispr));
  });
});

describe("biosafety: screenText", () => {
  it("allows legitimate research", () => {
    expect(screenText("design a diagnostic binder for a viral antigen").allowed).toBe(true);
    expect(screenText("codon-optimize human insulin for E. coli").allowed).toBe(true);
  });
  it("refuses explicit weaponization intent", () => {
    expect(screenText("weaponize a pathogen").allowed).toBe(false);
    expect(screenText("make it more lethal and evade vaccine").allowed).toBe(false);
  });
});
