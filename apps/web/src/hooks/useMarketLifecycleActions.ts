"use client";

import { arcTestnet, getOddsXAddress, oddsXAbi } from "@oddsx/config";
import { useCallback, useEffect, useRef, useState } from "react";
import { keccak256, stringToHex, zeroAddress, type Hex } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

const contractAddress = getOddsXAddress(arcTestnet.id);
const RESOLVER_ROLE = keccak256(stringToHex("RESOLVER_ROLE"));
const CANCELLER_ROLE = keccak256(stringToHex("CANCELLER_ROLE"));

type LifecycleAction = "resolve" | "cancel" | "refund";

export function useMarketLifecycleActions(
  marketId: Hex,
  onConfirmed?: () => void,
) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [action, setAction] = useState<LifecycleAction | null>(null);
  const account = address ?? zeroAddress;
  const roles = useReadContracts({
    contracts: [
      {
        address: contractAddress,
        abi: oddsXAbi,
        functionName: "hasRole",
        args: [RESOLVER_ROLE, account],
      },
      {
        address: contractAddress,
        abi: oddsXAbi,
        functionName: "hasRole",
        args: [CANCELLER_ROLE, account],
      },
    ],
    query: { enabled: Boolean(address) },
  });
  const resolutionDelay = useReadContract({
    address: contractAddress,
    abi: oddsXAbi,
    functionName: "getMarketResolutionDelay",
    args: [marketId],
    chainId: arcTestnet.id,
  });
  const write = useWriteContract();
  const { writeContract } = write;
  const receipt = useWaitForTransactionReceipt({
    hash: write.data,
    chainId: arcTestnet.id,
    query: { enabled: Boolean(write.data) },
  });
  const handledHash = useRef<Hex | undefined>(undefined);

  useEffect(() => {
    if (receipt.isSuccess && write.data && handledHash.current !== write.data) {
      handledHash.current = write.data;
      onConfirmed?.();
    }
  }, [onConfirmed, receipt.isSuccess, write.data]);

  const requireWriteAccess = useCallback(() => {
    if (!isConnected || !address) {
      throw new Error("Connect your wallet to continue.");
    }
    if (chainId !== arcTestnet.id) {
      throw new Error("Switch your wallet to Arc Testnet to continue.");
    }
  }, [address, chainId, isConnected]);

  const resolveMarket = useCallback(
    (winningOutcome: number) => {
      requireWriteAccess();
      setAction("resolve");
      writeContract({
        address: contractAddress,
        abi: oddsXAbi,
        functionName: "resolveMarket",
        args: [marketId, winningOutcome],
        chainId: arcTestnet.id,
      });
    },
    [marketId, requireWriteAccess, writeContract],
  );

  const cancelMarket = useCallback(
    (reason: string) => {
      requireWriteAccess();
      setAction("cancel");
      writeContract({
        address: contractAddress,
        abi: oddsXAbi,
        functionName: "cancelMarket",
        args: [
          marketId,
          keccak256(stringToHex(reason.trim() || "MANUAL_CANCELLATION")),
        ],
        chainId: arcTestnet.id,
      });
    },
    [marketId, requireWriteAccess, writeContract],
  );

  const claimRefund = useCallback(
    (outcome: number) => {
      requireWriteAccess();
      setAction("refund");
      writeContract({
        address: contractAddress,
        abi: oddsXAbi,
        functionName: "emergencyRefund",
        args: [marketId, outcome],
        chainId: arcTestnet.id,
      });
    },
    [marketId, requireWriteAccess, writeContract],
  );

  const resultAt = (index: number) =>
    roles.data?.[index]?.status === "success"
      ? roles.data[index].result === true
      : false;

  return {
    resolveMarket,
    cancelMarket,
    claimRefund,
    hasResolverRole: resultAt(0),
    hasCancellerRole: resultAt(1),
    resolutionDelay: resolutionDelay.data ?? 0n,
    isCheckingRoles: roles.isLoading,
    isCorrectChain: chainId === arcTestnet.id,
    action,
    transactionHash: write.data,
    isPending: write.isPending || receipt.isLoading,
    isConfirmed: receipt.isSuccess,
    error: roles.error ?? resolutionDelay.error ?? write.error ?? receipt.error,
  };
}
