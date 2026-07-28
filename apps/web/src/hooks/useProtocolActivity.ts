// apps/web/src/hooks/useProtocolActivity.ts
"use client";

import { arcTestnet, getOddsXAddress, oddsXAbi } from "@oddsx/config";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Address, Hex } from "viem";
import { usePublicClient } from "wagmi";
import { getRecentEventFromBlock, getRpcErrorState } from "@/lib/rpc";

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
const ACTIVITY_POLL_INTERVAL_MS = 30_000;

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
  const lastSyncedBlock = useRef<bigint | null>(null);
  const isSyncing = useRef(false);

  const syncActivity = useCallback(async () => {
    if (!publicClient || isSyncing.current) return;
    isSyncing.current = true;
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock =
        lastSyncedBlock.current === null
          ? getRecentEventFromBlock(latestBlock)
          : lastSyncedBlock.current + 1n;
      const logs =
        fromBlock <= latestBlock
          ? await publicClient.getContractEvents({
              address: contractAddress,
              abi: oddsXAbi,
              eventName: "BetPlaced",
              fromBlock,
              toBlock: latestBlock,
              strict: true,
            })
          : [];
      setBets((current) => mergeBets(current, normalizeBetLogs(logs)));
      lastSyncedBlock.current = latestBlock;
      setError(null);
      setIsRateLimited(false);
    } catch (caught) {
      const rpcError = getRpcErrorState(
        caught,
        "Live activity lost its connection to Arc. Retrying automatically.",
      );
      setError(rpcError.error);
      setIsRateLimited(rpcError.isRateLimited);
    } finally {
      setIsLoading(false);
      isSyncing.current = false;
    }
  }, [publicClient]);

  useEffect(() => {
    void syncActivity();
    const pollTimer = window.setInterval(() => {
      void syncActivity();
    }, ACTIVITY_POLL_INTERVAL_MS);
    const handleOnline = () => void syncActivity();
    window.addEventListener("online", handleOnline);
    return () => {
      window.clearInterval(pollTimer);
      window.removeEventListener("online", handleOnline);
    };
  }, [syncActivity]);

  const retry = useCallback(() => {
    void syncActivity();
  }, [syncActivity]);

  return {
    bets,
    isLoading,
    error,
    isRateLimited,
    retry,
  };
}
