// packages/config/src/chains.ts
import { defineChain } from "viem";

const DEFAULT_ARC_TESTNET_RPC_URL = "https://rpc.testnet.arc.network";

export const ARC_TESTNET_RPC_URL =
  process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL?.trim() ||
  DEFAULT_ARC_TESTNET_RPC_URL;

export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [ARC_TESTNET_RPC_URL],
      webSocket: ["wss://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

export const supportedChains = [arcTestnet] as const;
