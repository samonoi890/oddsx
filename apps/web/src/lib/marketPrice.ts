type SupportedMarketAsset = "BTC" | "ETH";

interface MarketPriceFeed {
  asset: SupportedMarketAsset;
  symbol: `${SupportedMarketAsset}USDC`;
  targetPrice: number | null;
  direction: "above" | "below" | null;
}

const ASSET_PATTERN = /(?:^|[^A-Z0-9])(BTC|ETH)(?=$|[^A-Z0-9])/;
const TARGET_PATTERN =
  /(ABOVE|BELOW|OVER|UNDER|GREATER[\s_]+THAN|LESS[\s_]+THAN|>=|<=|>|<)[^0-9]{0,16}(\d+(?:\.\d+)?)/;

export function getMarketPriceFeed(
  marketLabel: string,
  description: string,
): MarketPriceFeed | null {
  const marketText = `${marketLabel} ${description}`
    .toUpperCase()
    .replaceAll(",", "");
  const assetMatch = marketText.match(ASSET_PATTERN);
  if (!assetMatch?.[1]) return null;

  const asset = assetMatch[1] as SupportedMarketAsset;
  const targetMatch = marketText.match(TARGET_PATTERN);
  const parsedTarget = targetMatch?.[2] ? Number(targetMatch[2]) : null;
  const targetPrice =
    parsedTarget !== null && Number.isFinite(parsedTarget) && parsedTarget > 0
      ? parsedTarget
      : null;
  const comparison = targetMatch?.[1];
  const direction = comparison
    ? /^(ABOVE|OVER|GREATER|>|>=)/.test(comparison)
      ? "above"
      : "below"
    : null;

  return {
    asset,
    symbol: `${asset}USDC`,
    targetPrice,
    direction,
  };
}
