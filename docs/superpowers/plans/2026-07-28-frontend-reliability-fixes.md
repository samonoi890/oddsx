# Frontend Reliability Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep OddsX dialogs inside the viewport, make the Arc protocol tape recover reliably, and make market-creator permissions clear before a user attempts a transaction.

**Architecture:** Render the shared modal at the document root so sticky/backdrop-filter ancestors cannot redefine its fixed-position containing block. Replace filter-style contract watching with deployment-bounded history plus a last-successful-block polling cursor over the configured HTTP RPC, preserving cached events during retries. Centralize the market-creator role read so both the dashboard action and creation modal use the same access semantics.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 3, Wagmi 2, Viem 2, Framer Motion.

**Execution status:** Implemented and verified on 2026-07-28.

## Global Constraints

- Keep the current OddsX palette, typography, glass panels, spacing, and button language.
- Arc Testnet remains chain ID `5042002` and the feed remains bounded to the recent deployment window.
- Do not expose an admin role-grant transaction in the public dashboard.
- Preserve keyboard focus trapping, Escape dismissal, backdrop dismissal, and body scroll locking.
- Add no runtime dependencies.

---

### Task 1: Viewport-rooted modal

**Files:**

- Modify: `apps/web/src/components/Modal.tsx`

**Interfaces:**

- Consumes: existing `ModalProps` without call-site changes.
- Produces: the existing animated dialog rendered through `createPortal(..., document.body)` after client mount.

- [x] Add a mounted flag in `Modal` and set it in a client-only effect.
- [x] Wrap the existing `AnimatePresence` tree with `createPortal` so `fixed inset-0` resolves against the viewport rather than the blurred sticky header.
- [x] Center the dialog at every breakpoint with viewport-relative height limits and responsive outer padding.
- [x] Run `pnpm --filter @oddsx/web typecheck` and require exit code 0.

### Task 2: Recoverable Arc activity polling

**Files:**

- Modify: `apps/web/src/hooks/useProtocolActivity.ts`
- Modify: `apps/web/src/components/ActivityFeed.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`

**Interfaces:**

- Produces: `retry(): void` alongside `bets`, `isLoading`, `error`, and `isRateLimited`.
- Consumes: the existing `getRecentEventFromBlock`, `getRpcErrorState`, contract address, and `BetPlaced` ABI.

- [x] Replace `useWatchContractEvent` with one immediate history sync and a 12-second polling interval using `publicClient.getBlockNumber()` plus `getContractEvents()`.
- [x] Store the last successfully scanned block in a ref; query from `lastBlock + 1` on later polls, and only advance the cursor after a successful request.
- [x] Prevent overlapping syncs and clear the error after any successful poll, including a poll with no logs.
- [x] Retry on the normal 12-second cadence and when the browser returns online; expose a manual `retry` callback.
- [x] Preserve existing bets if a later poll fails, show a compact reconnecting banner above them, and show a retry action in the full error state when no activity is cached.
- [x] Label the status `reconnecting` for all errors, `syncing` during initial load, and `streaming` only after a healthy sync.
- [x] Pass `activity.retry` from `Dashboard` to `ActivityFeed`.

### Task 3: Market-creator access UX

**Files:**

- Create: `apps/web/src/hooks/useMarketCreatorRole.ts`
- Modify: `apps/web/src/hooks/useCreateMarket.ts`
- Modify: `apps/web/src/components/Dashboard.tsx`
- Modify: `apps/web/src/components/NewMarketModal.tsx`

**Interfaces:**

- Produces: `useMarketCreatorRole()` returning `{ address, isConnected, isCheckingRole, canCreate, roleError, refetchRole }`.
- Consumes: `MARKET_CREATOR_ROLE = keccak256(stringToHex("MARKET_CREATOR_ROLE"))` and the OddsX `hasRole` call on Arc Testnet.

- [x] Move the role read into `useMarketCreatorRole` and reuse it from the transaction hook.
- [x] Render “New Market” only when the connected address has `MARKET_CREATOR_ROLE`.
- [x] For a connected wallet without permission, render a quiet shield indicator reading “Market creation restricted” instead of an actionable button.
- [x] In the open modal, replace the raw Solidity role-name sentence with plain-language guidance to connect an approved wallet or ask the OddsX admin for market-creator access.
- [x] Distinguish a failed role check from a confirmed missing role and add a `Check again` action using `refetchRole`.

### Task 4: Verification

**Files:**

- Verify: all Task 1–3 files.

**Interfaces:**

- Confirms: no type, lint, production-build, formatting, or whitespace regressions.

- [x] Run `pnpm --filter @oddsx/web typecheck` and require exit code 0.
- [x] Run `pnpm --filter @oddsx/web lint` and require exit code 0.
- [x] Run `pnpm --filter @oddsx/web build` and require exit code 0.
- [x] Run `pnpm exec prettier --check` on the changed source files and require exit code 0.
- [x] Run `git diff --check` and inspect `git diff --stat` plus the full diff for unrelated edits.
