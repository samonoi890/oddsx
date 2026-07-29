"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { arcTestnet, getOddsXAddress, oddsXAbi } from "@oddsx/config";
import { useCallback } from "react";
import { type Address, type Hex } from "viem";
import { useReadContracts } from "wagmi";

const contractAddress = getOddsXAddress(arcTestnet.id);
const MARKET_REFETCH_INTERVAL_MS = 30_000;
const MARKET_STALE_TIME_MS = 15_000;

// Binary markets: the UI only ever displays outcomes 0 (YES) and 1 (NO).
const DISPLAYED_OUTCOMES = [0, 1] as const;

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

export function useMarket(marketId: Hex) {
  // Reconstruct the snapshot from `getMarket` + per-outcome `getOutcomePool`
  // instead of `getMarketWithPools`. Every deployed OddsX version exposes these
  // (older contracts lack `getMarketWithPools` and would revert via fallback,
  // which showed up as "No market found" even for markets that exist). The 16ms
  // multicall window batches all three reads into a single request.
  const query = useReadContracts({
    allowFailure: true,
    contracts: [
      {
        abi: oddsXAbi,
        address: contractAddress,
        functionName: "getMarket",
        args: [marketId],
        chainId: arcTestnet.id,
      },
      {
        abi: oddsXAbi,
        address: contractAddress,
        functionName: "getOutcomePool",
        args: [marketId, DISPLAYED_OUTCOMES[0]],
        chainId: arcTestnet.id,
      },
      {
        abi: oddsXAbi,
        address: contractAddress,
        functionName: "getOutcomePool",
        args: [marketId, DISPLAYED_OUTCOMES[1]],
        chainId: arcTestnet.id,
      },
    ],
    query: {
      // Serve cached data instantly on remount/navigation within the stale
      // window, and keep the previous snapshot visible during any refetch.
      staleTime: MARKET_STALE_TIME_MS,
      refetchInterval: MARKET_REFETCH_INTERVAL_MS,
      placeholderData: keepPreviousData,
    },
  });

  const { refetch: refetchQuery } = query;
  const refetch = useCallback(() => {
    void refetchQuery();
  }, [refetchQuery]);

  const marketResult = query.data?.[0];
  const market =
    marketResult?.status === "success"
      ? (marketResult.result as unknown as MarketView)
      : undefined;

  const outcomePools = market
    ? DISPLAYED_OUTCOMES.map((_, index) => {
        const result = query.data?.[index + 1];
        return result?.status === "success" ? (result.result as bigint) : 0n;
      })
    : [];

  return {
    market,
    outcomePools,
    isLoading: query.isLoading,
    // Only surface genuine transport/RPC errors. A non-existent market simply
    // yields `market === undefined`, which renders the friendly "No market
    // found" copy rather than a cryptic revert message.
    error: query.error ?? null,
    refetch,
  };
}
