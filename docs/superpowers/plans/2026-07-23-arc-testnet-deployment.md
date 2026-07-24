# Arc Testnet Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure OddsX exclusively for Arc Testnet, deploy the contract with a funded private key, and connect the frontend to the deployed address over Arc's live RPC.

**Architecture:** Define Arc Testnet once in the shared config package and consume its explicit HTTP RPC URL in Wagmi. Add an Arc Foundry endpoint and deployment script, then populate the frontend address only from a confirmed deployment receipt.

**Tech Stack:** Foundry, Solidity 0.8.30, Viem 2, Wagmi 2, Next.js 15, Arc Testnet chain ID 5042002.

## Global Constraints

- Use the official Arc Testnet RPC `https://rpc.testnet.arc.network`.
- Use chain ID `5042002`, native currency `USDC` with 18 decimals, and explorer `https://testnet.arcscan.app`.
- Never print, commit, or embed `PRIVATE_KEY` in source or frontend environment files.
- Do not populate a frontend contract address until deployment bytecode is confirmed on Arc Testnet.

---

### Task 1: Configure Arc Testnet for shared config and Wagmi

**Files:**
- Modify: `packages/config/src/chains.ts`
- Modify: `packages/config/src/contracts.ts`
- Modify: `packages/config/src/index.ts`
- Modify: `apps/web/src/providers/Web3Provider.tsx`

**Interfaces:**
- Produces: `arcTestnet`, `ARC_TESTNET_RPC_URL`, `supportedChains`, and `NEXT_PUBLIC_ODDSX_ADDRESS_ARC_TESTNET` lookup.

- [ ] **Step 1: Define Arc Testnet from official parameters**

```ts
export const ARC_TESTNET_RPC_URL = "https://rpc.testnet.arc.network";
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_TESTNET_RPC_URL] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});
export const supportedChains = [arcTestnet] as const;
```

- [ ] **Step 2: Map OddsX address by Arc chain ID**

```ts
export const oddsXAddresses = {
  [arcTestnet.id]: (process.env.NEXT_PUBLIC_ODDSX_ADDRESS_ARC_TESTNET || ZERO_ADDRESS) as Address,
};
```

- [ ] **Step 3: Use an explicit Arc transport in Wagmi**

```ts
transports: {
  [arcTestnet.id]: http(ARC_TESTNET_RPC_URL),
},
```

- [ ] **Step 4: Verify config and web TypeScript**

Run: `pnpm --filter @oddsx/config typecheck && pnpm --filter @oddsx/web typecheck`
Expected: both commands exit 0.

### Task 2: Configure and execute Foundry deployment

**Files:**
- Modify: `packages/contracts/foundry.toml`
- Modify: `packages/contracts/package.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `ARC_TESTNET_RPC_URL` and secret `PRIVATE_KEY` environment variables.
- Produces: An Arc Testnet deployment transaction and confirmed OddsX contract address.

- [ ] **Step 1: Add the Arc RPC alias and deploy command**

```toml
[rpc_endpoints]
arc_testnet = "${ARC_TESTNET_RPC_URL}"
```

```json
"deploy:arc-testnet": "forge script script/DeployOddsX.s.sol:DeployOddsX --rpc-url arc_testnet --broadcast"
```

- [ ] **Step 2: Check credentials without exposing them**

Run: `test -n "$PRIVATE_KEY" && cast wallet address --private-key "$PRIVATE_KEY"`
Expected: a deployer address; never log the key.

- [ ] **Step 3: Check chain and funding**

Run: `cast chain-id --rpc-url "$ARC_TESTNET_RPC_URL"` and `cast balance <DEPLOYER> --rpc-url "$ARC_TESTNET_RPC_URL"`
Expected: chain ID `5042002` and a positive native USDC balance.

- [ ] **Step 4: Deploy OddsX**

Run: `forge script script/DeployOddsX.s.sol:DeployOddsX --rpc-url "$ARC_TESTNET_RPC_URL" --broadcast`
Expected: successful transaction receipt and emitted `OddsX deployed at` address.

### Task 3: Connect frontend to the confirmed deployment

**Files:**
- Modify: `apps/web/.env.example`
- Modify: `apps/web/.env.local`
- Modify: `packages/config/.env.example`
- Modify: `packages/config/.env.local`

**Interfaces:**
- Consumes: Confirmed Arc deployment address.
- Produces: `NEXT_PUBLIC_DEFAULT_CHAIN_ID=5042002`, `NEXT_PUBLIC_ARC_TESTNET_RPC_URL`, and `NEXT_PUBLIC_ODDSX_ADDRESS_ARC_TESTNET`.

- [ ] **Step 1: Save the confirmed address and Arc RPC**

```dotenv
NEXT_PUBLIC_DEFAULT_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ODDSX_ADDRESS_ARC_TESTNET=<confirmed deployment address>
```

- [ ] **Step 2: Confirm deployed bytecode and frontend reads**

Run: `cast code "$NEXT_PUBLIC_ODDSX_ADDRESS_ARC_TESTNET" --rpc-url "$ARC_TESTNET_RPC_URL"`
Expected: non-empty bytecode.

- [ ] **Step 3: Run final checks**

Run: `pnpm build && pnpm typecheck && pnpm lint && forge test -vvv`
Expected: all commands exit 0.
