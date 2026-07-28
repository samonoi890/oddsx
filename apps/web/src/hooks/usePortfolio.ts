"use client";

import { arcTestnet, getOddsXAddress, oddsXAbi } from "@oddsx/config";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Hex } from "viem";
import { zeroAddress } from "viem";
import { useAccount, usePublicClient, useReadContracts } from "wagmi";
import {
  collectEventPages,
  getRpcErrorState,
  RPC_RATE_LIMIT_RETRY_MS,
} from "@/lib/rpc";

interface AccountBet {
  marketId: Hex;
  amount: bigint;
}

interface RewardRecord {
  marketId: Hex;
  reward: bigint;
}

const contractAddress = getOddsXAddress(arcTestnet.id);

export function usePortfolio(marketId: Hex) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const [accountBets, setAccountBets] = useState<AccountBet[]>([]);
  const [rewards, setRewards] = useState<RewardRecord[]>([]);
  const [marketStates, setMarketStates] = useState<Map<Hex, number>>(new Map());
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
    query: { enabled: Boolean(address), refetchInterval: 12_000 },
  });
  const { refetch: refetchSelectedPosition } = selectedPosition;

  const loadHistory = useCallback(async () => {
    if (!publicClient || !address) {
      setAccountBets([]);
      setRewards([]);
      setMarketStates(new Map());
      setHistoryError(null);
      setIsRateLimited(false);
      return;
    }

    try {
      const latestBlock = await publicClient.getBlockNumber();
      const [betLogs, rewardLogs] = await Promise.all([
        collectEventPages(latestBlock, (fromBlock, toBlock) =>
          publicClient.getContractEvents({
            address: contractAddress,
            abi: oddsXAbi,
            eventName: "BetPlaced",
            args: { bettor: address },
            fromBlock,
            toBlock,
            strict: true,
          }),
        ),
        collectEventPages(latestBlock, (fromBlock, toBlock) =>
          publicClient.getContractEvents({
            address: contractAddress,
            abi: oddsXAbi,
            eventName: "RewardClaimed",
            args: { user: address },
            fromBlock,
            toBlock,
            strict: true,
          }),
        ),
      ]);

      const nextBets = betLogs.flatMap((log) =>
        log.args.marketId && log.args.amount !== undefined
          ? [{ marketId: log.args.marketId, amount: log.args.amount }]
          : [],
      );
      const nextRewards = rewardLogs.flatMap((log) =>
        log.args.marketId && log.args.reward !== undefined
          ? [{ marketId: log.args.marketId, reward: log.args.reward }]
          : [],
      );
      const enteredMarketIds = [
        ...new Set(nextBets.map((bet) => bet.marketId)),
      ];
      const stateResults = await publicClient.multicall({
        allowFailure: true,
        contracts: enteredMarketIds.map((id) => ({
          address: contractAddress,
          abi: oddsXAbi,
          functionName: "getMarket" as const,
          args: [id] as const,
        })),
      });
      const nextStates = new Map<Hex, number>();
      stateResults.forEach((result, index) => {
        const id = enteredMarketIds[index];
        if (id && result.status === "success") {
          nextStates.set(id, Number(result.result.state));
        }
      });

      setAccountBets(nextBets);
      setRewards(nextRewards);
      setMarketStates(nextStates);
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

  const metrics = useMemo(() => {
    const enteredMarkets = new Set(accountBets.map((bet) => bet.marketId));
    const resolvedEnteredCount = [...enteredMarkets].filter(
      (id) => marketStates.get(id) === 2,
    ).length;
    const wonMarketCount = new Set(rewards.map((reward) => reward.marketId))
      .size;
    return {
      totalWagered: accountBets.reduce((total, bet) => total + bet.amount, 0n),
      totalWinnings: rewards.reduce((total, item) => total + item.reward, 0n),
      activePositions: [...enteredMarkets].filter(
        (id) => marketStates.get(id) === 1,
      ).length,
      winRate:
        resolvedEnteredCount > 0
          ? Math.round((wonMarketCount / resolvedEnteredCount) * 100)
          : 0,
    };
  }, [accountBets, marketStates, rewards]);

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
