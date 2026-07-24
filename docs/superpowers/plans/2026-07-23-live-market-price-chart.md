# Live Market Price Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a resilient real-time BTC/ETH price instrument with target visualization to the trader-only OddsX market view.

**Architecture:** A pure market-text parser will infer supported Binance USDC symbols and optional comparison targets from the selected label/description. `PriceChart` will render bounded historical 1-minute candles with Lightweight Charts, update the current candle and 24-hour ticker over one combined Binance WebSocket, reconnect with capped backoff, and fail independently from onchain trading.

**Tech Stack:** Next.js 15, React 19, TypeScript, Lightweight Charts 5, Binance public Spot REST/WebSocket market data, Framer Motion, Lucide React, Tailwind CSS

## Global Constraints

- Keep the frontend trader-only with exactly Markets, Portfolio, and Leaderboard navigation.
- Preserve all Arc Testnet contract bindings and trader actions.
- Support BTC/USDC and ETH/USDC feeds inferred from live market text; do not add a hardcoded selected market.
- Treat external price data as informational and never block betting, claims, pool reads, or activity feeds.
- Show loading, reconnecting, offline, unsupported-market, and live states without exposing raw network errors.
- Include TradingView chart attribution and Binance data attribution.

---

### Task 1: Chart dependency and market parser

**Files:**

- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/src/lib/marketPrice.ts`

**Interfaces:**

- `getMarketPriceFeed(label: string, description: string)` returns `{ asset: "BTC" | "ETH"; symbol: "BTCUSDC" | "ETHUSDC"; targetPrice: number | null }` or `null`.

- [x] **Step 1: Install Lightweight Charts**

  Run `pnpm --filter @oddsx/web add lightweight-charts@^5.0.0`. Expected: dependency and lockfile update without changing existing chart packages.

- [x] **Step 2: Implement deterministic feed inference**

  Normalize commas and case, find a whole-word BTC or ETH asset in label/description, map it to the USDC spot symbol, and extract the first numeric value following `ABOVE`, `BELOW`, `OVER`, `UNDER`, `GREATER THAN`, `LESS THAN`, or a comparison operator.

- [x] **Step 3: Exercise parser edge cases**

  Use Node's TypeScript stripping to assert BTC underscore labels, natural-language ETH conditions, raw unsupported identifiers, comma-separated targets, and no-target supported markets.

### Task 2: Real-time price instrument

**Files:**

- Create: `apps/web/src/components/PriceChart.tsx`

**Interfaces:**

- Props: `{ marketLabel: string; description: string }`.
- Consumes: `getMarketPriceFeed`, Binance `GET /api/v3/klines`, combined `<symbol>@kline_1m` and `<symbol>@ticker` streams, and Lightweight Charts v5.

- [x] **Step 1: Create the responsive chart lifecycle**

  Instantiate a dark candlestick chart with `ResizeObserver`, initialize up to 180 recent 1-minute candles, create a dashed target price line when present, fit content once, and dispose chart/network observers on unmount or market change.

- [x] **Step 2: Stream price and 24-hour change**

  Open one combined Binance WebSocket, update the current candle via `series.update`, update current price and 24-hour percentage from ticker events, and display a live timestamp.

- [x] **Step 3: Add resilient connection states**

  Handle initial REST failure without preventing WebSocket startup, listen for browser offline/online events, reconnect WebSocket closures with capped exponential backoff, and show friendly loading/reconnecting/offline copy.

- [x] **Step 4: Build the target-distance instrument UI**

  Render live price, signed 24-hour change, target value, absolute/percentage target distance, a directional distance rail, feed status, and required data/chart attribution in the existing OddsX visual system.

### Task 3: Market view integration and trader-only audit

**Files:**

- Modify: `apps/web/src/components/MarketCard.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`
- Verify: `apps/web/src/components/Header.tsx`

**Interfaces:**

- `MarketCard` accepts `{ marketId: Hex; marketLabel: string }` and passes label plus onchain description to `PriceChart` only after a real market loads.

- [x] **Step 1: Mount the live chart in the market card**

  Place `PriceChart` between the market question header and existing pool/trade grid so price context appears before order execution without replacing pool probability data.

- [x] **Step 2: Pass selected market text**

  Pass `marketLabel` from Dashboard into MarketCard while retaining blank initial selection and existing lookup behavior.

- [x] **Step 3: Re-audit privileged UI absence**

  Search `apps/web/src` for Admin/Resolver/Create Market components, hooks, navigation, and conditional renders. Expected: no matches; Header still contains exactly the three trader links.

### Task 4: Verification

**Files:**

- Verify: all modified files and workspace packages

**Interfaces:**

- Produces: fresh parser, formatting, lint, typecheck, and production-build evidence.

- [x] **Step 1: Run parser checks and formatting**

  Run deterministic parser assertions and Prettier checks. Expected: exit code 0.

- [x] **Step 2: Run workspace lint and typecheck**

  Run `pnpm lint` and `pnpm typecheck`. Expected: exit code 0 across contracts, config, and web.

- [x] **Step 3: Run workspace production build**

  Run `pnpm build`. Expected: exit code 0 with the `/` route statically generated.
