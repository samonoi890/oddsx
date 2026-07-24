import type { Hex } from "viem";

export const DEFAULT_MARKET = {
  label: "ETH_ABOVE_5000",
  id: "0x930d9354f76a92946a5f55c30b630e702250e5a2bc1b30c0099edc93729ce5f5" as Hex,
} as const;

export const TEST_MARKET_TEMPLATES = [
  {
    label: "BTC_ABOVE_100000",
    description: "Will BTC trade above 100,000 USDC at market expiry?",
  },
  {
    label: "SOL_ABOVE_300",
    description: "Will SOL trade above 300 USDC at market expiry?",
  },
] as const;
