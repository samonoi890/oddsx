// apps/web/src/components/Portfolio.tsx
"use client";

import { motion } from "framer-motion";
import {
  Award,
  CircleDollarSign,
  Layers3,
  Target,
  Trophy,
  Wallet,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import type { Hex } from "viem";
import { useAccount } from "wagmi";
import type { ProtocolBet } from "@/hooks/useProtocolActivity";
import { useMarket } from "@/hooks/useMarket";
import { useMarketActions } from "@/hooks/useMarketActions";
import { usePortfolio } from "@/hooks/usePortfolio";
import { getSafeErrorMessage } from "@/lib/errors";
import { formatUsdc } from "@/lib/format";
import { RPC_RATE_LIMIT_MESSAGE } from "@/lib/rpc";

interface PortfolioProps {
  marketId: Hex;
  marketLabel: string;
  bets: ProtocolBet[];
}

export function Portfolio({ marketId, marketLabel, bets }: PortfolioProps) {
  const { address } = useAccount();
  const { market, refetch: refetchMarket } = useMarket(marketId);
  const portfolio = usePortfolio(marketId, bets);
  const { refetch: refetchPortfolio } = portfolio;
  const handleClaimConfirmed = useCallback(() => {
    refetchPortfolio();
    refetchMarket();
  }, [refetchMarket, refetchPortfolio]);
  const {
    claimReward,
    isPending,
    transactionHash,
    actionError,
    isCorrectChain,
  } = useMarketActions(marketId, handleClaimConfirmed);

  const stats = useMemo(
    () => [
      {
        label: "Total wagered",
        value: `${formatUsdc(portfolio.totalWagered, 2)} USDC`,
        icon: CircleDollarSign,
        color: "text-cyan-300",
      },
      {
        label: "Win rate",
        value: `${portfolio.winRate}%`,
        icon: Target,
        color: "text-emerald-300",
      },
      {
        label: "Active positions",
        value: portfolio.activePositions.toString(),
        icon: Layers3,
        color: "text-violet-300",
      },
      {
        label: "Total winnings",
        value: `${formatUsdc(portfolio.totalWinnings, 2)} USDC`,
        icon: Trophy,
        color: "text-amber-300",
      },
    ],
    [
      portfolio.activePositions,
      portfolio.totalWagered,
      portfolio.totalWinnings,
      portfolio.winRate,
    ],
  );

  const hasPosition = portfolio.yesStake > 0n || portfolio.noStake > 0n;
  const canClaim = Boolean(
    market?.state === 2 &&
      portfolio.previewReward > 0n &&
      !portfolio.hasClaimed,
  );

  return (
    <section id="portfolio" className="scroll-mt-24 py-12 sm:py-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="data-label">Wallet intelligence</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-white">
            Your edge, onchain
          </h2>
        </div>
        <Wallet className="size-6 text-cyan-300" />
      </div>

      {!address ? (
        <div className="glass-panel rounded-[28px] p-10 text-center">
          <Wallet className="mx-auto size-7 text-slate-700" />
          <h3 className="mt-4 font-display text-xl font-semibold text-white">
            Connect to reveal your portfolio
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            OddsX reconstructs your real wager and reward history from Arc
            events. No account or indexer login required.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="glass-panel rounded-2xl p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="data-label">{stat.label}</p>
                  <stat.icon className={`size-4 ${stat.color}`} />
                </div>
                <p className="mt-4 font-mono text-xl font-semibold text-white">
                  {stat.value}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="glass-panel mt-4 overflow-hidden rounded-[28px]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-6">
              <div>
                <p className="data-label">Selected market position</p>
                <p className="mt-1 font-mono text-xs text-slate-400">
                  {marketLabel}
                </p>
              </div>
              <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                {market
                  ? ["Unknown", "Open", "Resolved", "Cancelled"][market.state]
                  : "Loading"}
              </span>
            </div>

            {!hasPosition ? (
              <p className="px-6 py-10 text-center text-sm text-slate-600">
                No position in this market yet. Choose YES or NO above to enter.
              </p>
            ) : (
              <div className="grid gap-px bg-white/[0.06] md:grid-cols-[1fr_1fr_auto]">
                <div className="bg-slate-950/70 p-6">
                  <p className="data-label text-emerald-300">YES exposure</p>
                  <p className="mt-3 font-mono text-2xl font-semibold text-white">
                    {formatUsdc(portfolio.yesStake, 2)}{" "}
                    <span className="text-xs text-slate-600">USDC</span>
                  </p>
                </div>
                <div className="bg-slate-950/70 p-6">
                  <p className="data-label text-rose-300">NO exposure</p>
                  <p className="mt-3 font-mono text-2xl font-semibold text-white">
                    {formatUsdc(portfolio.noStake, 2)}{" "}
                    <span className="text-xs text-slate-600">USDC</span>
                  </p>
                </div>
                <div className="flex min-w-56 items-center bg-slate-950/70 p-6">
                  {canClaim ? (
                    <button
                      type="button"
                      className="primary-button w-full shadow-yes"
                      onClick={() => claimReward()}
                      disabled={isPending || !isCorrectChain}
                    >
                      <Award className="size-4" />{" "}
                      {isPending
                        ? "Claiming…"
                        : `Claim ${formatUsdc(portfolio.previewReward, 2)} USDC`}
                    </button>
                  ) : (
                    <p className="text-xs leading-5 text-slate-500">
                      {portfolio.hasClaimed
                        ? "Reward claimed."
                        : market?.state === 2
                          ? "This position is not eligible for a reward."
                          : "Potential rewards appear after resolution."}
                    </p>
                  )}
                </div>
              </div>
            )}
            {transactionHash ? (
              <a
                className="block border-t border-white/[0.06] px-6 py-3 font-mono text-[10px] text-cyan-300"
                href={`https://testnet.arcscan.app/tx/${transactionHash}`}
                target="_blank"
                rel="noreferrer"
              >
                Claim transaction on ArcScan ↗
              </a>
            ) : null}
            {portfolio.isRateLimited ? (
              <p className="border-t border-amber-300/10 bg-amber-300/[0.03] px-6 py-3 text-xs text-amber-100">
                {RPC_RATE_LIMIT_MESSAGE}
              </p>
            ) : portfolio.error ||
              actionError ||
              (canClaim && !isCorrectChain) ? (
              <p className="border-t border-white/[0.06] px-6 py-3 text-xs text-rose-300">
                {canClaim && !isCorrectChain
                  ? "Switch your wallet to Arc Testnet to claim this reward."
                  : portfolio.error
                    ? "Portfolio data is temporarily unavailable. Please try again shortly."
                    : getSafeErrorMessage(
                        actionError,
                        "The claim transaction could not be completed. Please try again.",
                      )}
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
