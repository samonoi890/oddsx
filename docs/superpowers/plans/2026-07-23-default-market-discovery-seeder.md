# Default Market Discovery and Seeder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OddsX immediately useful on first render by loading the known Arc market, replacing Leaderboard with a live market selector, and adding a role-aware test-market seeder.

**Architecture:** A central catalog will define the user-supplied default market and optional test templates. A bounded event-backed hook will combine that known market with recent `MarketCreated` events, validate each candidate via `getMarket`, and feed a compact selector rail; a separate creation hook/modal will submit the existing `createMarket` binding only for authorized wallets and insert confirmed markets into the rail immediately.

**Tech Stack:** Next.js 15, React 19, TypeScript, Wagmi 2, Viem 2, Framer Motion, Lucide React, Tailwind CSS

## Global Constraints

- Auto-load `ETH_ABOVE_5000` at `0x930d9354f76a92946a5f55c30b630e702250e5a2bc1b30c0099edc93729ce5f5`.
- Remove all Leaderboard navigation, rendering, imports, and dead component code.
- Query recent discovery events from no more than the latest 1,000 blocks and retain 12-second watcher polling through the existing Wagmi configuration.
- Show only markets that return valid `getMarket` data; never advertise an undeployed template as active.
- Enforce `MARKET_CREATOR_ROLE` before submitting `createMarket` and keep current wallet as the market oracle.
- Preserve all trader bindings, the Binance price chart, Arc Testnet chain configuration, and the deployed OddsX address.

---

### Task 1: Remove Leaderboard and establish market catalog

**Files:**

- Modify: `apps/web/src/components/Header.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`
- Delete: `apps/web/src/components/Leaderboard.tsx`
- Create: `apps/web/src/lib/marketCatalog.ts`

**Interfaces:**

- `DEFAULT_MARKET` exposes the exact supplied label and `Hex` ID.
- `TEST_MARKET_TEMPLATES` exposes BTC and SOL label/question pairs for the seeder, not the active selector.

- [x] **Step 1: Remove Leaderboard surface**

  Delete the Header tuple, Dashboard import/render, and the now-unreferenced Leaderboard component.

- [x] **Step 2: Define catalog constants**

  Add the exact known default market and two seeding templates: `BTC_ABOVE_100000` and `SOL_ABOVE_300`, each with an explicit resolution question.

- [x] **Step 3: Initialize Dashboard to the known market**

  Replace nullable/blank initial state with `DEFAULT_MARKET.id` and `DEFAULT_MARKET.label`, remove the neutral-selection branch and unused Search icon, and mount MarketCard immediately.

### Task 2: Discover and render valid Arc markets

**Files:**

- Create: `apps/web/src/hooks/useFeaturedMarkets.ts`
- Create: `apps/web/src/components/FeaturedMarkets.tsx`

**Interfaces:**

- `useFeaturedMarkets()` produces validated `{ id, label, market }[]`, `isLoading`, sanitized `error`, `isRateLimited`, and `addMarket(id,label)`.
- `FeaturedMarkets` consumes those markets plus active ID and `onSelect(id,label)`.

- [x] **Step 1: Implement bounded discovery**

  Seed references with `DEFAULT_MARKET`, fetch recent strict `MarketCreated` events from `getRecentEventFromBlock(latestBlock)` through `latestBlock`, subscribe to new events, cap references at 12, sanitize rate-limit failures, and retry rate limits every 30 seconds.

- [x] **Step 2: Validate market references**

  Read each reference with typed `getMarket`, discard failed/nonexistent candidates, preserve known labels over event-derived short IDs, and expose a stable callback that inserts newly confirmed markets.

- [x] **Step 3: Build compact featured rail**

  Render responsive horizontally scrollable market buttons with label, description, state, total pool, and selected execution trace. Loading and discovery-error states must leave the default trading book unaffected.

### Task 3: Role-aware quick test market seeder

**Files:**

- Create: `apps/web/src/hooks/useCreateMarket.ts`
- Create: `apps/web/src/components/NewMarketModal.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`

**Interfaces:**

- `useCreateMarket(onConfirmed)` exposes `createMarket({label,description,endTime})`, authorization/loading/receipt states, transaction hash, and sanitized error.
- `NewMarketModal` consumes `open`, `onClose`, and `onCreated(id,label)`.

- [x] **Step 1: Reintroduce the scoped creation hook**

  Query `MARKET_CREATOR_ROLE`, hash normalized labels, create two-outcome native-USDC markets with the connected wallet as oracle, pin writes/receipts to Arc, and deduplicate confirmation callbacks.

- [x] **Step 2: Build seeder modal**

  Start custom fields blank, offer BTC/SOL template buttons, validate normalized label, question, and future expiry without unsafe date conversion, explain role requirements, and provide pending/confirmed ArcScan states.

- [x] **Step 3: Integrate search, selector, and seeder**

  Place a subtle `+ New Market` button directly beside MarketLookup, render FeaturedMarkets above the betting book, switch markets immediately on selector click, and add confirmed seeds to the rail before selecting them.

### Task 4: Verification

**Files:**

- Verify: all modified files and workspace packages

**Interfaces:**

- Produces: catalog hash, dead-code, trader-binding, formatting, lint, typecheck, and production-build evidence.

- [x] **Step 1: Verify default identity and surface cleanup**

  Run `cast keccak ETH_ABOVE_5000` and compare it to `DEFAULT_MARKET.id`; search for Leaderboard/Top conviction references and ensure no matches remain.

- [x] **Step 2: Audit trader and creation bindings**

  Confirm `getMarket`, `getOutcomePool`, `placeBet`, `claimReward`, `BetPlaced`, `MarketCreated`, role verification, and `createMarket` remain correctly typed.

- [x] **Step 3: Run formatting, lint, and workspace typecheck**

  Run Prettier, `pnpm lint`, and `pnpm typecheck`. Expected: exit code 0.

- [x] **Step 4: Run workspace production build**

  Run `pnpm build`. Expected: exit code 0 with the `/` route statically generated.
