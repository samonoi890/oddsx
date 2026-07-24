# Build and Frontend Health Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Foundry configuration health and eliminate the audited frontend correctness issues while adding safe local-development environment defaults.

**Architecture:** Keep contract changes metadata-only, preserve the existing shared config package as the source of chain/address truth, and harden the existing hooks/components without restructuring the app. Wagmi's initial chain will be selected by ordering `supportedChains`, transaction confirmation will be deduplicated by hash, and market expiration will update client-side.

**Tech Stack:** Solidity 0.8.30, Foundry, Next.js 15, React 19, TypeScript 5.9, Wagmi 2, Viem 2.

## Global Constraints

- Add `// SPDX-License-Identifier: MIT` only to Solidity files under `packages/contracts/src/`.
- Preserve existing public contract behavior and ABI.
- Treat environment addresses as local placeholders, not deployed production addresses.
- Do not add dependencies unless the existing APIs cannot implement the requirement.

---

### Task 1: Restore Foundry configuration and Solidity metadata

**Files:**
- Modify: `packages/contracts/remappings.txt`
- Modify: `packages/contracts/src/OddsX.sol`
- Modify: `packages/contracts/src/interfaces/IOddsX.sol`
- Modify: `packages/contracts/src/mocks/MockERC20.sol`

**Interfaces:**
- Consumes: Existing OpenZeppelin and forge-std remapping paths.
- Produces: A parseable remappings file and MIT-tagged production Solidity sources.

- [ ] **Step 1: Remove the non-remapping comment from `remappings.txt`**

```text
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
forge-std/=lib/forge-std/src/
```

- [ ] **Step 2: Add the SPDX identifier before each source pragma**

```solidity
// SPDX-License-Identifier: MIT
// existing path comment
pragma solidity 0.8.30;
```

- [ ] **Step 3: Verify Foundry can parse configuration**

Run: `cd packages/contracts && forge config --json`
Expected: exit 0 with parsed remappings; compilation may separately require absent libraries.

### Task 2: Stabilize confirmation and market refetch behavior

**Files:**
- Modify: `apps/web/src/hooks/useMarket.ts`
- Modify: `apps/web/src/hooks/useMarketActions.ts`

**Interfaces:**
- Consumes: Wagmi query `refetch` functions and transaction receipt/hash state.
- Produces: Stable `refetch(): void` and at-most-once `onConfirmed()` invocation for each transaction hash.

- [ ] **Step 1: Memoize the combined market/pools refetch callback**

```ts
const refetch = useCallback(() => {
  void marketQuery.refetch();
  void poolsQuery.refetch();
}, [marketQuery.refetch, poolsQuery.refetch]);
```

- [ ] **Step 2: Deduplicate confirmation callbacks by transaction hash**

```ts
const handledTransactionHash = useRef<Hex>();
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
```

- [ ] **Step 3: Run frontend typecheck**

Run: `pnpm --filter @oddsx/web typecheck`
Expected: exit 0 after dependencies are installed.

### Task 3: Validate bet amounts and respect live expiration

**Files:**
- Modify: `apps/web/src/components/BetForm.tsx`
- Modify: `apps/web/src/components/MarketCard.tsx`

**Interfaces:**
- Consumes: `placeNativeBet(outcome: number, amount: bigint)` and `MarketView.endTime`.
- Produces: Inline validation errors and a live `isBettingOpen` UI condition.

- [ ] **Step 1: Validate trimmed input before submitting**

```ts
if (!amount.trim()) setValidationError("Enter a bet amount.");
try {
  const parsedAmount = parseEther(amount.trim());
  if (parsedAmount <= 0n) setValidationError("Bet amount must be greater than zero.");
  else placeNativeBet(outcome, parsedAmount);
} catch {
  setValidationError("Enter a valid amount with no more than 18 decimal places.");
}
```

- [ ] **Step 2: Maintain current epoch seconds and require an unexpired open market**

```ts
const [currentTime, setCurrentTime] = useState<bigint | null>(null);
useEffect(() => {
  const updateCurrentTime = () => setCurrentTime(BigInt(Math.floor(Date.now() / 1000)));
  updateCurrentTime();
  const interval = window.setInterval(updateCurrentTime, 1_000);
  return () => window.clearInterval(interval);
}, []);
const isBettingOpen = market.state === 1 && currentTime !== null && currentTime < market.endTime;
```

- [ ] **Step 3: Run lint and typecheck**

Run: `pnpm --filter @oddsx/web lint && pnpm --filter @oddsx/web typecheck`
Expected: both exit 0 after dependencies are installed.

### Task 4: Apply default chain and add local environment templates

**Files:**
- Modify: `packages/config/src/chains.ts`
- Verify: `apps/web/src/providers/Web3Provider.tsx`
- Create: `apps/web/.env.example`
- Create: `apps/web/.env.local`
- Create: `packages/config/.env.example`
- Create: `packages/config/.env.local`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_DEFAULT_CHAIN_ID` and the existing `supportedChains` export used by Wagmi.
- Produces: A validated default chain placed first in `supportedChains`, plus local placeholder configuration.

- [ ] **Step 1: Validate and order supported chains**

```ts
const configuredChainId = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ?? localhost.id);
export const defaultChainId = availableChains.some(({ id }) => id === configuredChainId)
  ? configuredChainId
  : localhost.id;
const defaultChain = availableChains.find(({ id }) => id === defaultChainId) ?? localhost;
export const supportedChains = [
  defaultChain,
  ...availableChains.filter(({ id }) => id !== defaultChainId),
] as const-compatible non-empty Wagmi chain list;
```

- [ ] **Step 2: Add local environment files**

```dotenv
NEXT_PUBLIC_DEFAULT_CHAIN_ID=31337
NEXT_PUBLIC_ODDSX_ADDRESS_LOCALHOST=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
NEXT_PUBLIC_ODDSX_ADDRESS_SEPOLIA=
NEXT_PUBLIC_ODDSX_ADDRESS_MAINNET=
```

The web copies also include an empty `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

- [ ] **Step 3: Verify all modified files**

Run: `forge fmt --check`, `forge build`, `pnpm typecheck`, and `pnpm lint` from their correct package/workspace contexts.
Expected: formatting passes; builds/checks pass when declared dependencies are present. Report dependency-related blockers separately from source failures.
