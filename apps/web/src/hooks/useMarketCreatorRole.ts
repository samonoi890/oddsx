"use client";

import { arcTestnet, getOddsXAddress, oddsXAbi } from "@oddsx/config";
import { keccak256, stringToHex } from "viem";
import { useAccount, useReadContract } from "wagmi";

const contractAddress = getOddsXAddress(arcTestnet.id);
export const MARKET_CREATOR_ROLE = keccak256(
  stringToHex("MARKET_CREATOR_ROLE"),
);

export function useMarketCreatorRole() {
  const { address, isConnected } = useAccount();
  const role = useReadContract({
    address: contractAddress,
    abi: oddsXAbi,
    functionName: "hasRole",
    args: address ? [MARKET_CREATOR_ROLE, address] : undefined,
    chainId: arcTestnet.id,
    query: {
      enabled: Boolean(address),
      staleTime: 12_000,
      refetchInterval: 12_000,
    },
  });

  return {
    address,
    isConnected,
    isCheckingRole: role.isLoading,
    canCreate: role.data === true,
    roleError: role.error,
    refetchRole: role.refetch,
  };
}
