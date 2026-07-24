// apps/web/src/hooks/usePortfolio.ts
"use client";

import { arcTestnet, getOddsXAddress, oddsXAbi } from "@oddsx/config";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Hex } from "viem";
import { zeroAddress } from "viem";
import { useAccount, usePublicClient, useReadContracts } from "wagmi";
import type { ProtocolBet } from "./useProtocolActivity";
import {
  getRecentEventFromBlock,
  getRpcErrorState,
  RPC_RATE_LIMIT_RETRY_MS,
} from "@/lib/rpc";

interface RewardRecord {
  marketId: Hex;
  reward: bigint;
}

const contractAddress = getOddsXAddress(arcTestnet.id);

export function usePortfolio(marketId: Hex, bets: ProtocolBet[]) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const [rewards, setRewards] = useState<RewardRecord[]>([]);
  const [resolvedMarketIds, setResolvedMarketIds] = useState<Set<Hex>>(
    new Set(),
  );
  const [cancelledMarketIds, setCancelledMarketIds] = useState<Set<Hex>>(
    new Set(),
  );
  const [historyError, setHistoryError] = useState<Error | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const account = address ?? zeroAddress;
  const selectedPosition = useReadContracts({
    contracts: [
      {
        address: contractAddress,
        abi: oddsXAbi,
        functionName: "getUserStake",
        args: [marketId, account, 0],
      },
      {
        address: contractAddress,
        abi: oddsXAbi,
        functionName: "getUserStake",
        args: [marketId, account, 1],
      },
      {
        address: contractAddress,
        abi: oddsXAbi,
        functionName: "previewReward",
        args: [marketId, account],
      },
      {
        address: contractAddress,
        abi: oddsXAbi,
        functionName: "hasClaimedReward",
        args: [marketId, account],
      },
    ],
    query: { enabled: Boolean(address) },
  });
  const { refetch: refetchSelectedPosition } = selectedPosition;

  const loadHistory = useCallback(async () => {
    if (!publicClient || !address) {
      setRewards([]);
      setResolvedMarketIds(new Set());
      setCancelledMarketIds(new Set());
      setHistoryError(null);
      setIsRateLimited(false);
      return;
    }

    try {
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = getRecentEventFromBlock(latestBlock);
      const logs = await publicClient.getContractEvents({
        address: contractAddress,
        abi: oddsXAbi,
        fromBlock,
        toBlock: latestBlock,
        strict: true,
      });
      const nextRewards: RewardRecord[] = [];
      const nextResolvedMarketIds = new Set<Hex>();
      const nextCancelledMarketIds = new Set<Hex>();

      logs.forEach((log) => {
        if (
          log.eventName === "RewardClaimed" &&
          log.args.user?.toLowerCase() === address.toLowerCase() &&
          log.args.marketId &&
          log.args.reward !== undefined
        ) {
          nextRewards.push({
            marketId: log.args.marketId,
            reward: log.args.reward,
          });
        }
        if (log.eventName === "MarketResolved" && log.args.marketId) {
          nextResolvedMarketIds.add(log.args.marketId);
        }
        if (log.eventName === "MarketCancelled" && log.args.marketId) {
          nextCancelledMarketIds.add(log.args.marketId);
        }
      });

      setRewards(nextRewards);
      setResolvedMarketIds(nextResolvedMarketIds);
      setCancelledMarketIds(nextCancelledMarketIds);
      setHistoryError(null);
      setIsRateLimited(false);
    } catch (caught) {
      const rpcError = getRpcErrorState(
        caught,
        "Portfolio history is temporarily unavailable. Please try again shortly.",
      );
      setHistoryError(rpcError.error);
      setIsRateLimited(rpcError.isRateLimited);
    }
  }, [address, publicClient]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!historyError) return;
    const retryTimer = window.setInterval(() => {
      void loadHistory();
    }, RPC_RATE_LIMIT_RETRY_MS);
    return () => window.clearInterval(retryTimer);
  }, [historyError, loadHistory]);

  const accountBets = useMemo(
    () =>
      address
        ? bets.filter(
            (bet) => bet.bettor.toLowerCase() === address.toLowerCase(),
          )
        : [],
    [address, bets],
  );

  const enteredMarkets = useMemo(
    () => new Set(accountBets.map((bet) => bet.marketId)),
    [accountBets],
  );
  const metrics = useMemo(() => {
    const resolvedEnteredCount = [...enteredMarkets].filter((id) =>
      resolvedMarketIds.has(id),
    ).length;
    const wonMarketCount = new Set(rewards.map((reward) => reward.marketId))
      .size;
    return {
      totalWagered: accountBets.reduce((total, bet) => total + bet.amount, 0n),
      totalWinnings: rewards.reduce((total, item) => total + item.reward, 0n),
      activePositions: [...enteredMarkets].filter(
        (id) => !resolvedMarketIds.has(id) && !cancelledMarketIds.has(id),
      ).length,
      winRate:
        resolvedEnteredCount > 0
          ? Math.round((wonMarketCount / resolvedEnteredCount) * 100)
          : 0,
    };
  }, [
    accountBets,
    cancelledMarketIds,
    enteredMarkets,
    resolvedMarketIds,
    rewards,
  ]);

  const selectedMetrics = useMemo(() => {
    const resultAt = <T>(index: number, fallback: T): T => {
      const result = selectedPosition.data?.[index];
      return result?.status === "success" ? (result.result as T) : fallback;
    };
    return {
      yesStake: resultAt(0, 0n),
      noStake: resultAt(1, 0n),
      previewReward: resultAt(2, 0n),
      hasClaimed: resultAt(3, false),
    };
  }, [selectedPosition.data]);

  const refetch = useCallback(() => {
    void refetchSelectedPosition();
    void loadHistory();
  }, [loadHistory, refetchSelectedPosition]);

  return {
    ...metrics,
    ...selectedMetrics,
    error: historyError ?? selectedPosition.error,
    isRateLimited,
    refetch,
  };
}
