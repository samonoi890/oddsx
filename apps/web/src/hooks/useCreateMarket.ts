"use client";

import { arcTestnet, getOddsXAddress, oddsXAbi } from "@oddsx/config";
import { useCallback, useEffect, useRef } from "react";
import { keccak256, stringToHex, zeroAddress, type Hex } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useMarketCreatorRole } from "./useMarketCreatorRole";

const contractAddress = getOddsXAddress(arcTestnet.id);

interface CreateMarketInput {
  label: string;
  description: string;
  endTime: bigint;
}

export function useCreateMarket(
  onConfirmed?: (marketId: Hex, label: string) => void,
) {
  const creatorRole = useMarketCreatorRole();
  const { address } = creatorRole;
  const pendingMarket = useRef<{ id: Hex; label: string } | null>(null);
  const handledHash = useRef<Hex | undefined>(undefined);
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
      if (!creatorRole.canCreate) {
        throw new Error("This wallet is not approved to create markets.");
      }
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
    [address, creatorRole.canCreate, writeContract],
  );

  return {
    createMarket,
    isConnected: creatorRole.isConnected,
    isCheckingRole: creatorRole.isCheckingRole,
    canCreate: creatorRole.canCreate,
    roleError: creatorRole.roleError,
    refetchRole: creatorRole.refetchRole,
    transactionHash: write.data,
    isPending: write.isPending || receipt.isLoading,
    error: write.error ?? receipt.error,
  };
}
