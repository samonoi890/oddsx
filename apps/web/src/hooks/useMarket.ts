"use client";

import { arcTestnet, getOddsXAddress, oddsXAbi } from "@oddsx/config";
import { useCallback } from "react";
import { type Address, type Hex } from "viem";
import { useReadContract } from "wagmi";

const contractAddress = getOddsXAddress(arcTestnet.id);
const MARKET_REFETCH_INTERVAL_MS = 30_000;

export interface MarketView {
  asset: Address;
  endTime: bigint;
  outcomesCount: number;
  feeBps: number;
  state: number;
  oracle: Address;
  winningOutcome: number;
  description: string;
  totalPool: bigint;
  winningPool: bigint;
  distributablePool: bigint;
  protocolFee: bigint;
}

type MarketSnapshot = readonly [MarketView, readonly bigint[]];

export function useMarket(marketId: Hex) {
  const snapshotQuery = useReadContract({
    abi: oddsXAbi,
    address: contractAddress,
    functionName: "getMarketWithPools",
    args: [marketId],
    chainId: arcTestnet.id,
    query: {
      refetchInterval: MARKET_REFETCH_INTERVAL_MS,
    },
  });
  const snapshot = snapshotQuery.data as MarketSnapshot | undefined;
  const { refetch: refetchSnapshot } = snapshotQuery;
  const refetch = useCallback(() => {
    void refetchSnapshot();
  }, [refetchSnapshot]);

  // Note: pool/state changes are picked up by the periodic refetch above and by
  // the explicit refetch() call after each confirmed action. We intentionally
  // avoid per-market event watchers here — each one adds an independent RPC
  // polling filter, and three of them per mounted card was a major contributor
  // to the public Arc RPC returning 429s ("Arc offline").

  return {
    market: snapshot?.[0],
    outcomePools: snapshot ? [...snapshot[1]] : [],
    isLoading: snapshotQuery.isLoading,
    error: snapshotQuery.error,
    refetch,
  };
}
