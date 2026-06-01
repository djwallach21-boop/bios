// Deterministic, free, real bioinformatics. No external APIs, no models -- pure
// algorithms used by the nucleic-acid and CRISPR design modalities.

const COMPLEMENT: Record<string, string> = {
  A: "T", T: "A", G: "C", C: "G", N: "N",
  a: "t", t: "a", g: "c", c: "g", n: "n",
};

export function reverseComplement(dna: string): string {
  return dna
    .split("")
    .reverse()
    .map((b) => COMPLEMENT[b] ?? "N")
    .join("");
}

export function gcContent(seq: string): number {
  const s = seq.toUpperCase().replace(/[^ACGT]/g, "");
  if (!s.length) return 0;
  const gc = (s.match(/[GC]/g) ?? []).length;
  return gc / s.length;
}

// ---- Codon optimization (protein -> DNA) ----
// Highest-frequency ("optimal") codon per amino acid for common hosts. This is
// the standard max-frequency codon-optimization method.
export type Host = "ecoli" | "human" | "yeast";

const OPTIMAL_CODONS: Record<Host, Record<string, string>> = {
  ecoli: {
    A: "GCG", R: "CGT", N: "AAC", D: "GAT", C: "TGC", Q: "CAG", E: "GAA",
    G: "GGC", H: "CAT", I: "ATC", L: "CTG", K: "AAA", M: "ATG", F: "TTT",
    P: "CCG", S: "AGC", T: "ACC", W: "TGG", Y: "TAT", V: "GTG", "*": "TAA",
  },
  human: {
    A: "GCC", R: "CGC", N: "AAC", D: "GAC", C: "TGC", Q: "CAG", E: "GAG",
    G: "GGC", H: "CAC", I: "ATC", L: "CTG", K: "AAG", M: "ATG", F: "TTC",
    P: "CCC", S: "AGC", T: "ACC", W: "TGG", Y: "TAC", V: "GTG", "*": "TGA",
  },
  yeast: {
    A: "GCT", R: "AGA", N: "AAC", D: "GAC", C: "TGT", Q: "CAA", E: "GAA",
    G: "GGT", H: "CAC", I: "ATT", L: "TTG", K: "AAG", M: "ATG", F: "TTC",
    P: "CCA", S: "TCT", T: "ACT", W: "TGG", Y: "TAC", V: "GTT", "*": "TAA",
  },
};

export const HOST_LABELS: Record<Host, string> = {
  ecoli: "E. coli",
  human: "Human",
  yeast: "S. cerevisiae (yeast)",
};

export function codonOptimize(
  protein: string,
  host: Host
): { dna: string; gc: number } {
  const table = OPTIMAL_CODONS[host];
  const aas = protein.toUpperCase().replace(/[^A-Z*]/g, "");
  let dna = "";
  for (const aa of aas) {
    dna += table[aa] ?? "NNN";
  }
  if (!aas.endsWith("*")) dna += table["*"]; // append a stop codon
  return { dna, gc: gcContent(dna) };
}

// ---- CRISPR (SpCas9) guide RNA design ----
export interface Guide {
  sequence: string; // 20nt protospacer (5'->3')
  pam: string; // the NGG PAM
  strand: "+" | "-";
  start: number; // 0-based position of the protospacer start on the input
  gc: number;
  score: number; // simple heuristic 0-1, higher is better
}

// Scan both strands for 5'-[20nt]-NGG-3' SpCas9 sites and score them.
export function findCas9Guides(dnaInput: string, limit = 10): Guide[] {
  const dna = dnaInput.toUpperCase().replace(/[^ACGT]/g, "");
  const guides: Guide[] = [];

  const scan = (seq: string, strand: "+" | "-") => {
    for (let i = 0; i + 23 <= seq.length; i++) {
      const protospacer = seq.slice(i, i + 20);
      const pam = seq.slice(i + 21, i + 23); // positions 22-23 are GG (NGG)
      if (pam === "GG") {
        // Always report `start` in input-strand coordinates. On the minus
        // strand `i` indexes the reverse-complement, so map it back to the
        // input frame (leftmost 0-based base of the protospacer).
        const start = strand === "+" ? i : dna.length - (i + 20);
        guides.push(buildGuide(protospacer, seq.slice(i + 20, i + 23), strand, start));
      }
    }
  };

  scan(dna, "+");
  scan(reverseComplement(dna), "-");

  return guides.sort((a, b) => b.score - a.score).slice(0, limit);
}

function buildGuide(
  protospacer: string,
  pam: string,
  strand: "+" | "-",
  start: number
): Guide {
  const gc = gcContent(protospacer);
  // Composite on-target sequence heuristic for SpCas9 (NOT a trained model like
  // Doench Rule Set 2 -- a transparent, published-feature heuristic):
  //  - GC sweet spot ~40-60%; extreme GC folds/aggregates the guide.
  //  - poly-T (TTTT) prematurely terminates Pol III transcription.
  //  - long homopolymer runs reduce activity / specificity.
  //  - a G at the PAM-proximal seed position (20) is mildly favorable.
  let score = 1;
  score -= Math.abs(gc - 0.5) * 1.0; // center on 50% GC
  if (gc < 0.2 || gc > 0.8) score -= 0.2; // extreme GC
  if (/TTTT/.test(protospacer)) score -= 0.4; // Pol III terminator
  if (/(.)\1\1\1\1/.test(protospacer)) score -= 0.2; // 5+ homopolymer
  if (protospacer[19] === "G") score += 0.05; // PAM-proximal G (seed)
  return {
    sequence: protospacer,
    pam,
    strand,
    start,
    gc,
    score: Math.max(0, Math.min(1, score)),
  };
}

// ---- Primer Tm (Wallace rule for short oligos, Marmur-Doty for longer) ----
// NOTE: this is NOT a nearest-neighbor (SantaLucia) model; it is the simpler
// base-count approximation. Adequate for a rough estimate only.
export function meltingTemp(primer: string): number {
  const s = primer.toUpperCase().replace(/[^ACGT]/g, "");
  if (s.length < 14) {
    // Wallace rule for short oligos
    const at = (s.match(/[AT]/g) ?? []).length;
    const gc = (s.match(/[GC]/g) ?? []).length;
    return 2 * at + 4 * gc;
  }
  // Marmur-Doty for longer oligos
  const gc = gcContent(s);
  return 64.9 + 41 * (gc - 16.4 / s.length);
}
