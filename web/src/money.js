export const USD_PER_NEAR = 2;
export const YOCTO = 10n ** 24n;

export function yoctoToUsd(yocto) {
  const y = BigInt(yocto || "0");
  const rateMicros = BigInt(USD_PER_NEAR * 1_000_000);
  return Number((y * rateMicros) / YOCTO) / 1_000_000;
}

export function formatUsd(usd) {
  const n = typeof usd === "string" ? Number(usd) : usd;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatNear(yocto) {
  const y = BigInt(yocto || "0");
  const whole = y / YOCTO;
  const frac = y % YOCTO;
  if (frac === 0n) return `${whole} NEAR`;
  const fracStr = frac.toString().padStart(24, "0").replace(/0+$/, "").slice(0, 4);
  return `${whole}.${fracStr} NEAR`;
}
