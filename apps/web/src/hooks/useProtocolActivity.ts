// apps/web/src/hooks/useProtocolActivity.ts
"use client";

import { arcTestnet, getOddsXAddress, oddsXAbi } from "@oddsx/config";
import { useCallback, useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import {
  getRecentEventFromBlock,
  getRpcErrorState,
  RPC_RATE_LIMIT_RETRY_MS,
} from "@/lib/rpc";

export interface ProtocolBet {
  id: string;
  marketId: Hex;
  bettor: Address;
  outcome: number;
  amount: bigint;
  transactionHash: Hex;
  blockNumber: bigint;
  logIndex: number;
}

const contractAddress = getOddsXAddress(arcTestnet.id);

function normalizeBetLogs(
  logs: readonly {
    args: {
      marketId?: Hex;
      bettor?: Address;
      outcome?: number;
      amount?: bigint;
    };
    transactionHash: Hex | null;
    blockNumber: bigint | null;
    logIndex: number | null;
  }[],
): ProtocolBet[] {
  return logs.flatMap((log) => {
    if (
      !log.args.marketId ||
      !log.args.bettor ||
      log.args.outcome === undefined ||
      log.args.amount === undefined ||
      !log.transactionHash ||
      log.blockNumber === null ||
      log.logIndex === null
    ) {
      return [];
    }

    return [
      {
        id: `${log.transactionHash}-${log.logIndex}`,
        marketId: log.args.marketId,
        bettor: log.args.bettor,
        outcome: log.args.outcome,
        amount: log.args.amount,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
      },
    ];
  });
}

function mergeBets(current: ProtocolBet[], incoming: ProtocolBet[]) {
  const byId = new Map(current.map((bet) => [bet.id, bet]));
  incoming.forEach((bet) => byId.set(bet.id, bet));
  return [...byId.values()]
    .sort((a, b) => {
      if (a.blockNumber === b.blockNumber) return b.logIndex - a.logIndex;
      return a.blockNumber > b.blockNumber ? -1 : 1;
    })
    .slice(0, 100);
}

export function useProtocolActivity() {
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const [bets, setBets] = useState<ProtocolBet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!publicClient) return;
    setIsLoading(true);
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const logs = await publicClient.getContractEvents({
        address: contractAddress,
        abi: oddsXAbi,
        eventName: "BetPlaced",
        fromBlock: getRecentEventFromBlock(latestBlock),
        toBlock: latestBlock,
        strict: true,
      });
      setBets((current) => mergeBets(current, normalizeBetLogs(logs)));
      setError(null);
      setIsRateLimited(false);
    } catch (caught) {
      const rpcError = getRpcErrorState(
        caught,
        "Live activity is temporarily unavailable. Please try again shortly.",
      );
      setError(rpcError.error);
      setIsRateLimited(rpcError.isRateLimited);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!error) return;
    const retryTimer = window.setInterval(() => {
      void loadHistory();
    }, RPC_RATE_LIMIT_RETRY_MS);
    return () => window.clearInterval(retryTimer);
  }, [error, loadHistory]);

  useWatchContractEvent({
    address: contractAddress,
    abi: oddsXAbi,
    eventName: "BetPlaced",
    chainId: arcTestnet.id,
    strict: true,
    enabled: !isRateLimited,
    onLogs(logs) {
      setBets((current) => mergeBets(current, normalizeBetLogs(logs)));
      setError(null);
      setIsRateLimited(false);
    },
    onError(caught) {
      const rpcError = getRpcErrorState(
        caught,
        "Live activity is temporarily unavailable. Please try again shortly.",
      );
      setError(rpcError.error);
      setIsRateLimited(rpcError.isRateLimited);
    },
  });

  return {
    bets,
    isLoading,
    error,
    isRateLimited,
  };
}
