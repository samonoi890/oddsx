import type { Hex } from "viem";

// keccak256(stringToHex("ETH_ABOVE_5000_Q4_2026")) — one of the seeded markets
// created by packages/scripts/src/seedMarkets.ts on the current deployment.
export const DEFAULT_MARKET = {
  label: "ETH_ABOVE_5000_Q4_2026",
  id: "0xa2ac8629241bcc942523f7fed05149ab9387badfbfb7678435603dfa3eee40b9" as Hex,
} as const;

export const TEST_MARKET_TEMPLATES = [
  {
    label: "BTC_NEW_ATH_2026",
    description:
      "Will Bitcoin reach a new All-Time High above $120,000 in 2026?",
  },
  {
    label: "SOL_ETH_FLIP_2026",
    description: "Will Solana market cap flip Ethereum at any point in 2026?",
  },
] as const;
