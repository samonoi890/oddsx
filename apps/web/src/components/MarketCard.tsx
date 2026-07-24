// apps/web/src/components/MarketCard.tsx
"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Clock3,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import type { Hex } from "viem";
import { BetModal } from "./BetModal";
import { PriceChart } from "./PriceChart";
import { useMarket } from "@/hooks/useMarket";
import { getSafeErrorMessage } from "@/lib/errors";
import {
  formatCountdown,
  formatDateTime,
  formatUsdc,
  marketStateLabel,
} from "@/lib/format";

interface OddsPoint {
  time: string;
  yes: number;
  no: number;
}

export function MarketCard({
  marketId,
  marketLabel,
}: {
  marketId: Hex;
  marketLabel: string;
}) {
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [betOpen, setBetOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState(0);
  const [oddsHistory, setOddsHistory] = useState<OddsPoint[]>([]);
  const { market, outcomePools, isLoading, error, refetch } =
    useMarket(marketId);

  useEffect(() => {
    const update = () => setCurrentTime(Math.floor(Date.now() / 1_000));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const { yesPercent, noPercent } = useMemo(() => {
    const totalPool = outcomePools.reduce((sum, pool) => sum + pool, 0n);
    const nextYesPercent =
      totalPool === 0n
        ? 50
        : Number(((outcomePools[0] ?? 0n) * 10_000n) / totalPool) / 100;
    return { yesPercent: nextYesPercent, noPercent: 100 - nextYesPercent };
  }, [outcomePools]);

  useEffect(() => {
    setOddsHistory([]);
  }, [marketId]);

  useEffect(() => {
    const point = {
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      yes: yesPercent,
      no: noPercent,
    };
    setOddsHistory((history) => {
      const last = history.at(-1);
      if (last && last.yes === point.yes && last.no === point.no)
        return history;
      return [...history, point].slice(-30);
    });
  }, [noPercent, yesPercent]);

  const timing = useMemo(() => {
    if (!market || currentTime === null) return { remaining: 0, urgency: 0 };
    const remaining = Math.max(0, Number(market.endTime) - currentTime);
    return {
      remaining,
      urgency: Math.min(100, Math.max(0, (1 - remaining / 604_800) * 100)),
    };
  }, [currentTime, market]);

  if (isLoading) {
    return (
      <div className="glass-panel grid min-h-[560px] place-items-center rounded-[28px]">
        <div className="text-center">
          <LoaderCircle className="mx-auto size-6 animate-spin text-emerald-300" />
          <p className="mt-3 text-xs text-slate-500">Reading Arc state…</p>
        </div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="glass-panel rounded-[28px] p-8">
        <p className="data-label text-rose-300">Market unavailable</p>
        <h2 className="mt-3 font-display text-2xl font-semibold text-white">
          No market found for this identifier
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">
          {getSafeErrorMessage(
            error,
            "Check the market label and Arc Testnet connection.",
          )}
        </p>
      </div>
    );
  }

  const isNativeAsset =
    market.asset.toLowerCase() === "0x0000000000000000000000000000000000000000";
  const isBettingOpen = market.state === 1 && timing.remaining > 0;

  return (
    <>
      <motion.article
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3 }}
        className="glass-panel overflow-hidden rounded-[28px] border-white/[0.09]"
      >
        <div className="border-b border-white/[0.07] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                {marketStateLabel(market.state)}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                <ShieldCheck className="size-3" /> Oracle verified
              </span>
            </div>
            <a
              href={`https://testnet.arcscan.app/address/${market.oracle}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 font-mono text-[10px] text-slate-500 hover:text-cyan-300"
            >
              Oracle {market.oracle.slice(0, 6)}…{market.oracle.slice(-4)}{" "}
              <ExternalLink className="size-3" />
            </a>
          </div>
          <h2 className="mt-5 max-w-3xl font-display text-2xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-4xl">
            {market.description}
          </h2>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Clock3 className="size-3.5" />{" "}
              {formatCountdown(timing.remaining)} remaining
            </span>
            <span>Ends {formatDateTime(market.endTime)}</span>
            <span>{Number(market.feeBps) / 100}% protocol fee</span>
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.05]">
            <motion.div
              className={`h-full ${timing.urgency > 80 ? "bg-rose-400" : "bg-cyan-300"}`}
              animate={{ width: `${timing.urgency}%` }}
            />
          </div>
        </div>

        <PriceChart
          marketLabel={marketLabel}
          description={market.description}
        />

        <div className="grid lg:grid-cols-[1fr_0.72fr]">
          <div className="p-5 sm:p-7">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="data-label">Market pulse</p>
                <p className="mt-1 text-xs text-slate-500">
                  Live pool-implied probability
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2 text-right">
                <p className="data-label">Total volume</p>
                <p className="mt-1 font-mono text-sm font-semibold text-white">
                  {formatUsdc(market.totalPool, 2)}{" "}
                  <span className="text-[10px] text-slate-500">USDC</span>
                </p>
              </div>
            </div>

            <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/60 p-4">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <span className="font-mono text-4xl font-semibold text-emerald-300">
                    {yesPercent.toFixed(0)}%
                  </span>
                  <span className="ml-2 text-xs font-black text-emerald-300">
                    YES
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-3xl font-semibold text-rose-300">
                    {noPercent.toFixed(0)}%
                  </span>
                  <span className="ml-2 text-xs font-black text-rose-300">
                    NO
                  </span>
                </div>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-900">
                <motion.div
                  className="bg-emerald-300 shadow-yes"
                  animate={{ width: `${yesPercent}%` }}
                />
                <motion.div
                  className="bg-rose-300 shadow-no"
                  animate={{ width: `${noPercent}%` }}
                />
              </div>
              <div className="mt-5 h-40" aria-label="Live session odds chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={oddsHistory}
                    margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="yesGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#34d399"
                          stopOpacity={0.28}
                        />
                        <stop
                          offset="100%"
                          stopColor="#34d399"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        background: "#07111f",
                        border: "1px solid rgba(255,255,255,.1)",
                        borderRadius: 12,
                        fontSize: 11,
                      }}
                      formatter={(value) => [
                        `${Number(value).toFixed(1)}%`,
                        "YES",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="yes"
                      stroke="#34d399"
                      strokeWidth={2}
                      fill="url(#yesGradient)"
                      isAnimationActive
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
                <span>Live session</span>
                <span className="flex items-center gap-1">
                  <Activity className="size-3" /> Updates with pool state
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.07] bg-white/[0.015] p-5 sm:p-7 lg:border-l lg:border-t-0">
            <p className="data-label">Trade outcome</p>
            <div className="mt-4 space-y-3">
              {[
                {
                  label: "YES",
                  value: yesPercent,
                  pool: outcomePools[0] ?? 0n,
                  color: "emerald",
                },
                {
                  label: "NO",
                  value: noPercent,
                  pool: outcomePools[1] ?? 0n,
                  color: "rose",
                },
              ].map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={!isBettingOpen || !isNativeAsset}
                  onClick={() => {
                    setSelectedOutcome(index);
                    setBetOpen(true);
                  }}
                  className={`group w-full rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${item.color === "emerald" ? "border-emerald-300/15 bg-emerald-300/[0.04] hover:border-emerald-300/35 hover:bg-emerald-300/[0.07]" : "border-rose-300/15 bg-rose-300/[0.04] hover:border-rose-300/35 hover:bg-rose-300/[0.07]"}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-black ${item.color === "emerald" ? "text-emerald-300" : "text-rose-300"}`}
                    >
                      {item.label}
                    </span>
                    <ArrowUpRight className="size-4 text-slate-600 transition group-hover:text-white" />
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <span className="font-mono text-3xl font-semibold text-white">
                      {item.value.toFixed(0)}¢
                    </span>
                    <span className="text-right text-[10px] text-slate-500">
                      {formatUsdc(item.pool, 2)}
                      <br />
                      USDC pooled
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {!isBettingOpen ? (
              <p className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100">
                Trading is closed. This market is awaiting resolution.
              </p>
            ) : null}
            {!isNativeAsset ? (
              <p className="mt-4 text-xs leading-5 text-slate-500">
                This market uses an ERC-20 settlement asset. Native execution is
                disabled.
              </p>
            ) : null}
          </div>
        </div>
      </motion.article>

      <BetModal
        open={betOpen}
        onClose={() => setBetOpen(false)}
        marketId={marketId}
        marketTitle={market.description}
        outcome={selectedOutcome}
        onOutcomeChange={setSelectedOutcome}
        totalPool={market.totalPool}
        outcomePools={outcomePools}
        feeBps={market.feeBps}
        onConfirmed={refetch}
      />
    </>
  );
}
