// apps/web/src/hooks/useMarket.ts
"use client";

import { arcTestnet, getOddsXAddress, oddsXAbi } from "@oddsx/config";
import { useCallback, useMemo } from "react";
import { type Address, type Hex } from "viem";
import { useReadContract, useReadContracts } from "wagmi";

const contractAddress = getOddsXAddress(arcTestnet.id);

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
  const marketQuery = useReadContract({
    abi: oddsXAbi,
    address: contractAddress,
    functionName: "getMarket",
    args: [marketId],
    chainId: arcTestnet.id,
  });

  const market = marketQuery.data as MarketView | undefined;
  const outcomesCount = market ? Number(market.outcomesCount) : 0;

  const poolContracts = useMemo(
    () =>
      contractAddress
        ? Array.from({ length: outcomesCount }, (_, outcome) => ({
            abi: oddsXAbi,
            address: contractAddress,
            functionName: "getOutcomePool" as const,
            args: [marketId, outcome] as const,
            chainId: arcTestnet.id,
          }))
        : [],
    [marketId, outcomesCount],
  );

  const poolsQuery = useReadContracts({
    contracts: poolContracts,
    query: {
      enabled: poolContracts.length > 0,
    },
  });
  const { refetch: refetchMarket } = marketQuery;
  const { refetch: refetchPools } = poolsQuery;

  const outcomePools = useMemo(
    () =>
      (poolsQuery.data ?? []).map((result) =>
        result.status === "success" ? (result.result as bigint) : 0n,
      ),
    [poolsQuery.data],
  );

  const refetch = useCallback(() => {
    void refetchMarket();
    void refetchPools();
  }, [refetchMarket, refetchPools]);

  return {
    market,
    outcomePools,
    isLoading: marketQuery.isLoading || poolsQuery.isLoading,
    error: marketQuery.error ?? poolsQuery.error,
    refetch,
  };
}
