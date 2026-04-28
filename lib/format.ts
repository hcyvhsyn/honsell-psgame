export function fmtAzn(cents: number | null | undefined): string {
  const n = (cents ?? 0) / 100;
  return `${n.toFixed(2)} AZN`;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
