// apps/web/src/hooks/useMarketActions.ts
"use client";

import { arcTestnet, getOddsXAddress, oddsXAbi } from "@oddsx/config";
import { useCallback, useEffect, useRef } from "react";
import { type Hex } from "viem";
import {
  useAccount,
  useChainId,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

const contractAddress = getOddsXAddress(arcTestnet.id);

export function useMarketActions(marketId: Hex, onConfirmed?: () => void) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const {
    data: transactionHash,
    error: writeError,
    isPending: isWriting,
    writeContract,
  } = useWriteContract();

  const receipt = useWaitForTransactionReceipt({
    hash: transactionHash,
    chainId: arcTestnet.id,
    query: {
      enabled: Boolean(transactionHash),
    },
  });
  const handledTransactionHash = useRef<Hex | undefined>(undefined);

  useEffect(() => {
    if (
      receipt.isSuccess &&
      transactionHash &&
      handledTransactionHash.current !== transactionHash
    ) {
      handledTransactionHash.current = transactionHash;
      onConfirmed?.();
    }
  }, [onConfirmed, receipt.isSuccess, transactionHash]);

  const requireWriteAccess = useCallback(() => {
    if (!isConnected || !address) {
      throw new Error("Connect your wallet to continue.");
    }
    if (chainId !== arcTestnet.id) {
      throw new Error("Switch your wallet to Arc Testnet to continue.");
    }
  }, [address, chainId, isConnected]);

  const placeNativeBet = useCallback(
    (outcome: number, amount: bigint) => {
      requireWriteAccess();
      writeContract({
        abi: oddsXAbi,
        address: contractAddress,
        functionName: "placeBet",
        args: [marketId, outcome, amount],
        value: amount,
        chainId: arcTestnet.id,
      });
    },
    [marketId, requireWriteAccess, writeContract],
  );

  const claimReward = useCallback(() => {
    requireWriteAccess();
    writeContract({
      abi: oddsXAbi,
      address: contractAddress,
      functionName: "claimReward",
      args: [marketId],
      chainId: arcTestnet.id,
    });
  }, [marketId, requireWriteAccess, writeContract]);

  return {
    placeNativeBet,
    claimReward,
    isCorrectChain: chainId === arcTestnet.id,
    transactionHash,
    actionError: writeError ?? receipt.error,
    isPending: isWriting || receipt.isLoading,
    isConfirmed: receipt.isSuccess,
  };
}
