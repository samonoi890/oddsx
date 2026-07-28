# Changelog

## 2026-07-28 — Audit remediation

### Protocol

- Zero-stake winning outcomes now cancel the market instead of reverting. The contract emits `MarketCancelled` plus `MarketCancelledNoWinningStake`, and every participant can reclaim their original stake with `emergencyRefund`.
- Added `placeBetWithBounds`, which enforces an execution deadline and minimum execution-time expected reward while preserving the legacy unbounded `placeBet` entrypoint.
- Added a configurable default resolution delay, snapshotted when each market is created and capped at seven days.
- The final winning claimant receives any integer-division remainder, preventing payout dust from becoming stranded.
- Added `getMarketWithPools` for a coherent market and outcome-pool snapshot in one RPC call.
- Deployment can assign protocol roles directly to `ODDSX_ADMIN`, including a multisig, instead of the broadcasting EOA.

### Frontend

- Selected markets refetch on matching bet, resolution, and cancellation events, with a 12-second fallback refresh.
- Bets use a five-minute deadline and 1% execution-time return tolerance.
- Added role-aware YES/NO resolution and cancellation controls.
- Added per-outcome refunds for cancelled positions.
- Added Coinbase Wallet plus optional WalletConnect QR/mobile connections, visible connection/switch failures, and an RPC-backed Arc status indicator.
- Added modal focus trapping/restoration and changed MAX betting to reserve a fixed 0.05 USDC for gas.
- Replaced “Oracle verified” with “Designated oracle” and show empty pools as “No liquidity / Unpriced”.
- Market discovery and wallet history use paginated event reads from deployment; public activity remains a bounded recent tape.
- Invalid configured contract addresses now fail immediately instead of silently falling back.

### Tests

- Expanded the Foundry suite from 7 to 24 tests.
- Added access-control, zero-winner cancellation, both-outcome refund, double-claim, rounding-remainder, fee-withdrawal, deadline, slippage, delayed-resolution, duplicate-market, direct-native-transfer, and coherent-snapshot coverage.
- Added two 1,000-run fuzz tests for payout accounting and zero-winner refund solvency.

### Deployment note

The remediated contract was deployed to Arc Testnet at `0x6C9fD55355e83190363842693867826d4eCd94C5` in block `54065221` ([deployment transaction](https://testnet.arcscan.app/tx/0xb01ec939db1d9c5a89266bd6fe3c153bdb1a44c855fb9e5bdaac6873a3810445)). The frontend runtime default, local environment, and checked-in environment examples now target this deployment. The default ETH market was seeded in transaction `0xa18976e322230a061366713bebe62762d6e35ce77916a0e7f9fcacfbb58ebc35`.
