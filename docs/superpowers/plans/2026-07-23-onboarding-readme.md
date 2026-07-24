# Onboarding and Repository Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dismissible four-step trader onboarding path and replace the root README with an accurate production-grade guide to OddsX architecture, mechanics, setup, and operations.

**Architecture:** `HowItWorks` will be a self-contained client component that owns collapse and persisted dismissal state without affecting market state. `Dashboard` will render it immediately before market discovery and the active book. The README will document the current monorepo, deployed Arc configuration, contract math and roles, RPC resilience, environment setup, and verified workspace commands; the root package will expose the requested `pnpm test` alias.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion, Lucide React, Wagmi, Viem, TanStack Query, Solidity, Foundry, pnpm workspaces

## Global Constraints

- Preserve all Arc Testnet contract bindings and trader behavior.
- Use exactly four sequential onboarding steps: Connect Wallet, Analyze Odds, Cast Prediction, and Claim Payout.
- Use the requested Wallet, TrendingUp, Coins, and Trophy icons.
- Persist dismissal in browser local storage without introducing server/client hydration differences.
- Document Arc chain ID `5042002`, OddsX contract `0xA5649df055BF83505Dc41D014c18F8eD412C764C`, and RPC `https://rpc.testnet.arc.network`.
- The README must distinguish current implementation from production security recommendations.
- `pnpm build` must exit zero without warnings.

---

### Task 1: Four-step trader onboarding

**Files:**

- Create: `apps/web/src/components/HowItWorks.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`

**Interfaces:**

- Produce `HowItWorks(): JSX.Element` with internal expanded/dismissed state.
- Consume no wallet or contract state; onboarding remains presentation-only.

- [x] **Step 1: Build the transaction-path card**

  Define the four requested steps as typed component data, render a cyan execution rail behind sequential numbered nodes, and use restrained hover and staggered reveal motion. Include plain-language pari-mutuel copy and responsive one-, two-, and four-column layouts.

- [x] **Step 2: Add collapse and persisted dismissal**

  Use an effect to read `oddsx:how-it-works:dismissed` after hydration. Collapse preserves the full card header; dismissal stores `true` and replaces the card with a compact reopen control that clears the key.

- [x] **Step 3: Integrate above the active market**

  Import and render `HowItWorks` after the market heading/search row and before `FeaturedMarkets`, keeping existing market selection and betting layout unchanged.

### Task 2: Production-grade repository README

**Files:**

- Replace: `README.md`
- Modify: `package.json`

**Interfaces:**

- `pnpm test` delegates to `pnpm contracts:test`.
- README commands exactly match root package scripts and Foundry configuration.

- [x] **Step 1: Document product and network identity**

  Add a concise project thesis, current Arc Testnet chain/RPC/explorer/contract table, monorepo layout, full stack, and native USDC settlement assumptions.

- [x] **Step 2: Document contract mechanics and security**

  Specify total pool, protocol fee, distributable pool, and pro-rata reward formulas; list active trader/market lifecycle functions; document all AccessControl roles and honest production-hardening guidance.

- [x] **Step 3: Document RPC resilience and frontend flow**

  Explain 12-second polling, bounded 1,000-block scans from deployment block 53,262,846, multicall/query caching, timeout/retry behavior, sanitized errors, activity limits, and the external Binance reference chart's non-oracle status.

- [x] **Step 4: Document setup, deployment, and commands**

  Provide prerequisites, clone/install/environment steps, web development, contract testing, Arc deployment, frontend address update, command table, and troubleshooting. Add the requested root `test` alias.

### Task 3: Verification

**Files:**

- Verify: `apps/web/src/components/HowItWorks.tsx`, `apps/web/src/components/Dashboard.tsx`, `README.md`, and `package.json`

**Interfaces:**

- Production route remains statically generated and the onboarding component introduces no type, lint, or build warnings.

- [x] **Step 1: Format and run static gates**

  Run Prettier on modified files, `pnpm typecheck`, and `pnpm lint`; require exit zero and no warnings.

- [x] **Step 2: Verify contract command alias**

  Run `pnpm test`; require all seven offline Foundry tests to pass.

- [x] **Step 3: Run the production build**

  Run `pnpm build`; require exit zero, no warnings, and a statically generated `/` route.
