# OddsX Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate the July 2026 OddsX audit findings across the Solidity protocol, Arc integration, trader lifecycle UI, and automated test suite.

**Architecture:** Preserve the existing pari-mutuel accounting and role model while adding explicit zero-winner cancellation, execution bounds, and an optional per-market resolution delay. Expose exact market-and-pool snapshots through one view call, drive the UI from contract events with a timed fallback, paginate historical event reads, and add a compact settlement/refund surface inside the existing dashboard.

**Tech Stack:** Solidity 0.8.30, OpenZeppelin Contracts, Foundry, Next.js 16, React 19, TypeScript 5.9, Wagmi 2, Viem 2, TanStack Query.

**Execution status:** Implemented in full on 2026-07-28; final verification commands are recorded in the delivery response.

## Global Constraints

- Preserve the legacy `placeBet(bytes32,uint32,uint256)` entrypoint for integrations.
- Native Arc Testnet USDC uses 18 decimals and `address(0)`.
- New bet bounds protect execution-time estimates; later pari-mutuel bets can still change final payouts.
- Existing role semantics remain available and can be assigned to a multisig.
- No new runtime dependency is required.

---

### Task 1: Protocol lifecycle and execution bounds

**Files:**

- Modify: `packages/contracts/src/interfaces/IOddsX.sol`
- Modify: `packages/contracts/src/OddsX.sol`
- Modify: `packages/contracts/script/DeployOddsX.s.sol`

**Interfaces:**

- Produces: `placeBetWithBounds(bytes32,uint32,uint256,uint256,uint64)`, `getMarketWithPools(bytes32)`, `getMarketResolutionDelay(bytes32)`, and zero-winner cancellation events.
- Produces: constructor `(address initialAdmin, uint16 initialFeeBps, uint64 initialResolutionDelay)` and multisig-ready `ODDSX_ADMIN` deployment configuration.

- [ ] Add a dedicated zero-winner cancellation event and reason constant.
- [ ] Make `resolveMarket` set `Cancelled`, emit normal and dedicated cancellation events, and return when the reported winner has no stake.
- [ ] Add a snapshotted default resolution delay with a bounded admin setter and events.
- [ ] Add `placeBetWithBounds`; enforce deadline and minimum execution-time expected reward before collecting funds.
- [ ] Keep the legacy bet function as an unbounded wrapper over shared internal accounting.
- [ ] Add `getMarketWithPools` so one `eth_call` returns a coherent market/pool snapshot.
- [ ] Allow deployment admin and initial delay to be supplied independently of the broadcasting EOA.

### Task 2: Protocol regression, access, edge, and fuzz tests

**Files:**

- Modify: `packages/contracts/test/OddsX.t.sol`

**Interfaces:**

- Consumes: all Task 1 protocol interfaces.
- Produces: deterministic and fuzz coverage for custody, permissions, cancellation, bounds, fees, and claims.

- [ ] Update setup for the new constructor and add role constants/helpers.
- [ ] Test zero-winner resolution cancellation, dedicated events, and refunds for both outcomes.
- [ ] Test unauthorized creation, resolution, cancellation, delay configuration, and fee withdrawal.
- [ ] Test double claims, invalid and expired bets, duplicate markets, premature/delayed resolution, and fee withdrawals.
- [ ] Test bounded-bet deadlines and minimum expected reward failures/success.
- [ ] Add fuzz tests for proportional rewards and cancelled-market refunds with bounded stakes.
- [ ] Run `pnpm test` and require zero failures.

### Task 3: Shared ABI and coherent live market reads

**Files:**

- Modify: `packages/config/src/abi/oddsXAbi.ts`
- Modify: `packages/config/src/contracts.ts`
- Modify: `apps/web/src/hooks/useMarket.ts`
- Modify: `apps/web/src/hooks/useMarketActions.ts`

**Interfaces:**

- Consumes: Task 1 contract ABI.
- Produces: event-driven coherent market snapshots and bounded native bets.

- [ ] Add all new functions, errors where useful, and lifecycle events to the frontend ABI.
- [ ] Reject invalid configured addresses immediately instead of silently using the fallback.
- [ ] Replace split market/pool reads with `getMarketWithPools` and a 12-second fallback refetch interval.
- [ ] Watch `BetPlaced`, `MarketResolved`, and `MarketCancelled` and refetch the selected market on matching logs.
- [ ] Pass a five-minute deadline and client-computed minimum expected reward through bounded bets.
- [ ] Run config/web typechecking.

### Task 4: Paginated activity and honest portfolio labels

**Files:**

- Modify: `apps/web/src/lib/rpc.ts`
- Modify: `apps/web/src/hooks/useFeaturedMarkets.ts`
- Modify: `apps/web/src/hooks/usePortfolio.ts`
- Modify: `apps/web/src/components/Dashboard.tsx`
- Modify: `apps/web/src/components/Portfolio.tsx`

**Interfaces:**

- Produces: `collectEventPages<T>` for bounded sequential RPC pagination.
- Produces: wallet-specific bet/reward history independent of the capped protocol tape.

- [ ] Add a generic, deployment-bounded event pagination helper with fixed-size pages.
- [ ] Page market discovery from deployment rather than only the latest 1,000 blocks.
- [ ] Page wallet-filtered `BetPlaced` and `RewardClaimed` events and read entered-market states by multicall.
- [ ] Remove portfolio totals' dependency on the 100-entry activity tape.
- [ ] Rename dashboard metrics and section copy to “Recent activity” until an indexer is available.
- [ ] Preserve bounded latest-block activity polling for the public tape.

### Task 5: Settlement, cancellation, refund, and liquidity UI

**Files:**

- Create: `apps/web/src/hooks/useMarketLifecycleActions.ts`
- Create: `apps/web/src/components/MarketLifecyclePanel.tsx`
- Modify: `apps/web/src/components/MarketCard.tsx`
- Modify: `apps/web/src/components/BetForm.tsx`
- Modify: `apps/web/src/components/Portfolio.tsx`

**Interfaces:**

- Produces: role-aware `resolveMarket`, `cancelMarket`, and `emergencyRefund` actions with receipt tracking.

- [ ] Build a lifecycle hook that checks resolver/canceller eligibility and tracks write receipts/errors.
- [ ] Add a compact settlement panel for the designated oracle, resolver role, or canceller role.
- [ ] Add YES/NO refund controls for cancelled positions and refetch after each receipt.
- [ ] Replace “Oracle verified” with “Designated oracle”.
- [ ] Render “No liquidity” and neutral unpriced outcome controls instead of a synthetic 50/50 price.
- [ ] Show the bounded-bet slippage/deadline policy beside potential return.
- [ ] Maintain mobile stacking, keyboard focus visibility, and the existing terminal-like market visual language.

### Task 6: Documentation, changelog, and final verification

**Files:**

- Create: `CHANGELOG.md`
- Modify: `README.md`

**Interfaces:**

- Documents the redeployment requirement, new lifecycle behavior, execution-bound limitations, and operator workflow.

- [ ] Add a dated changelog grouped by protocol, frontend, testing, and operational changes.
- [ ] Update architecture, function, security, deployment, and testing documentation.
- [ ] Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check`.
- [ ] Review the final diff for ABI/source parity and confirm no unrelated files changed.
