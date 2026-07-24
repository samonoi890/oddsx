# OddsX

OddsX is a next-generation pari-mutuel prediction market running on Arc Testnet. Traders take YES or NO positions using native USDC, market odds emerge from the distribution of liquidity between outcome pools, and winning positions receive a proportional share of the distributable pool after resolution.

The repository is a pnpm monorepo containing the Next.js trading interface, shared Arc/contract configuration, and the Foundry smart contract workspace.

> OddsX is deployed for testnet development. The contracts have not undergone an independent production security audit. Do not treat testnet behavior, reference prices, or this repository as financial advice.

## Arc Testnet deployment

| Setting          | Value                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Network          | Arc Testnet                                                                                                                    |
| Chain ID         | `5042002`                                                                                                                      |
| Native currency  | USDC, 18 decimals                                                                                                              |
| OddsX contract   | [`0xA5649df055BF83505Dc41D014c18F8eD412C764C`](https://testnet.arcscan.app/address/0xA5649df055BF83505Dc41D014c18F8eD412C764C) |
| RPC endpoint     | `https://rpc.testnet.arc.network`                                                                                              |
| Block explorer   | [ArcScan Testnet](https://testnet.arcscan.app)                                                                                 |
| Deployment block | `53262846`                                                                                                                     |

The frontend reads its RPC endpoint and contract address from environment variables. The values above are the current shared Arc Testnet deployment.

## Product flow

1. **Connect wallet** — connect an injected EIP-1193 wallet and switch it to Arc Testnet.
2. **Analyze odds** — inspect the live YES/NO pool distribution, reference asset chart, and estimated payout multiplier.
3. **Cast a prediction** — choose an outcome and submit native USDC to its pool through `placeBet`.
4. **Claim the payout** — after the oracle resolves the market, eligible winners call `claimReward` to receive their pro-rata payout.

The live BTC/ETH chart is informational. Binance supplies the reference candles and ticker stream, while the market's designated on-chain oracle remains the sole settlement authority.

## Architecture

```text
OddsX/
├── apps/
│   └── web/                       Next.js App Router trading interface
│       └── src/
│           ├── app/               Root layout, metadata, and page entry
│           ├── components/        Market, betting, portfolio, chart, and onboarding UI
│           ├── hooks/             Typed Wagmi reads, writes, receipts, and event history
│           ├── lib/               Formatting, RPC resilience, parsing, and error safety
│           └── providers/         Arc Wagmi and TanStack Query configuration
├── packages/
│   ├── config/                    Shared Arc chain definition, address registry, and web ABI
│   └── contracts/                 OddsX Solidity source, Foundry tests, and deployment scripts
├── package.json                   Workspace command entry points
└── pnpm-workspace.yaml            Workspace package discovery
```

### Runtime data path

```text
Arc RPC
  ├── getMarket + getOutcomePool ──> active market book and implied odds
  ├── getUserStake + previewReward ──> connected-wallet portfolio
  └── bounded contract events ──────> featured markets and activity tape

Connected wallet
  ├── placeBet(value = amount) ─────> native USDC outcome stake
  ├── claimReward ──────────────────> resolved-market payout
  └── createMarket ─────────────────> role-gated Arc test market
```

All frontend contract calls use the ABI in `packages/config/src/abi/oddsXAbi.ts`. The Solidity protocol source of truth is `packages/contracts/src/OddsX.sol`, with shared market types and events in `packages/contracts/src/interfaces/IOddsX.sol`.

## Pari-mutuel mechanics

OddsX does not use an order book or constant-product AMM. Every outcome has a stake pool. The distribution of the total pool determines the displayed implied probability, while final payouts depend on the winning pool's share of total liquidity.

For a two-outcome market:

```text
totalPool        = yesPool + noPool
protocolFee      = floor(totalPool × feeBps / 10,000)
distributablePool = totalPool - protocolFee

userReward = floor(
  userWinningStake × distributablePool / winningPool
)
```

The frontend preview includes the proposed wager in both the selected outcome pool and total pool before calculating the estimated return. It safely falls back to neutral 50/50 displayed odds when both pools have zero liquidity. Estimates can change as later bets enter the market and are not guaranteed until resolution.

### Market lifecycle

| State       | Meaning                                                                     |
| ----------- | --------------------------------------------------------------------------- |
| `None`      | The market ID has not been created. Reads revert with `MarketDoesNotExist`. |
| `Open`      | Betting is allowed until `endTime`.                                         |
| `Resolved`  | The oracle selected a funded winning outcome and rewards are claimable.     |
| `Cancelled` | Trading stopped and users can recover stakes with `emergencyRefund`.        |

Resolution cannot occur before the configured end time. The selected winning outcome must contain stake, which prevents division by zero in reward distribution.

### Contract capabilities

| Function                         | Purpose                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `createMarket`                   | Creates a unique market ID, oracle, expiry, outcome count, fee, and settlement asset. |
| `placeBet`                       | Collects native currency or an ERC-20 stake and updates user/outcome/market pools.    |
| `resolveMarket`                  | Finalizes an expired market with its winning outcome.                                 |
| `claimReward`                    | Transfers a winner's proportional distributable-pool share.                           |
| `cancelMarket`                   | Cancels an open market under the emergency role.                                      |
| `emergencyRefund`                | Returns a user's stake for one outcome in a cancelled market.                         |
| `setDefaultProtocolFee`          | Changes the fee applied to subsequently created markets.                              |
| `withdrawProtocolFees`           | Transfers accrued fees to an authorized recipient.                                    |
| `getMarket` / `getOutcomePool`   | Returns current market configuration, accounting, and pool liquidity.                 |
| `getUserStake` / `previewReward` | Returns wallet-specific exposure and claimable reward previews.                       |

The current web trader supports native-USDC betting. It detects non-native settlement markets and disables the native execution form instead of submitting an incompatible transaction.

## Security model

`OddsX.sol` uses OpenZeppelin `AccessControl` with explicit operational roles:

| Role                  | Authority                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `DEFAULT_ADMIN_ROLE`  | Grants and revokes protocol roles. Assigned to the deployment administrator.                  |
| `MARKET_CREATOR_ROLE` | Creates new markets. The frontend checks this role before enabling its test-market launchpad. |
| `RESOLVER_ROLE`       | Resolves expired markets in addition to each market's designated oracle.                      |
| `CANCELLER_ROLE`      | Cancels disrupted or invalid markets so participants can request refunds.                     |
| `FEE_MANAGER_ROLE`    | Changes the default fee and withdraws accrued protocol fees.                                  |

Additional contract protections include:

- `ReentrancyGuard` on stake, claim, refund, and fee-withdrawal paths;
- `SafeERC20` transfers and balance-delta validation for unsupported fee-on-transfer tokens;
- checks-effects-interactions ordering before native or token payouts;
- immutable per-market fee snapshots;
- duplicate market, zero-address, invalid amount, invalid outcome, and expiry validation;
- explicit rejection of unsolicited native transfers;
- Solidity custom errors for deterministic failure handling.

Before production deployment, place privileged roles behind a multisig and timelock, define a dispute-capable oracle policy, allowlist settlement assets, expand invariant and fork testing, perform an independent audit, and document emergency governance procedures.

## RPC rate-limit resilience

The public Arc RPC is intentionally treated as a constrained shared resource:

- Wagmi polling is set to 12 seconds.
- Viem HTTP requests use a 10-second timeout and one bounded transport retry.
- TanStack Query keeps reads fresh for one block interval, caches inactive data for five minutes, and disables automatic window-focus refetching.
- Compatible reads are grouped through Wagmi multicall batching.
- Event history starts at the later of deployment block `53262846` or `latest - 999`, limiting every historical scan to 1,000 blocks.
- Portfolio lifecycle events are fetched through one contract-log request and narrowed locally.
- Market creation uses a one-time bounded discovery scan instead of a permanent event watcher.
- Live activity pauses its watcher after a rate-limit response and retries history after 30 seconds.
- The in-memory activity tape is capped at the latest 100 deduplicated bets.
- Raw RPC and Viem JSON errors are replaced with concise rate-limit, timeout, wallet-rejection, and network fallback messages.

These controls reduce request bursts, but a dedicated RPC provider or indexer is recommended for production traffic and complete historical analytics.

## Technology stack

### Frontend

- Next.js 15 App Router
- React 19
- TypeScript with strict, exact optional, unchecked-index, and unused-symbol checks
- Tailwind CSS
- Framer Motion
- Lucide React icons
- Recharts for session pool-odds visualization
- Lightweight Charts for BTC/ETH reference candles

### Web3 integration

- Wagmi v2
- Viem
- TanStack Query
- Injected EIP-1193 wallet connector

### Smart contracts and tooling

- Solidity `0.8.30`
- Foundry: Forge, Cast, and Anvil
- OpenZeppelin Contracts
- pnpm workspaces

## Prerequisites

- Node.js 22 or newer
- pnpm 10.15 or a compatible pnpm 10 release
- Foundry with Solidity `0.8.30` support
- An injected Web3 wallet for browser transactions
- Arc Testnet native USDC for transactions and test wagers

Confirm the toolchain:

```bash
node --version
pnpm --version
forge --version
cast --version
```

## Installation and environment

From the repository root:

```bash
pnpm install
```

Create `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ODDSX_ADDRESS_ARC_TESTNET=0xA5649df055BF83505Dc41D014c18F8eD412C764C
```

Create `packages/config/.env.local` with the same public values when running configuration tooling directly:

```dotenv
NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ODDSX_ADDRESS_ARC_TESTNET=0xA5649df055BF83505Dc41D014c18F8eD412C764C
```

Never place a private key in either frontend environment file. Next.js exposes variables prefixed with `NEXT_PUBLIC_` to the browser.

## Development

Start the web application:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The application still reads live market state from Arc Testnet; the local process only serves the frontend.

Run the production-quality gates:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

`pnpm build` compiles the shared configuration and creates the optimized Next.js production bundle with TypeScript and framework checks enabled.

## Contract testing

Run the Foundry suite through the requested root command:

```bash
pnpm test
```

Additional contract commands:

```bash
pnpm contracts:build
pnpm contracts:test
pnpm contracts:coverage
```

The Foundry profile enables the optimizer with 10,000 runs, `via_ir`, 1,000 fuzz runs, and 256 invariant runs at depth 64.

## Deploying to Arc Testnet

1. Create `packages/contracts/.env` and add a funded deployer key:

   ```dotenv
   PRIVATE_KEY=<funded-arc-testnet-private-key>
   ```

2. Keep the file private. It is consumed by `DeployOddsX.s.sol` and must never be committed or exposed to the frontend.

3. Deploy using the configured `arc_testnet` Foundry RPC alias:

   ```bash
   pnpm contracts:deploy:arc-testnet
   ```

4. Record the confirmed contract address from the Forge output and ArcScan receipt.

5. Update `NEXT_PUBLIC_ODDSX_ADDRESS_ARC_TESTNET` in both frontend/config environment files, then restart or rebuild the web application.

The deployment script assigns `DEFAULT_ADMIN_ROLE`, `MARKET_CREATOR_ROLE`, `RESOLVER_ROLE`, `CANCELLER_ROLE`, and `FEE_MANAGER_ROLE` to the deploying address and initializes the default protocol fee to 150 basis points.

## Workspace commands

| Command                             | Purpose                                                              |
| ----------------------------------- | -------------------------------------------------------------------- |
| `pnpm install`                      | Installs all workspace dependencies.                                 |
| `pnpm dev`                          | Starts the Next.js development server.                               |
| `pnpm test`                         | Runs the Foundry smart contract test suite in offline mode.          |
| `pnpm typecheck`                    | Runs strict TypeScript checks and a Foundry build across workspaces. |
| `pnpm lint`                         | Runs ESLint, config typechecking, and `forge fmt --check`.           |
| `pnpm build`                        | Builds shared config and the production Next.js application.         |
| `pnpm format`                       | Formats workspace files with Prettier.                               |
| `pnpm format:check`                 | Checks Prettier formatting without modifying files.                  |
| `pnpm contracts:build`              | Compiles `OddsX.sol` with Forge.                                     |
| `pnpm contracts:test`               | Runs offline contract tests with verbose Forge output.               |
| `pnpm contracts:coverage`           | Generates Solidity coverage data.                                    |
| `pnpm contracts:deploy:local`       | Broadcasts the deployment script to a local Anvil RPC.               |
| `pnpm contracts:deploy:arc-testnet` | Broadcasts the deployment script to Arc Testnet.                     |

## Troubleshooting

### The frontend reports that OddsX is not configured

Confirm `NEXT_PUBLIC_ODDSX_ADDRESS_ARC_TESTNET` is present in `apps/web/.env.local`, then restart the development server. Next.js reads public environment variables at process start and build time.

### Wallet transactions target the wrong network

Use the header's **Switch to Arc** action. Contract reads remain pinned to Arc for market visibility, while writes are blocked until the connected wallet reports chain ID `5042002`.

### Live activity pauses

The public RPC returned a rate-limit response. The UI stops the log watcher, keeps raw RPC details out of the page, and retries after 30 seconds. Wait for the clean fallback state to recover or configure a higher-capacity Arc-compatible RPC endpoint.

### A market lookup reverts

Market labels are hashed with `keccak256` and are case-sensitive. Confirm the exact creation label or provide its 32-byte market ID. `getMarket` intentionally reverts for an unknown ID.

### Reference candles are unavailable

The Binance REST or WebSocket endpoint may be blocked or disconnected. Trading and settlement remain available because the chart is not used by the OddsX contract or oracle.

## License

No project-level license has been declared. Third-party dependencies retain their respective licenses. Add an explicit repository license before public production distribution.
# oddsx
