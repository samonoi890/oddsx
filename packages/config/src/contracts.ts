// packages/config/src/contracts.ts
import { isAddress, type Address } from "viem";
import { arcTestnet } from "./chains";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
export const DEFAULT_ODDSX_ADDRESS_ARC_TESTNET =
  "0xA5649df055BF83505Dc41D014c18F8eD412C764C" as const;

const configuredArcAddress =
  process.env.NEXT_PUBLIC_ODDSX_ADDRESS_ARC_TESTNET?.trim();
const arcAddress =
  configuredArcAddress && isAddress(configuredArcAddress)
    ? configuredArcAddress
    : DEFAULT_ODDSX_ADDRESS_ARC_TESTNET;

const oddsXAddresses: Record<number, Address> = {
  [arcTestnet.id]: arcAddress,
};

export function getOddsXAddress(chainId: number): Address {
  const address = oddsXAddresses[chainId];
  if (!address || address === ZERO_ADDRESS) {
    if (typeof window === "undefined") {
      return ZERO_ADDRESS;
    }
    throw new Error(`OddsX is not configured for chain ${chainId}.`);
  }
  return address;
}
