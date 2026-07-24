// apps/web/src/lib/format.ts
import type { Address } from "viem";

export function shortenAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatDateTime(timestamp: bigint): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(Number(timestamp) * 1000));
}

export function marketStateLabel(state: number): string {
  const labels = ["Unknown", "Open", "Resolved", "Cancelled"] as const;
  return labels[state] ?? "Unknown";
}

export function formatUsdc(value: bigint, maximumFractionDigits = 2): string {
  const whole = value / 10n ** 18n;
  const fraction = value % 10n ** 18n;
  const fractionText = fraction
    .toString()
    .padStart(18, "0")
    .slice(0, maximumFractionDigits);
  return maximumFractionDigits > 0
    ? `${whole.toLocaleString()}${fractionText ? `.${fractionText}` : ""}`
    : whole.toLocaleString();
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Closed";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}
