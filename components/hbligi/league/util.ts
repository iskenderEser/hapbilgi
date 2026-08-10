// components/hbligi/league/util.ts

/** Ad soyadın baş harfleri (avatar fallback). */
export function harfler(ad: string): string {
  return ad
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase("tr-TR") ?? "")
    .join("");
}

/** Sıra rengi — altın / gümüş / bronz / nötr. */
export function siraRenk(rank: number): string {
  if (rank === 1) return "#f59e0b";
  if (rank === 2) return "#9ca3af";
  if (rank === 3) return "#b45309";
  return "#e5e7eb";
}
