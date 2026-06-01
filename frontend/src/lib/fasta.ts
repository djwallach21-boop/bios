// FASTA helpers. The viewer wraps sequences at 60 residues per line with a
// left position gutter, the way a real sequence viewer does.

export const FASTA_LINE_WIDTH = 60;

export function buildFasta(name: string, sequence: string): string {
  const header = `>${name} | BiOS design`;
  const wrapped = wrapSequence(sequence)
    .map((l) => l.residues)
    .join("\n");
  return `${header}\n${wrapped}\n`;
}

export interface FastaLine {
  position: number; // 1-based position of the first residue on this line
  residues: string;
}

export function wrapSequence(
  sequence: string,
  width = FASTA_LINE_WIDTH
): FastaLine[] {
  const clean = sequence.replace(/\s+/g, "");
  const lines: FastaLine[] = [];
  for (let i = 0; i < clean.length; i += width) {
    lines.push({ position: i + 1, residues: clean.slice(i, i + width) });
  }
  return lines;
}

export function residueCount(sequence: string): number {
  return sequence.replace(/\s+/g, "").length;
}

export function downloadFasta(name: string, sequence: string): void {
  const blob = new Blob([buildFasta(name, sequence)], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9_-]/gi, "_")}.fasta`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
