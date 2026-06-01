import { searchProteins, searchNucleotide } from "./genbank";
import { codonOptimize, findCas9Guides, HOST_LABELS, type Host } from "./bio";
import type {
  ParsedIntent,
  DnaConstruct,
  CrisprGuide,
  DesignReference,
} from "../types";

// Detect a pasted sequence in the raw intent (protein or DNA).
function pastedProtein(intent: string): string | null {
  const m = intent.toUpperCase().match(/[ACDEFGHIKLMNPQRSTVWY]{25,}/);
  return m ? m[0] : null;
}
function pastedDna(intent: string): string | null {
  const m = intent.toUpperCase().match(/[ACGT]{40,}/);
  return m ? m[0] : null;
}

// Build a gene-focused nuccore query for CRISPR. Gene symbols are uppercase
// tokens (PCSK9, TP53, EGFR); method words like CRISPR/RNA/CAS9 are excluded.
const CRISPR_METHOD_WORDS = new Set([
  "CRISPR", "CAS9", "RNA", "RNAS", "DNA", "GRNA", "SGRNA", "PAM", "GUIDE",
]);
function crisprTargetQuery(intent: string, parsed: ParsedIntent): string {
  const org = /human|homo sapiens/i.test(intent) ? "Homo sapiens" : "";
  const symbols = (intent.match(/\b[A-Z][A-Z0-9]{1,7}\b/g) ?? []).filter(
    (s) => !CRISPR_METHOD_WORDS.has(s)
  );
  if (symbols.length) return [symbols[0], org].filter(Boolean).join(" ");
  // Fallback: keyword that looks like a gene/target term + organism.
  const kw = parsed.keywords.find(
    (k) => !CRISPR_METHOD_WORDS.has(k.toUpperCase()) && k.length > 2
  );
  return [kw ?? parsed.keywords.join(" "), org].filter(Boolean).join(" ");
}

function hostFromIntent(intent: string): Host {
  const s = intent.toLowerCase();
  // The host is the EXPRESSION organism. E. coli / yeast almost always appear
  // as the host when named, so they win over "human" (which usually names the
  // source protein, e.g. "human insulin for E. coli").
  if (/\b(e\.?\s?coli|coli|bl21|bacterial?)\b/.test(s)) return "ecoli";
  if (/\b(yeast|cerevisiae|pichia)\b/.test(s)) return "yeast";
  if (/\b(human|hek|cho|mammalian)\b.*\b(express|cell|host|in)\b/.test(s))
    return "human";
  if (/express.*human|in human/.test(s)) return "human";
  return "ecoli";
}

// ---- DNA: codon-optimize a protein into a coding sequence (deterministic) ----
export async function computeDna(
  intent: string,
  parsed: ParsedIntent
): Promise<{
  construct: DnaConstruct;
  references: DesignReference[];
} | null> {
  const host = hostFromIntent(intent);

  let protein = pastedProtein(intent);
  let proteinName = "input protein";
  let references: DesignReference[] = [];

  if (!protein) {
    const hits = await searchProteins(parsed.keywords);
    references = hits.slice(0, 5).map((r) => ({
      id: r.id,
      title: r.title,
      organism: r.organism,
      accession: r.accession,
    }));
    const top = hits.find((h) => h.sequence && h.sequence.length >= 20);
    if (!top) return null;
    protein = top.sequence;
    proteinName = top.title || "reference protein";
  }

  const { dna, gc } = codonOptimize(protein, host);
  const construct: DnaConstruct = {
    host: HOST_LABELS[host],
    proteinName,
    protein,
    dna,
    lengthBp: dna.length,
    gc,
  };
  return { construct, references };
}

// ---- CRISPR: enumerate SpCas9 guides for a target (deterministic) ----
export async function computeCrispr(
  intent: string,
  parsed: ParsedIntent
): Promise<{
  guides: CrisprGuide[];
  target: { name: string; lengthBp: number };
  references: DesignReference[];
} | null> {
  let dna = pastedDna(intent);
  let targetName = "pasted sequence";
  let references: DesignReference[] = [];

  if (!dna) {
    const term = crisprTargetQuery(intent, parsed);
    const hit = await searchNucleotide(term);
    if (!hit || !hit.sequence) return null;
    dna = hit.sequence;
    targetName = hit.title || "target gene";
    references = [
      {
        id: hit.id,
        title: hit.title,
        organism: hit.organism,
        accession: hit.accession,
      },
    ];
  }

  const guides = findCas9Guides(dna, 10);
  if (!guides.length) return null;
  return {
    guides,
    target: { name: targetName, lengthBp: dna.length },
    references,
  };
}

// Explanation prompts (streamed via streamText).
export function dnaExplanationPrompt(intent: string, c: DnaConstruct): string {
  return `You are a molecular biology assistant. A researcher asked: "${intent}".
We codon-optimized the protein "${c.proteinName}" (${c.protein.length} aa) into a ${c.lengthBp} bp coding sequence for ${c.host}, GC ${(c.gc * 100).toFixed(0)}%, using the maximum-frequency codon per residue.
Write 2 short, warm, plain-language paragraphs: what this gives them and how to use it (synthesis/cloning), and one honest caveat (this is the simple max-frequency method; CAI and restriction-site cleanup may matter). Flowing prose only, no markdown, under 110 words.`;
}

export function crisprExplanationPrompt(
  intent: string,
  targetName: string,
  count: number
): string {
  return `You are a CRISPR design assistant. A researcher asked: "${intent}".
We scanned the target "${targetName}" for SpCas9 sites (20nt protospacer + NGG PAM) on both strands and ranked ${count} candidate guides by a GC/homopolymer heuristic.
Write 2 short, warm, plain-language paragraphs: what these guides are and how to pick one, and an HONEST caveat (this is an in-target scan with a simple efficiency heuristic; genome-wide off-target analysis needs a tool like Cas-OFFinder, which we do not run). Flowing prose only, no markdown, under 110 words.`;
}
