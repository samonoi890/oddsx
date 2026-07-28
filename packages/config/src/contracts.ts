// packages/config/src/contracts.ts
import { isAddress, type Address } from "viem";
import { arcTestnet } from "./chains";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
export const DEFAULT_ODDSX_ADDRESS_ARC_TESTNET =
  "0x6C9fD55355e83190363842693867826d4eCd94C5" as const;

const configuredArcAddress =
  process.env.NEXT_PUBLIC_ODDSX_ADDRESS_ARC_TESTNET?.trim();
if (configuredArcAddress && !isAddress(configuredArcAddress)) {
  throw new Error(
    "NEXT_PUBLIC_ODDSX_ADDRESS_ARC_TESTNET must be a valid non-zero EVM address.",
  );
}
const arcAddress: Address = configuredArcAddress
  ? (configuredArcAddress as Address)
  : DEFAULT_ODDSX_ADDRESS_ARC_TESTNET;

if (arcAddress === ZERO_ADDRESS) {
  throw new Error("OddsX contract address cannot be the zero address.");
}

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
