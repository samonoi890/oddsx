# Neutral Market Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove hardcoded ETH market examples and make OddsX start without an implicitly selected market.

**Architecture:** The dashboard will represent the absence of a market with `marketId: Hex | null` and will not mount contract-reading components until lookup or creation selects an ID. Lookup and creation inputs will initialize as empty strings and use generic instructional placeholders.

**Tech Stack:** Next.js 15, React 19, TypeScript, Wagmi 2, Viem 2, Tailwind CSS

## Global Constraints

- Remove every case-insensitive `ETH_ABOVE` and `ETH ABOVE` string from `apps/web/` and `packages/config/`.
- Market lookup and market creation label state must start blank.
- Do not issue a market contract read before the user selects or creates a market.
- Preserve existing Arc Testnet and OddsX contract bindings.

---

### Task 1: Blank input defaults

**Files:**

- Modify: `apps/web/src/components/MarketLookup.tsx`
- Modify: `apps/web/src/components/CreateMarketModal.tsx`

**Interfaces:**

- `MarketLookup` continues producing `(marketId: Hex, label: string)` through `onMarketChange`.
- `CreateMarketModal` continues producing the confirmed market ID and normalized label through `onCreated`.

- [x] **Step 1: Remove the lookup initial value**

  Remove the `initialLabel` prop and initialize the lookup input with `useState("")`. Use `placeholder="Enter market label or bytes32 ID..."`.

- [x] **Step 2: Replace creation examples**

  Keep label and description state empty. Use `placeholder="e.g. BTC_ABOVE_100000"` for the label and a generic non-ETH resolution-question example.

### Task 2: Neutral dashboard state

**Files:**

- Modify: `apps/web/src/components/Dashboard.tsx`

**Interfaces:**

- `marketId` becomes `Hex | null` and `marketLabel` starts as an empty string.
- Existing `changeMarket(nextMarketId: Hex, label: string)` selects a market without changing contract bindings.

- [x] **Step 1: Remove the hardcoded hash seed**

  Delete the label constant and `keccak256`/`stringToHex` imports. Initialize `marketId` to `null` and `marketLabel` to `""`.

- [x] **Step 2: Gate market-bound components**

  Render a neutral discovery panel when `marketId === null`. Mount `MarketCard` and `Portfolio` only when a valid ID has been supplied by lookup or creation.

### Task 3: Verification

**Files:**

- Verify: `apps/web/`
- Verify: `packages/config/`

**Interfaces:**

- Produces: a clean source scan and production-build result.

- [x] **Step 1: Re-scan prohibited values**

  Run a case-insensitive Ripgrep search for `ETH[_ ]ABOVE`, `ETH.*5000`, and `ETH.*6000` while excluding generated `.next` and TypeScript build-info files. Expected: no matches.

- [x] **Step 2: Run static checks**

  Run web TypeScript, ESLint, and Prettier checks. Expected: exit code 0 for all commands.

- [x] **Step 3: Run production build**

  Run `pnpm build`. Expected: exit code 0 and a generated `/` route.
