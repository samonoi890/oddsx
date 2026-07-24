# Workspace Audit and Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove confirmed dead code, harden trader contract interactions, reduce Arc RPC load, and produce a warning-free verified workspace build.

**Architecture:** Keep the existing monorepo boundaries and trader UI. Narrow the browser ABI to active bindings, centralize safe error presentation, remove redundant contract consumers and event watchers, and configure the single Arc transport and React Query cache for bounded retries and shared reads.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.9 strict mode, Wagmi 2, Viem 2, Tailwind CSS, Foundry/Solidity 0.8.30

## Global Constraints

- Preserve Arc Testnet chain ID `5042002`, deployed OddsX address configuration, trader betting, reward claims, portfolio reads, activity feed, price chart, and role-gated market seeding.
- Do not alter deployed contract storage, behavior, or function signatures.
- Never show raw Viem/RPC JSON errors in the UI.
- Event history must remain bounded to the later of deployment block `53262846` and the latest 1,000-block window.
- Source-owned code must contain no Persian characters or non-English identifiers.
- Final `pnpm typecheck`, `pnpm lint`, and `pnpm build` must exit zero, and the production build must emit no warnings.

---

### Task 1: Remove confirmed dead browser code and dependencies

**Files:**

- Modify: `apps/web/src/providers/Web3Provider.tsx`
- Modify: `apps/web/src/components/MarketCard.tsx`
- Modify: `apps/web/src/hooks/useMarketActions.ts`
- Modify: `apps/web/src/app/globals.css`
- Modify: `packages/config/src/abi/oddsXAbi.ts`
- Modify: `apps/web/package.json` only if an installed package has no runtime, configuration, or tooling consumer

**Interfaces:**

- Preserve the active ABI functions `createMarket`, `getMarket`, `getOutcomePool`, `getUserStake`, `previewReward`, `hasClaimedReward`, `hasRole`, `placeBet`, and `claimReward`.
- Preserve the active events `MarketCreated`, `BetPlaced`, `MarketResolved`, `MarketCancelled`, and `RewardClaimed`.

- [x] **Step 1: Remove unreachable WalletConnect setup**

  Keep the injected connector used by the only wallet button and remove the unused WalletConnect connector, metadata, environment lookup, and warning-producing import path.

- [x] **Step 2: Remove duplicate and orphan market actions**

  Keep reward claiming in `Portfolio`, remove the unconditional resolved-market claim surface from `MarketCard`, and remove the unconsumed `emergencyRefund` callback and unused hook return fields.

- [x] **Step 3: Narrow the browser ABI and CSS tokens**

  Delete only ABI functions/events with zero frontend consumers and remove the unused `--panel`, `--yes`, and `--no` custom properties. Retain the complete Solidity interface and implementation as the protocol source of truth.

- [x] **Step 4: Re-scan dependency consumers**

  Match every direct dependency to an import or configuration consumer. Remove a package only when no direct or configuration usage remains; preserve Recharts and Lightweight Charts because both render distinct chart surfaces.

### Task 2: Harden types, hydration, network state, and errors

**Files:**

- Create: `apps/web/src/lib/errors.ts`
- Modify: `apps/web/src/components/BetForm.tsx`
- Modify: `apps/web/src/components/MarketCard.tsx`
- Modify: `apps/web/src/components/NewMarketModal.tsx`
- Modify: `apps/web/src/components/Portfolio.tsx`
- Modify: `apps/web/src/hooks/useCreateMarket.ts`
- Modify: `apps/web/src/hooks/useMarket.ts`
- Modify: `apps/web/src/hooks/useMarketActions.ts`
- Modify: `apps/web/src/hooks/usePortfolio.ts`
- Modify: `apps/web/src/components/Dashboard.tsx`

**Interfaces:**

- Produce `getSafeErrorMessage(error: unknown, fallback: string): string` for concise wallet, RPC, and transaction errors.
- Contract writes must expose `isConnected`, `isCorrectChain`, and safe disabled states to callers.

- [x] **Step 1: Centralize safe error messages**

  Prefer `shortMessage`, classify rate limits/timeouts/network failures, reject raw serialized RPC payloads, and fall back to concise English copy.

- [x] **Step 2: Harden disconnected and switched-network actions**

  Require a connected address and Arc chain before `placeBet` or `claimReward`, pin writes and receipts to Arc, and expose stable transaction state without retaining actions across a selected-market remount.

- [x] **Step 3: Remove hydration-unstable initial values**

  Initialize the creation expiry as blank and calculate the seven-day local timestamp only when the modal opens in the browser. Keep time-dependent market UI behind its existing effect-driven clock.

- [x] **Step 4: Harden zero-liquidity and portfolio calculations**

  Memoize pool totals, percentages, wager previews, account filters, and portfolio statistics; retain the neutral 50/50 zero-liquidity price and avoid division by zero.

### Task 3: Reduce Arc RPC request pressure

**Files:**

- Modify: `apps/web/src/providers/Web3Provider.tsx`
- Modify: `apps/web/src/hooks/useFeaturedMarkets.ts`
- Modify: `apps/web/src/hooks/usePortfolio.ts`
- Modify: `apps/web/src/hooks/useProtocolActivity.ts`

**Interfaces:**

- Arc HTTP transport uses a finite timeout, bounded retry count, and multicall batching.
- React Query shares fresh reads for at least one Arc block interval and does not refetch all data on window focus.

- [x] **Step 1: Configure transport and query caching**

  Set `pollingInterval: 12_000`, HTTP timeout and retry bounds, multicall batching, query `staleTime`, `gcTime`, and rate-limit-aware retry behavior.

- [x] **Step 2: Remove the low-value market-creation watcher**

  Load the bounded recent market catalog once, add locally confirmed markets through `addMarket`, and retry only failures. Market creation does not justify a permanent 12-second log watcher.

- [x] **Step 3: Consolidate portfolio event history**

  Replace three simultaneous event queries with one bounded all-events contract query, then type-narrow `RewardClaimed`, `MarketResolved`, and `MarketCancelled` logs locally.

- [x] **Step 4: Bound in-memory event collections**

  Cap protocol bets and market references after deduplication so long-lived tabs cannot grow without limit.

### Task 4: Solidity/source hygiene and verification

**Files:**

- Modify: `packages/contracts/script/DeployOddsX.s.sol`
- Modify: `packages/contracts/test/OddsX.t.sol`
- Verify: all source-owned files under `apps/web`, `packages/config`, `packages/contracts/src`, `packages/contracts/script`, and `packages/contracts/test`

**Interfaces:**

- Every source-owned Solidity file begins with `// SPDX-License-Identifier: MIT`.

- [x] **Step 1: Normalize Solidity headers**

  Add MIT SPDX at line 1 of the deploy script and test without changing executable behavior.

- [x] **Step 2: Scan source ownership and encoding**

  Search source-owned paths for Persian Unicode (`U+0600` through `U+06FF`), unresolved imports, deleted symbols, and orphaned files. Vendor libraries and generated outputs are excluded from ownership checks.

- [x] **Step 3: Run formatting and protocol compilation**

  Run Prettier on modified web/config files and `forge fmt` on modified Solidity files, followed by `forge build`.

- [x] **Step 4: Run required workspace gates**

  Run fresh `pnpm typecheck`, `pnpm lint`, and `pnpm build`; inspect full output and require exit code 0 with no production warning lines.
