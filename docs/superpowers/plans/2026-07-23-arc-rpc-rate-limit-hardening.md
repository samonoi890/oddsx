# Arc RPC Rate-Limit Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Arc Testnet `eth_getLogs` pressure and replace raw JSON-RPC rate-limit errors with a stable, user-facing retry state.

**Architecture:** Historical event loaders will compute one bounded query window from the latest block and reuse it for all event requests. Wagmi's client polling cadence will be increased to 12 seconds, portfolio history will stop reloading for every bet event, and both event-driven surfaces will receive explicit sanitized rate-limit state.

**Tech Stack:** Next.js 15, React 19, TypeScript, Wagmi 2, Viem 2, Tailwind CSS

## Global Constraints

- Never query an event range earlier than block `53_262_846`.
- Limit each initial historical event query to the latest 1,000 blocks.
- Use a `12_000` millisecond Wagmi/Viem polling interval.
- Never render raw Arc JSON-RPC rate-limit payloads.
- Preserve Arc Testnet chain ID `5_042_002` and the deployed OddsX contract binding.

---

### Task 1: Shared bounded event-query policy

**Files:**

- Create: `apps/web/src/lib/rpc.ts`
- Modify: `apps/web/src/hooks/useProtocolActivity.ts`
- Modify: `apps/web/src/hooks/usePortfolio.ts`

**Interfaces:**

- Produces: `ODDSX_DEPLOYMENT_BLOCK`, `getRecentEventFromBlock(latestBlock)`, `getRpcErrorState(caught, fallbackMessage)` and `RPC_RATE_LIMIT_MESSAGE`.
- Consumes: the latest Arc block number returned by Viem.

- [x] **Step 1: Add a shared RPC helper**

  Define the deployment block, a 1,000-block inclusive query window, guarded error traversal for Viem's nested `cause`, and clean rate-limit/generic history messages.

- [x] **Step 2: Bound activity history**

  Fetch the current block once, query `BetPlaced` from `max(deploymentBlock, latestBlock - 999)`, and expose an `isRateLimited` flag.

- [x] **Step 3: Bound portfolio history**

  Reuse one latest block and one bounded `fromBlock` for all three event queries. Remove `bets` from the history effect dependency so a new bet does not issue three more historical queries.

### Task 2: Slow polling and sanitize UI errors

**Files:**

- Modify: `apps/web/src/providers/Web3Provider.tsx`
- Modify: `apps/web/src/components/ActivityFeed.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`
- Modify: `apps/web/src/components/Portfolio.tsx`

**Interfaces:**

- Consumes: `isRateLimited` from the activity and portfolio hooks.
- Produces: the exact fallback copy `Live activity paused due to RPC rate limit. Retrying shortly...`.

- [x] **Step 1: Configure 12-second polling**

  Set Wagmi `createConfig({ pollingInterval: 12_000 })`, which is inherited by the HTTP public client and contract event watcher.

- [x] **Step 2: Render explicit fallback states**

  Pass the activity rate-limit flag through the dashboard and show the clean banner in both Activity Feed and Portfolio. Keep non-rate-limit history failures generic and keep transaction errors distinct.

### Task 3: Verification

**Files:**

- Verify: all files modified by Tasks 1 and 2

- [x] **Step 1: Run static checks**

  Run `pnpm --filter @oddsx/web typecheck`, `pnpm --filter @oddsx/web lint`, and Prettier checks. Expected: exit code 0 for each command.

- [x] **Step 2: Run the production build**

  Run `pnpm --filter @oddsx/web build`. Expected: exit code 0 with the `/` route generated.

- [x] **Step 3: Audit all event calls**

  Search `apps/web/src` for `getContractEvents`, `getLogs`, `fromBlock`, `pollingInterval`, and raw error rendering. Confirm every historical event query uses the bounded range and no rate-limit payload can reach the UI.
