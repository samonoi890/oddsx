const ODDSX_DEPLOYMENT_BLOCK = 53_262_846n;
const EVENT_HISTORY_BLOCK_COUNT = 1_000n;
export const RPC_RATE_LIMIT_RETRY_MS = 30_000;

export const RPC_RATE_LIMIT_MESSAGE =
  "Live activity paused due to RPC rate limit. Retrying shortly...";

const RATE_LIMIT_MARKERS = [
  "429",
  "-32005",
  "rate limit",
  "request limit reached",
  "too many requests",
];

export function getRecentEventFromBlock(latestBlock: bigint) {
  const recentWindowStart =
    latestBlock >= EVENT_HISTORY_BLOCK_COUNT - 1n
      ? latestBlock - (EVENT_HISTORY_BLOCK_COUNT - 1n)
      : 0n;

  return recentWindowStart > ODDSX_DEPLOYMENT_BLOCK
    ? recentWindowStart
    : ODDSX_DEPLOYMENT_BLOCK;
}

function collectErrorDetails(error: unknown, depth = 0): string[] {
  if (depth > 6 || error === null || error === undefined) return [];
  if (typeof error === "string" || typeof error === "number") {
    return [String(error)];
  }
  if (error instanceof Error) {
    const record = error as Error & Record<string, unknown>;
    return [
      error.name,
      error.message,
      ...["shortMessage", "details", "code", "cause"].flatMap((key) =>
        collectErrorDetails(record[key], depth + 1),
      ),
    ];
  }
  if (typeof error !== "object") return [];

  const record = error as Record<string, unknown>;
  return [
    "name",
    "message",
    "shortMessage",
    "details",
    "code",
    "cause",
  ].flatMap((key) => collectErrorDetails(record[key], depth + 1));
}

export function isRpcRateLimitError(error: unknown) {
  const details = collectErrorDetails(error).join(" ").toLowerCase();
  return RATE_LIMIT_MARKERS.some((marker) => details.includes(marker));
}

export function getRpcErrorState(error: unknown, fallbackMessage: string) {
  const isRateLimited = isRpcRateLimitError(error);
  return {
    error: new Error(isRateLimited ? RPC_RATE_LIMIT_MESSAGE : fallbackMessage),
    isRateLimited,
  };
}
