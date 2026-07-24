# Web3 Trading UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the OddsX web app into a responsive Arc-native prediction-market trading surface with live contract data, animated execution, portfolio analytics, admin creation, activity, and leaderboard views.

**Architecture:** Preserve `@oddsx/config` as the ABI/address source and the existing Wagmi provider as the only network layer. Components consume a shared selected `marketId`; market reads remain query-backed, writes wait for receipts, and activity/portfolio data is reconstructed from OddsX events beginning at deployment block `53262846` instead of mock data.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.9, Tailwind CSS 3, Wagmi 2, Viem 2, Framer Motion, Recharts, Lucide React, Arc Testnet 5042002.

## Global Constraints

- Keep contract `0xA5649df055BF83505Dc41D014c18F8eD412C764C` and Arc Testnet chain ID `5042002` unchanged.
- Do not fabricate market, bet, portfolio, leaderboard, or activity data.
- Preserve safe amount parsing, expiry gating, one-shot receipt callbacks, and wallet connectivity.
- Support keyboard focus, mobile layout, semantic labels, and reduced motion.
- Use native Arc USDC with 18 decimals for displayed balances and native bets.

---

### Task 1: Install and configure the visual stack

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/layout.tsx`

**Interfaces:**
- Produces: Tailwind utility compilation, local display/body fonts, global glass and focus primitives.

- [ ] **Step 1: Install pinned runtime and styling dependencies**

Run: `pnpm --filter @oddsx/web add framer-motion recharts lucide-react @fontsource-variable/space-grotesk @fontsource-variable/manrope`

Run: `pnpm --filter @oddsx/web add -D tailwindcss@3.4.17 postcss autoprefixer`

- [ ] **Step 2: Configure Tailwind content and theme tokens**

```ts
content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
theme: { extend: { colors: { ink: "#020617", yes: "#34d399", no: "#fb7185" } } },
```

- [ ] **Step 3: Replace legacy selectors with Tailwind layers and global atmosphere**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
body { background: #020617; color: #e2e8f0; }
```

### Task 2: Extend typed ABI and event data hooks

**Files:**
- Modify: `packages/config/src/abi/oddsXAbi.ts`
- Create: `apps/web/src/hooks/useProtocolActivity.ts`
- Create: `apps/web/src/hooks/usePortfolio.ts`
- Create: `apps/web/src/hooks/useCreateMarket.ts`
- Modify: `apps/web/src/hooks/useMarket.ts`

**Interfaces:**
- Consumes: OddsX events and functions at the configured Arc address.
- Produces: live `ProtocolBet[]`, portfolio aggregates, admin access, and `createMarket(...)` receipt state.

- [ ] **Step 1: Add exact contract entries**

Add `createMarket`, `hasRole`, `previewReward`, `hasClaimedReward`, `BetPlaced`, `MarketResolved`, `MarketCancelled`, and `RewardClaimed` with exact Solidity widths/indexing.

- [ ] **Step 2: Read historical activity and subscribe to new bets**

```ts
publicClient.getContractEvents({ address, abi: oddsXAbi, eventName: "BetPlaced", fromBlock: 53_262_846n });
useWatchContractEvent({ address, abi: oddsXAbi, eventName: "BetPlaced", onLogs });
```

- [ ] **Step 3: Aggregate wallet metrics from indexed events**

Compute total wagered, active market count, resolved markets entered, rewards, and win rate from live event logs; load selected-market stakes with `useReadContracts` for the position list.

- [ ] **Step 4: Implement receipt-backed market creation**

Hash the exact label with `keccak256(stringToHex(label))`, call `createMarket` with native asset zero address and connected-wallet oracle, then expose pending/confirmed/error states.

### Task 3: Build navigation and modal framework

**Files:**
- Modify: `apps/web/src/components/Header.tsx`
- Create: `apps/web/src/components/Modal.tsx`
- Create: `apps/web/src/components/CreateMarketModal.tsx`

**Interfaces:**
- Consumes: account, native balance, chain state, connectors, admin role.
- Produces: anchor navigation, Arc live badge, wallet control, and accessible animated create-market overlay.

- [ ] **Step 1: Build the responsive trading header**

Show logo, Markets/Portfolio/Leaderboard/Create Market controls, live Arc badge, formatted USDC balance, deterministic gradient avatar, and connect/disconnect behavior.

- [ ] **Step 2: Build an accessible animated modal**

Use `AnimatePresence`, backdrop click, Escape handling, labelled dialog semantics, focusable close button, and scroll locking.

- [ ] **Step 3: Build the admin form**

Validate label, description, expiry, and connected admin role; use the current account as oracle and native Arc USDC as asset.

### Task 4: Build market discovery, visualization, and execution

**Files:**
- Modify: `apps/web/src/components/MarketLookup.tsx`
- Modify: `apps/web/src/components/MarketCard.tsx`
- Modify: `apps/web/src/components/BetForm.tsx`
- Create: `apps/web/src/components/BetModal.tsx`
- Modify: `apps/web/src/lib/format.ts`

**Interfaces:**
- Consumes: `MarketView`, outcome pools, wallet balance, and `placeNativeBet`.
- Produces: sampled odds chart, YES/NO rail, countdown, volume, projected multiplier/return/share, presets, and confirmation UI.

- [ ] **Step 1: Lift selected market ID to the dashboard**

Keep readable-label hashing and expose the selected ID to portfolio and market components.

- [ ] **Step 2: Derive truthful binary odds**

```ts
const yesPercent = totalPool === 0n ? 50 : Number((yesPool * 10_000n) / totalPool) / 100;
const noPercent = 100 - yesPercent;
```

- [ ] **Step 3: Sample live odds while mounted**

Append timestamped YES/NO percentages when pools change and render them with Recharts; label the chart “Live session” so it does not imply unavailable historical indexing.

- [ ] **Step 4: Implement modal execution math**

Calculate projected payout from post-bet pool proportions and fee BPS, show estimated pool share, provide 10/50/MAX presets, validate uint256/native balance, and retain receipt confirmation behavior.

### Task 5: Build portfolio, activity, and leaderboard surfaces

**Files:**
- Create: `apps/web/src/components/Portfolio.tsx`
- Create: `apps/web/src/components/ActivityFeed.tsx`
- Create: `apps/web/src/components/Leaderboard.tsx`

**Interfaces:**
- Consumes: protocol bet/reward events and selected-market reads.
- Produces: wallet KPIs, current positions, claim action, chronological event tape, and bettor-volume rankings.

- [ ] **Step 1: Render wallet metrics and positions**

Show connected-wallet total wagered, win rate, active unique markets, total rewards, selected-market YES/NO stakes, preview reward, and receipt-backed claim action.

- [ ] **Step 2: Render live activity**

Show the latest real BetPlaced events with bettor, side, amount, transaction link, and animated insertion; show an instructive empty state when no events exist.

- [ ] **Step 3: Aggregate leaderboard volume**

Group real BetPlaced logs by bettor, sum wagered USDC, rank descending, and highlight the connected wallet.

### Task 6: Compose and verify the production dashboard

**Files:**
- Modify: `apps/web/src/app/page.tsx`

**Interfaces:**
- Consumes: all redesigned components.
- Produces: a responsive market/activity workspace and portfolio/leaderboard sections.

- [ ] **Step 1: Compose semantic page sections**

Use a market-first hero, trading grid, portfolio, and leaderboard with matching navigation IDs and no dead tabs.

- [ ] **Step 2: Run formatting and static checks**

Run: `pnpm exec prettier --write apps/web packages/config/src/abi/oddsXAbi.ts`, `pnpm typecheck`, and `pnpm lint`.

- [ ] **Step 3: Run production build and contract regression tests**

Run: `pnpm build` and `cd packages/contracts && FOUNDRY_OFFLINE=true forge test -vvv`.

- [ ] **Step 4: Visually inspect desktop and mobile**

Run the local Next server, capture desktop and mobile screenshots, inspect overflow/contrast/hierarchy, and iterate until the trading flow is visually coherent.
