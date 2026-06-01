import axios from "axios";

// ESMFold via the free ESM Atlas public API. Folds a sequence into a real PDB
// structure with per-residue pLDDT in the B-factor column (0-1 scale here).
const ESMFOLD_URL = "https://api.esmatlas.com/foldSequence/v1/pdb/";
const MAX_RESIDUES = 400; // public endpoint caps around here

export interface FoldResult {
  pdb: string;
  meanPlddt: number; // 0-1
  folded: number; // residues actually folded
}

export async function foldSequence(
  sequence: string
): Promise<FoldResult | null> {
  const clean = sequence.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (clean.length < 10) return null;

  // The public endpoint cannot fold very long sequences; fold the N-terminal
  // window so we still return a real (partial) structure rather than nothing.
  const seq = clean.slice(0, MAX_RESIDUES);

  try {
    const res = await axios.post(ESMFOLD_URL, seq, {
      headers: { "Content-Type": "text/plain" },
      responseType: "text",
      timeout: 120000,
    });
    const pdb = res.data as string;
    if (typeof pdb !== "string" || !pdb.includes("ATOM")) return null;
    return { pdb, meanPlddt: meanCaPlddt(pdb), folded: seq.length };
  } catch {
    return null;
  }
}

// Mean pLDDT across CA atoms, read from the PDB B-factor column (cols 61-66).
function meanCaPlddt(pdb: string): number {
  const values: number[] = [];
  for (const line of pdb.split("\n")) {
    if (line.startsWith("ATOM") && line.substring(12, 16).trim() === "CA") {
      const b = parseFloat(line.substring(60, 66));
      if (!Number.isNaN(b)) values.push(b);
    }
  }
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
