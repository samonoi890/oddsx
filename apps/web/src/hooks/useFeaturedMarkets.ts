"use client";

import { arcTestnet, getOddsXAddress, oddsXAbi } from "@oddsx/config";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Hex } from "viem";
import { usePublicClient, useReadContracts } from "wagmi";
import type { MarketView } from "./useMarket";
import { DEFAULT_MARKET } from "@/lib/marketCatalog";
import {
  getRecentEventFromBlock,
  getRpcErrorState,
  RPC_RATE_LIMIT_RETRY_MS,
} from "@/lib/rpc";

const contractAddress = getOddsXAddress(arcTestnet.id);

export interface FeaturedMarket {
  id: Hex;
  label: string;
  market: MarketView;
}

interface MarketReference {
  id: Hex;
  label: string;
}

function fallbackLabel(marketId: Hex) {
  return `${marketId.slice(0, 10)}…${marketId.slice(-6)}`;
}

function mergeReferences(
  current: MarketReference[],
  incoming: MarketReference[],
) {
  const byId = new Map(current.map((market) => [market.id, market]));
  incoming.forEach((market) => {
    const existing = byId.get(market.id);
    byId.set(market.id, {
      id: market.id,
      label:
        existing && existing.label !== fallbackLabel(existing.id)
          ? existing.label
          : market.label,
    });
  });
  return [...byId.values()].slice(0, 12);
}

export function useFeaturedMarkets() {
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const [references, setReferences] = useState<MarketReference[]>([
    DEFAULT_MARKET,
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const addMarket = useCallback((id: Hex, label: string) => {
    setReferences((current) =>
      mergeReferences(current, [
        { id, label: label.trim() || fallbackLabel(id) },
      ]),
    );
  }, []);

  const loadCatalog = useCallback(async () => {
    if (!publicClient) return;
    setIsLoading(true);
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const logs = await publicClient.getContractEvents({
        address: contractAddress,
        abi: oddsXAbi,
        eventName: "MarketCreated",
        fromBlock: getRecentEventFromBlock(latestBlock),
        toBlock: latestBlock,
        strict: true,
      });
      setReferences((current) =>
        mergeReferences(
          current,
          logs.flatMap((log) =>
            log.args.marketId
              ? [
                  {
                    id: log.args.marketId,
                    label: fallbackLabel(log.args.marketId),
                  },
                ]
              : [],
          ),
        ),
      );
      setError(null);
    } catch (caught) {
      const rpcError = getRpcErrorState(
        caught,
        "Featured markets are temporarily unavailable. Try again shortly.",
      );
      setError(rpcError.error);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const validationContracts = useMemo(
    () =>
      references.map((reference) => ({
        address: contractAddress,
        abi: oddsXAbi,
        functionName: "getMarket" as const,
        args: [reference.id] as const,
        chainId: arcTestnet.id,
      })),
    [references],
  );
  const validation = useReadContracts({
    contracts: validationContracts,
    query: { enabled: validationContracts.length > 0 },
  });
  const markets = useMemo(
    () =>
      (validation.data ?? []).flatMap((result, index) => {
        const reference = references[index];
        return result.status === "success" && reference
          ? [
              {
                ...reference,
                market: result.result as MarketView,
              },
            ]
          : [];
      }),
    [references, validation.data],
  );

  useEffect(() => {
    if (!error) return;
    const retryTimer = window.setInterval(() => {
      void loadCatalog();
    }, RPC_RATE_LIMIT_RETRY_MS);
    return () => window.clearInterval(retryTimer);
  }, [error, loadCatalog]);

  return {
    markets,
    isLoading: isLoading || validation.isLoading,
    error: error ?? validation.error,
    addMarket,
  };
}
