import { isRpcRateLimitError, RPC_RATE_LIMIT_MESSAGE } from "./rpc";

const TIMEOUT_MARKERS = ["timeout", "timed out", "aborted"];
const NETWORK_MARKERS = [
  "failed to fetch",
  "network error",
  "network request failed",
  "connection refused",
];
const REJECTION_MARKERS = [
  "user rejected",
  "user denied",
  "rejected the request",
];

function errorDetails(error: unknown): string[] {
  if (!error || typeof error !== "object") {
    return typeof error === "string" ? [error] : [];
  }
  const value = error as {
    shortMessage?: unknown;
    message?: unknown;
    details?: unknown;
  };
  return [value.shortMessage, value.message, value.details].filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

function conciseMessage(message: string) {
  return message.split("\n")[0]?.trim() ?? "";
}

export function getSafeErrorMessage(error: unknown, fallback: string) {
  if (isRpcRateLimitError(error)) return RPC_RATE_LIMIT_MESSAGE;

  const details = errorDetails(error);
  const searchable = details.join(" ").toLowerCase();
  if (REJECTION_MARKERS.some((marker) => searchable.includes(marker))) {
    return "Transaction rejected in the wallet.";
  }
  if (TIMEOUT_MARKERS.some((marker) => searchable.includes(marker))) {
    return "The Arc RPC request timed out. Please try again.";
  }
  if (NETWORK_MARKERS.some((marker) => searchable.includes(marker))) {
    return "Arc Testnet is temporarily unreachable. Please try again shortly.";
  }

  const shortMessage = conciseMessage(details[0] ?? "");
  if (
    shortMessage &&
    shortMessage.length <= 220 &&
    !shortMessage.startsWith("{") &&
    !/^(HTTP request failed|An unknown RPC error occurred)/i.test(shortMessage)
  ) {
    return shortMessage;
  }
  return fallback;
}
