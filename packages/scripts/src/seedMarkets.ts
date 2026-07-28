// packages/scripts/src/seedMarkets.ts
//
// Seed script: initialises a set of active OddsX prediction markets on Arc
// Testnet by calling `createMarket` from an account that holds
// MARKET_CREATOR_ROLE.
//
// Usage:
//   1. cp packages/scripts/.env.example packages/scripts/.env  (fill ADMIN_PRIVATE_KEY)
//   2. pnpm --filter @oddsx/scripts seed
//
// The script is idempotent: markets that already exist on-chain are detected
// via the `MarketAlreadyExists` revert and skipped, so it is safe to re-run.

// ./env MUST be imported first: it loads the .env files (including
// apps/web/.env.local) before any other module reads process.env.
import {
  loadedEnvFiles,
  requireEnv,
  sanitizePrivateKey,
} from "./env";

import { oddsXAbi, arcTestnet } from "@oddsx/config";
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  keccak256,
  stringToHex,
  zeroAddress,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ---------------------------------------------------------------------------
// The shared @oddsx/config ABI intentionally ships only functions + events, so
// viem cannot decode custom reverts by name. We merge the error fragments we
// care about here purely to get human-readable revert reasons.
// ---------------------------------------------------------------------------
const oddsXErrorsAbi = [
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "EmptyMarketId", inputs: [] },
  { type: "error", name: "EmptyDescription", inputs: [] },
  {
    type: "error",
    name: "MarketAlreadyExists",
    inputs: [{ name: "marketId", type: "bytes32" }],
  },
  {
    type: "error",
    name: "InvalidEndTime",
    inputs: [
      { name: "suppliedEndTime", type: "uint256" },
      { name: "currentTime", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "InvalidOutcomeCount",
    inputs: [{ name: "suppliedCount", type: "uint32" }],
  },
  {
    type: "error",
    name: "AccessControlUnauthorizedAccount",
    inputs: [
      { name: "account", type: "address" },
      { name: "neededRole", type: "bytes32" },
    ],
  },
] as const;

const abi = [...oddsXAbi, ...oddsXErrorsAbi] as unknown as Abi;

// Roles / constants (must mirror the contract's keccak256(string) definitions).
const MARKET_CREATOR_ROLE = keccak256(stringToHex("MARKET_CREATOR_ROLE"));
const OUTCOMES_COUNT = 2; // binary YES / NO markets
const GAS_BUFFER_BPS = 12_000n; // 120% of the estimate
const BPS_DENOMINATOR = 10_000n;

// ---------------------------------------------------------------------------
// Market catalogue to seed. `id` is derived exactly like the OddsX frontend:
// keccak256(stringToHex(label)).
// ---------------------------------------------------------------------------
interface SeedMarket {
  label: string;
  description: string;
  endTime: bigint;
}

const MARKETS: SeedMarket[] = [
  {
    label: "ETH_ABOVE_5000_Q4_2026",
    description: "Will Ethereum price exceed $5,000 before December 31, 2026?",
    endTime: 1798761599n, // Dec 31, 2026
  },
  {
    label: "ARC_MAINNET_LAUNCH_2026",
    description:
      "Will Arc Network launch its official Mainnet before Q4 2026?",
    endTime: 1790726399n, // Sep 30, 2026
  },
  {
    label: "BTC_NEW_ATH_2026",
    description:
      "Will Bitcoin reach a new All-Time High above $120,000 in 2026?",
    endTime: 1798761599n, // Dec 31, 2026
  },
  {
    label: "SOL_ETH_FLIP_2026",
    description:
      "Will Solana market cap flip Ethereum at any point in 2026?",
    endTime: 1798761599n, // Dec 31, 2026
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function marketIdFor(label: string): Hex {
  return keccak256(stringToHex(label));
}

interface DecodedRevert {
  errorName: string;
  args: readonly unknown[];
}

function decodeRevert(error: unknown): DecodedRevert | null {
  if (!(error instanceof BaseError)) return null;
  const revert = error.walk(
    (candidate) => candidate instanceof ContractFunctionRevertedError,
  ) as ContractFunctionRevertedError | null;
  if (revert?.data) {
    return {
      errorName: revert.data.errorName,
      args: revert.data.args ?? [],
    };
  }
  return null;
}

function shortReason(error: unknown): string {
  const decoded = decodeRevert(error);
  if (decoded) {
    const args = decoded.args.length ? ` (${decoded.args.join(", ")})` : "";
    return `${decoded.errorName}${args}`;
  }
  if (error instanceof BaseError) return error.shortMessage;
  return error instanceof Error ? error.message : String(error);
}

function toIso(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
type SeedStatus = "created" | "skipped" | "failed";

interface SeedResult {
  label: string;
  marketId: Hex;
  status: SeedStatus;
  detail: string;
}

async function main(): Promise<void> {
  const rpcUrl =
    process.env.ARC_TESTNET_RPC_URL?.trim() ||
    "https://rpc.testnet.arc.network";
  const account = privateKeyToAccount(
    sanitizePrivateKey(requireEnv("ADMIN_PRIVATE_KEY")),
  );

  console.log(
    loadedEnvFiles.length > 0
      ? `Loaded env from: ${loadedEnvFiles.join(", ")}`
      : "No .env file found; relying on shell environment variables.",
  );

  const contractAddress = (process.env.ODDSX_ADDRESS?.trim() ||
    "0xA5649df055BF83505Dc41D014c18F8eD412C764C") as Address;
  if (!isAddress(contractAddress)) {
    throw new Error(`ODDSX_ADDRESS is not a valid address: ${contractAddress}`);
  }

  const oracle = (process.env.ORACLE_ADDRESS?.trim() ||
    account.address) as Address;
  if (!isAddress(oracle)) {
    throw new Error(`ORACLE_ADDRESS is not a valid address: ${oracle}`);
  }

  const settlementAsset = (process.env.SETTLEMENT_ASSET?.trim() ||
    zeroAddress) as Address;
  if (!isAddress(settlementAsset)) {
    throw new Error(
      `SETTLEMENT_ASSET is not a valid address: ${settlementAsset}`,
    );
  }

  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: arcTestnet, transport });
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport,
  });

  console.log("┌─ OddsX market seeder ───────────────────────────────");
  console.log(`│ Network        : ${arcTestnet.name} (chainId ${arcTestnet.id})`);
  console.log(`│ RPC            : ${rpcUrl}`);
  console.log(`│ Contract       : ${contractAddress}`);
  console.log(`│ Admin account  : ${account.address}`);
  console.log(`│ Oracle         : ${oracle}`);
  console.log(
    `│ Settlement     : ${settlementAsset === zeroAddress ? "native USDC" : settlementAsset}`,
  );
  console.log("└─────────────────────────────────────────────────────\n");

  // Fail fast on chain / balance / authorization problems before broadcasting.
  const [onChainId, balance, latestBlock, canCreate] = await Promise.all([
    publicClient.getChainId(),
    publicClient.getBalance({ address: account.address }),
    publicClient.getBlock(),
    publicClient.readContract({
      address: contractAddress,
      abi,
      functionName: "hasRole",
      args: [MARKET_CREATOR_ROLE, account.address],
    }) as Promise<boolean>,
  ]);

  if (onChainId !== arcTestnet.id) {
    throw new Error(
      `RPC reports chainId ${onChainId}, expected ${arcTestnet.id}. Check ARC_TESTNET_RPC_URL.`,
    );
  }
  if (balance === 0n) {
    throw new Error(
      `Admin account ${account.address} has zero native balance; it cannot pay gas on Arc.`,
    );
  }
  if (!canCreate) {
    throw new Error(
      `Account ${account.address} does NOT hold MARKET_CREATOR_ROLE on ${contractAddress}. ` +
        `Grant the role (from the contract admin) before seeding.`,
    );
  }

  const now = latestBlock.timestamp;
  console.log(
    `Pre-flight OK — balance ${balance} wei, chain time ${toIso(now)}\n`,
  );

  const results: SeedResult[] = [];

  // Sequential loop: we await each receipt before sending the next tx so the
  // account nonce advances cleanly without manual nonce management.
  for (const [index, market] of MARKETS.entries()) {
    const marketId = marketIdFor(market.label);
    const position = `[${index + 1}/${MARKETS.length}]`;

    console.log(`${position} ${market.label}`);
    console.log(`        marketId : ${marketId}`);
    console.log(
      `        endTime  : ${market.endTime} (${toIso(market.endTime)})`,
    );

    if (market.endTime <= now) {
      console.warn(
        `        ⚠ endTime is not in the future relative to chain time; contract will reject it.`,
      );
    }

    const args = [
      marketId,
      market.description,
      market.endTime, // uint64
      OUTCOMES_COUNT, // uint32
      oracle,
      settlementAsset,
    ] as const;

    // Clean gas estimation. This call also acts as a pre-flight simulation:
    // if the tx would revert (e.g. MarketAlreadyExists), it throws here and we
    // never broadcast / spend gas.
    let gasEstimate: bigint;
    try {
      gasEstimate = await publicClient.estimateContractGas({
        account,
        address: contractAddress,
        abi,
        functionName: "createMarket",
        args,
      });
    } catch (error) {
      const decoded = decodeRevert(error);
      if (decoded?.errorName === "MarketAlreadyExists") {
        console.log(`        ↷ already exists on-chain — skipping.\n`);
        results.push({
          label: market.label,
          marketId,
          status: "skipped",
          detail: "already exists",
        });
        continue;
      }
      const reason = shortReason(error);
      console.error(`        ✗ pre-flight failed: ${reason}\n`);
      results.push({
        label: market.label,
        marketId,
        status: "failed",
        detail: reason,
      });
      continue;
    }

    const gasLimit = (gasEstimate * GAS_BUFFER_BPS) / BPS_DENOMINATOR;
    console.log(
      `        gas      : est ${gasEstimate} → limit ${gasLimit} (+20%)`,
    );

    try {
      const hash = await walletClient.writeContract({
        account,
        address: contractAddress,
        abi,
        functionName: "createMarket",
        args,
        gas: gasLimit,
      });
      console.log(`        tx       : ${hash}`);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      if (receipt.status !== "success") {
        console.error(`        ✗ reverted on-chain (block ${receipt.blockNumber}).\n`);
        results.push({
          label: market.label,
          marketId,
          status: "failed",
          detail: `reverted (tx ${hash})`,
        });
        continue;
      }

      console.log(
        `        ✓ confirmed in block ${receipt.blockNumber}, gasUsed ${receipt.gasUsed}`,
      );
      console.log(
        `        explorer : ${arcTestnet.blockExplorers?.default.url}/tx/${hash}\n`,
      );
      results.push({
        label: market.label,
        marketId,
        status: "created",
        detail: hash,
      });
    } catch (error) {
      const reason = shortReason(error);
      console.error(`        ✗ transaction failed: ${reason}\n`);
      results.push({
        label: market.label,
        marketId,
        status: "failed",
        detail: reason,
      });
    }
  }

  // Summary
  console.log("═══ Summary ══════════════════════════════════════════");
  for (const result of results) {
    const icon =
      result.status === "created"
        ? "✓"
        : result.status === "skipped"
          ? "↷"
          : "✗";
    console.log(`${icon} ${result.status.padEnd(7)} ${result.label}`);
    console.log(`             id ${result.marketId}`);
    console.log(`             ${result.detail}`);
  }

  const created = results.filter((r) => r.status === "created").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;
  console.log("──────────────────────────────────────────────────────");
  console.log(
    `created ${created} · skipped ${skipped} · failed ${failed} · total ${results.length}`,
  );

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("\nFatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
