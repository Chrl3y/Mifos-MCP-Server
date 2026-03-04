/** Format a UGX (or any) number with comma separators */
export function fmt(n: number): string {
  return n.toLocaleString("en-UG", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Build a plain-text table from rows: [col1, col2, ...] */
export function textTable(headers: string[], rows: string[][], colWidths?: number[]): string {
  const widths = headers.map((h, i) => {
    const maxRow = rows.reduce((m, r) => Math.max(m, (r[i] ?? "").length), 0);
    return Math.max(h.length, maxRow, colWidths?.[i] ?? 0);
  });
  const line = widths.map(w => "─".repeat(w + 2)).join("┼");
  const row = (cells: string[]) =>
    cells.map((c, i) => " " + c.padEnd(widths[i]) + " ").join("│");
  return [
    "┌" + widths.map(w => "─".repeat(w + 2)).join("┬") + "┐",
    "│" + row(headers) + "│",
    "├" + line + "┤",
    ...rows.map(r => "│" + row(r) + "│"),
    "└" + widths.map(w => "─".repeat(w + 2)).join("┴") + "┘",
  ].join("\n");
}

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function dateFromArray(arr: number[]): string {
  if (!arr || arr.length < 3) return "?";
  return `${arr[0]}-${String(arr[1]).padStart(2, "0")}-${String(arr[2]).padStart(2, "0")}`;
}

export function daysBetween(from: string, to: string = todayStr()): number {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
}
