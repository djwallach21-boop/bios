import axios from "axios";

const BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const API_KEY = process.env.NCBI_API_KEY || "";

// Shared axios config: a hard timeout plus a response-size cap so a pathological
// upstream body (e.g. a whole-genome efetch) can't buffer unbounded into memory
// and OOM the 512MB free-tier instance.
const AXIOS_CFG = {
  timeout: 15000,
  maxContentLength: 25_000_000,
  maxBodyLength: 25_000_000,
} as const;

// efetch returns text/plain; guard against a non-string body (e.g. an error
// JSON) so the parser never throws a TypeError on `.split`.
function asText(data: unknown): string {
  return typeof data === "string" ? data : String(data ?? "");
}

interface GenBankResult {
  id: string;
  title: string;
  organism: string;
  sequence: string;
  accession: string;
}

export async function searchProteins(
  keywords: string[]
): Promise<GenBankResult[]> {
  try {
    const query = keywords.join(" OR ");

    // sort=relevance is essential: without it NCBI returns the broad OR-query's
    // matches in default (near-arbitrary, recency-ish) order, so a clean query
    // like "green fluorescent protein" yields unrelated records (ribonuclease,
    // MFS transporters). Relevance ranks true matches first -- the same sort the
    // CRISPR nucleotide search already uses. These hits feed the relatives list,
    // ProteinMPNN's reference sequences, AND the codon-opt target, so ranking
    // them correctly is load-bearing for every modality.
    const searchUrl = `${BASE_URL}/esearch.fcgi?db=protein&term=${encodeURIComponent(query)}&retmax=10&retmode=json&sort=relevance${API_KEY ? `&api_key=${API_KEY}` : ""}`;

    const searchResponse = await axios.get(searchUrl, AXIOS_CFG);
    const ids = searchResponse.data.esearchresult?.idlist || [];

    if (ids.length === 0) return [];

    const fetchUrl = `${BASE_URL}/efetch.fcgi?db=protein&id=${ids.join(",")}&rettype=fasta&retmode=text${API_KEY ? `&api_key=${API_KEY}` : ""}`;

    const fetchResponse = await axios.get(fetchUrl, AXIOS_CFG);

    return parseFasta(asText(fetchResponse.data), ids);
  } catch (e) {
    // NCBI is a soft dependency: on timeout / 5xx / oversize, degrade to "no
    // references" instead of 500-ing the whole design. The pipeline then
    // designs de novo from the target function rather than failing outright.
    console.error(
      "searchProteins failed:",
      e instanceof Error ? e.message : e
    );
    return [];
  }
}

// Fetch a curated gene/mRNA sequence for CRISPR targeting. Prefers RefSeq mRNA
// (avoids patent junk), falls back to a plain search. Caps length for speed.
export async function searchNucleotide(
  term: string,
  maxLen = 6000
): Promise<GenBankResult | null> {
  const refseqTerm = `(${term}) AND biomol_mrna[PROP] AND refseq[filter]`;
  let ids = await esearchNuccore(refseqTerm);
  if (ids.length === 0) ids = await esearchNuccore(term);
  if (ids.length === 0) return null;

  const fetchUrl = `${BASE_URL}/efetch.fcgi?db=nuccore&id=${ids[0]}&rettype=fasta&retmode=text${API_KEY ? `&api_key=${API_KEY}` : ""}`;
  const fetchResponse = await axios.get(fetchUrl, AXIOS_CFG);
  const parsed = parseFasta(asText(fetchResponse.data), ids);
  if (!parsed.length) return null;
  return { ...parsed[0], sequence: parsed[0].sequence.slice(0, maxLen) };
}

async function esearchNuccore(term: string): Promise<string[]> {
  const url = `${BASE_URL}/esearch.fcgi?db=nuccore&term=${encodeURIComponent(term)}&retmax=1&sort=relevance&retmode=json${API_KEY ? `&api_key=${API_KEY}` : ""}`;
  try {
    const res = await axios.get(url, AXIOS_CFG);
    return res.data.esearchresult?.idlist || [];
  } catch {
    return [];
  }
}

function parseFasta(fastaText: string, ids: string[]): GenBankResult[] {
  const entries = fastaText.split(">").filter((e) => e.trim());

  return entries.map((entry, i) => {
    const lines = entry.trim().split("\n");
    const header = lines[0] || "";
    const sequence = lines.slice(1).join("").trim();

    const titleMatch = header.match(/^(\S+)\s+(.*?)(?:\[(.+?)\])?$/);

    return {
      id: ids[i] || "",
      accession: titleMatch?.[1] || "",
      title: titleMatch?.[2]?.trim() || header,
      organism: titleMatch?.[3] || "Unknown",
      sequence,
    };
  });
}
