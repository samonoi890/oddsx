# Trader-Only Frontend Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all admin, resolver, and market-creation UI from `apps/web` while preserving the complete trader experience.

**Architecture:** Header and dashboard composition will expose only Markets, Portfolio, and Leaderboard. Privileged components and hooks that become unreachable will be deleted; the shared contract ABI remains unchanged because it describes the deployed contract, while trader hooks continue using the existing market reads, betting, claims, and event feed bindings.

**Tech Stack:** Next.js 15, React 19, TypeScript, Wagmi 2, Viem 2, Framer Motion, Tailwind CSS

## Global Constraints

- Remove Admin and Create Market navigation/actions from `apps/web`.
- Remove the resolver panel and market-creation modal from dashboard composition.
- Preserve `placeBet`, `claimReward`, market/pool reads, portfolio reads, and protocol activity events.
- Do not alter Arc Testnet chain configuration or the deployed OddsX address.

---

### Task 1: Trader-only navigation and composition

**Files:**

- Modify: `apps/web/src/components/Header.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`

**Interfaces:**

- Header navigation produces exactly Markets, Portfolio, and Leaderboard links.
- Dashboard retains market lookup, market card, activity, conditional portfolio, and leaderboard composition.

- [x] **Step 1: Simplify Header navigation**

  Delete the `Admin` navigation tuple, Create Market event button, and unused `Plus` icon import.

- [x] **Step 2: Remove privileged Dashboard state**

  Delete `AdminPanel` and `CreateMarketModal` imports, modal state, global create-market event listener, rendered admin section, and rendered creation modal. Remove the resulting unused React imports.

### Task 2: Delete unreachable privileged frontend modules

**Files:**

- Delete: `apps/web/src/components/AdminPanel.tsx`
- Delete: `apps/web/src/components/CreateMarketModal.tsx`
- Delete: `apps/web/src/hooks/useAdminActions.ts`
- Delete: `apps/web/src/hooks/useResolverRole.ts`
- Delete: `apps/web/src/hooks/useCreateMarket.ts`

**Interfaces:**

- Preserves: `useMarket`, `useMarketActions`, `usePortfolio`, `useProtocolActivity`, `BetForm`, `MarketCard`, and `Portfolio`.

- [x] **Step 1: Delete admin/resolver modules**

  Remove the panel and its two exclusive hooks after their dashboard import is gone.

- [x] **Step 2: Delete market-creation modules**

  Remove the creation modal and its exclusive write hook after the header event and dashboard modal are gone.

### Task 3: Verification

**Files:**

- Verify: `apps/web/`
- Verify: workspace packages

**Interfaces:**

- Produces: source-audit, formatting, typecheck, and production-build evidence.

- [x] **Step 1: Audit frontend surface**

  Search `apps/web/src` for `AdminPanel`, `CreateMarketModal`, privileged hook names, creation event names, and management write names. Expected: no matches. Separately confirm trader read/write/event names remain present.

- [x] **Step 2: Run formatting and lint**

  Run Prettier on modified files and `pnpm lint`. Expected: exit code 0.

- [x] **Step 3: Run workspace typecheck**

  Run `pnpm typecheck`. Expected: exit code 0 across contracts, config, and web.

- [x] **Step 4: Run workspace build**

  Run `pnpm build`. Expected: exit code 0 and successful generation of the `/` route.
