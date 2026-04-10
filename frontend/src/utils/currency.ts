export const THB = "THB";

function toNumber(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export function formatTHB(value: unknown, digits = 2): string {
  return `${THB} ${toNumber(value).toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatTHBCompact(value: unknown): string {
  const n = toNumber(value);
  if (n >= 1_000_000) return `${THB} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${THB} ${(n / 1_000).toFixed(1)}K`;
  return `${THB} ${n.toLocaleString("th-TH")}`;
}

export function numberInputFormatter(value: string | number | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  const stringValue = String(value);
  const negative = stringValue.startsWith("-") ? "-" : "";
  const normalized = stringValue.replace(/-/g, "");
  const [integerPart, decimalPart] = normalized.split(".");
  const withComma = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimalPart !== undefined ? `${negative}${withComma}.${decimalPart}` : `${negative}${withComma}`;
}

export function numberInputParser(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value.replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
