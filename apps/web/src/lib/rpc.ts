export const ODDSX_DEPLOYMENT_BLOCK = 54_065_221n;
const RECENT_EVENT_HISTORY_BLOCK_COUNT = 10_000n;
const EVENT_PAGE_BLOCK_COUNT = 10_000n;
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
    latestBlock >= RECENT_EVENT_HISTORY_BLOCK_COUNT - 1n
      ? latestBlock - (RECENT_EVENT_HISTORY_BLOCK_COUNT - 1n)
      : 0n;

  return recentWindowStart > ODDSX_DEPLOYMENT_BLOCK
    ? recentWindowStart
    : ODDSX_DEPLOYMENT_BLOCK;
}

export async function collectEventPages<T>(
  latestBlock: bigint,
  loadPage: (fromBlock: bigint, toBlock: bigint) => Promise<readonly T[]>,
  fromBlock = ODDSX_DEPLOYMENT_BLOCK,
) {
  if (latestBlock < fromBlock) return [] as T[];

  const events: T[] = [];
  let cursor = fromBlock;
  while (cursor <= latestBlock) {
    const pageEnd =
      cursor + EVENT_PAGE_BLOCK_COUNT - 1n < latestBlock
        ? cursor + EVENT_PAGE_BLOCK_COUNT - 1n
        : latestBlock;
    events.push(...(await loadPage(cursor, pageEnd)));
    cursor = pageEnd + 1n;
  }
  return events;
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
