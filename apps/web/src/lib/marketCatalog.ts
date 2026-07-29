import type { Hex } from "viem";

export interface CatalogMarket {
  label: string;
  id: Hex;
}

// keccak256(stringToHex("ETH_ABOVE_5000_Q4_2026")) — one of the seeded markets
// created by packages/scripts/src/seedMarkets.ts on the current deployment.
export const DEFAULT_MARKET: CatalogMarket = {
  label: "ETH_ABOVE_5000_Q4_2026",
  id: "0xa2ac8629241bcc942523f7fed05149ab9387badfbfb7678435603dfa3eee40b9" as Hex,
};

// Statically known seeded markets (id = keccak256(stringToHex(label))). Seeding
// the featured list with these lets every card render on the first paint — one
// batched multicall enriches them with on-chain state, and event discovery adds
// any user-created markets in the background.
export const FEATURED_MARKETS: readonly CatalogMarket[] = [
  DEFAULT_MARKET,
  {
    label: "ARC_MAINNET_LAUNCH_2026",
    id: "0xcd2ce970c334272a2a11de25beccf03826876ace4e6c21e7b09f8abadd723dd8" as Hex,
  },
  {
    label: "BTC_NEW_ATH_2026",
    id: "0x89c4a3ef89db68b75473134319bd4ef94ea2ead9b83f3c487e29969f70f06628" as Hex,
  },
  {
    label: "SOL_ETH_FLIP_2026",
    id: "0x85436921ab03964027fa49db9aff91e9946873fa44ff2ddb51c53c478ec97f2a" as Hex,
  },
] as const;

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
