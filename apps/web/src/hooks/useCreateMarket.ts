"use client";

import { arcTestnet, getOddsXAddress, oddsXAbi } from "@oddsx/config";
import { useCallback, useEffect, useRef } from "react";
import { keccak256, stringToHex, zeroAddress, type Hex } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

const contractAddress = getOddsXAddress(arcTestnet.id);
const MARKET_CREATOR_ROLE = keccak256(stringToHex("MARKET_CREATOR_ROLE"));

interface CreateMarketInput {
  label: string;
  description: string;
  endTime: bigint;
}

export function useCreateMarket(
  onConfirmed?: (marketId: Hex, label: string) => void,
) {
  const { address, isConnected } = useAccount();
  const pendingMarket = useRef<{ id: Hex; label: string } | null>(null);
  const handledHash = useRef<Hex | undefined>(undefined);
  const role = useReadContract({
    address: contractAddress,
    abi: oddsXAbi,
    functionName: "hasRole",
    args: address ? [MARKET_CREATOR_ROLE, address] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: Boolean(address) },
  });
  const write = useWriteContract();
  const { writeContract } = write;
  const receipt = useWaitForTransactionReceipt({
    hash: write.data,
    chainId: arcTestnet.id,
    query: { enabled: Boolean(write.data) },
  });

  useEffect(() => {
    if (
      !receipt.isSuccess ||
      !write.data ||
      handledHash.current === write.data ||
      !pendingMarket.current
    ) {
      return;
    }
    handledHash.current = write.data;
    onConfirmed?.(pendingMarket.current.id, pendingMarket.current.label);
  }, [onConfirmed, receipt.isSuccess, write.data]);

  const createMarket = useCallback(
    ({ label, description, endTime }: CreateMarketInput) => {
      if (!address) throw new Error("Connect a wallet to create a market.");
      const marketId = keccak256(stringToHex(label));
      pendingMarket.current = { id: marketId, label };
      writeContract({
        address: contractAddress,
        abi: oddsXAbi,
        functionName: "createMarket",
        args: [marketId, description, endTime, 2, address, zeroAddress],
        chainId: arcTestnet.id,
      });
      return marketId;
    },
    [address, writeContract],
  );

  return {
    createMarket,
    isConnected,
    isCheckingRole: role.isLoading,
    canCreate: role.data === true,
    transactionHash: write.data,
    isPending: write.isPending || receipt.isLoading,
    error: role.error ?? write.error ?? receipt.error,
  };
}
