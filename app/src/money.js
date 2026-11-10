/** Fixed demo FX rate. Not a live price. Label this everywhere in the UI. */
export const USD_PER_NEAR = 2;
export const RATE_LABEL = "Fixed demo rate (not a live price): $2.00 per NEAR";
export const YOCTO = 10n ** 24n;

export function usdToYocto(usd) {
  const n = Number(usd);
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid USD amount");
  // yocto = usd / rate * 10^24, using integer micros to avoid float drift.
  const micros = BigInt(Math.round(n * 1_000_000));
  const rateMicros = BigInt(USD_PER_NEAR * 1_000_000);
  return ((micros * YOCTO) / rateMicros).toString();
}

export function yoctoToUsd(yocto) {
  const y = BigInt(yocto || "0");
  const rateMicros = BigInt(USD_PER_NEAR * 1_000_000);
  const usdMicros = (y * rateMicros) / YOCTO;
  return Number(usdMicros) / 1_000_000;
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
  const fracStr = frac.toString().padStart(24, "0").replace(/0+$/, "");
  return `${whole}.${fracStr} NEAR`;
}

export function yoctoToNearNumber(yocto) {
  const y = BigInt(yocto || "0");
  return Number(y) / Number(YOCTO);
}
