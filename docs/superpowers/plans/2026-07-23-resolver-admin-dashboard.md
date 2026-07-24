# Resolver and Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Arc Testnet resolver/admin workspace for role-aware market resolution, emergency cancellation, default-fee updates, and protocol-fe withdrawal.

**Architecture:** Typed ABI additions will expose the deployed contract's existing management surface. A dedicated role hook will query admin, resolver, canceller, and fee-manager capabilities; an action hook will own reads, writes, receipts, and fee refetching; and `AdminPanel` will gate entry by admin/resolver status while additionally enforcing the exact onchain role required for each operation.

**Tech Stack:** Next.js 15, React 19, TypeScript, Wagmi 2, Viem 2, Framer Motion, Lucide React, Tailwind CSS

## Global Constraints

- Bind only to OddsX `0xA5649df055BF83505Dc41D014c18F8eD412C764C` through the existing Arc Testnet configuration, chain ID `5_042_002`.
- Preserve existing market, betting, portfolio, and wallet flows.
- Gate dashboard access to a connected wallet holding `DEFAULT_ADMIN_ROLE` or `RESOLVER_ROLE`.
- Enforce the deployed contract signatures: `resolveMarket(bytes32,uint32)`, `cancelMarket(bytes32,bytes32)`, `setDefaultProtocolFee(uint16)`, and `withdrawProtocolFees(address,address,uint256)`.
- Never imply that `DEFAULT_ADMIN_ROLE` bypasses the contract's distinct resolver, canceller, or fee-manager checks.

---

### Task 1: Typed management contract surface

**Files:**

- Modify: `packages/config/src/abi/oddsXAbi.ts`
- Create: `apps/web/src/hooks/useResolverRole.ts`
- Create: `apps/web/src/hooks/useAdminActions.ts`

**Interfaces:**

- `useResolverRole()` produces `isResolver`, `isAdmin`, `hasResolverRole`, `canCancel`, `canManageFees`, `isLoading`, `error`, and `refetch`.
- `useAdminActions()` produces current/default fee state, resolve/cancel/fee write callbacks, transaction receipt state, action label, error, and confirmation counter.

- [x] **Step 1: Extend the ABI**

  Add typed entries for resolver and fee functions, `defaultProtocolFeeBps`, `accruedProtocolFees`, and their management events using the exact Solidity types.

- [x] **Step 2: Implement role verification**

  Compute OpenZeppelin's zero-hash admin role and keccak-derived named roles, query all four with one `useReadContracts` call, and return stable false/loading states while disconnected.

- [x] **Step 3: Implement receipt-aware admin actions**

  Read native Arc fee accrual at `address(0)`, submit chain-pinned management writes, refetch fee data after confirmation, and expose one deduplicated confirmation counter.

### Task 2: Resolver/admin interface

**Files:**

- Create: `apps/web/src/components/AdminPanel.tsx`

**Interfaces:**

- Consumes: `useResolverRole`, `useAdminActions`, `normalizeMarketId`, `useMarket`, connected account state, and existing formatting utilities.
- Produces: `<section id="admin">` with access gating, market inspection, outcome resolution, emergency cancellation, and protocol-fe controls.

- [x] **Step 1: Build access states**

  Render distinct disconnected, loading, role-query failure, and exact unauthorized notices before rendering privileged controls.

- [x] **Step 2: Build market resolution controls**

  Start lookup blank, inspect a user-supplied label/ID, show live market state/end time/pools, enable outcomes only for expired open markets, and disable zero-liquidity winning outcomes that would revert.

- [x] **Step 3: Build emergency cancellation controls**

  Require a human-readable incident reason, hash it to the contract's `bytes32` reason, require `CANCELLER_ROLE`, and allow cancellation only while the market is open.

- [x] **Step 4: Build fee controls and transaction feedback**

  Display native-USDC accrued fees and default basis points, validate updates within `0..1000`, withdraw all accrued fees to the connected fee-manager wallet, and show pending/confirmed/failed states with ArcScan links.

### Task 3: Navigation and page integration

**Files:**

- Modify: `apps/web/src/components/Header.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`

**Interfaces:**

- Produces: an `Admin` navigation target linked to `#admin` and one mounted `AdminPanel` in the dashboard.

- [x] **Step 1: Add the Admin navigation entry**

  Extend the existing primary navigation array with `Admin` while preserving wallet and create-market behavior.

- [x] **Step 2: Mount the management workspace**

  Render `AdminPanel` inside the main dashboard below user-facing trading and portfolio surfaces.

### Task 4: Verification

**Files:**

- Verify: workspace packages and all modified files

**Interfaces:**

- Produces: fresh formatting, lint, typecheck, production-build, and ABI/signature audit evidence.

- [x] **Step 1: Run formatting and lint**

  Run Prettier on modified files and `pnpm lint`. Expected: exit code 0.

- [x] **Step 2: Run workspace typecheck**

  Run `pnpm typecheck`. Expected: exit code 0 across config and web packages.

- [x] **Step 3: Run workspace production build**

  Run `pnpm build`. Expected: exit code 0 with the `/` route generated.

- [x] **Step 4: Audit management signatures**

  Search the Solidity contract, ABI, and hooks for all four management signatures and role names. Confirm argument widths/order match and no action is exposed under a broader UI capability than the contract accepts.
