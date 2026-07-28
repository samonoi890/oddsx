// apps/web/src/components/ActivityFeed.tsx
"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Radio, RefreshCw, Waves } from "lucide-react";
import type { ProtocolBet } from "@/hooks/useProtocolActivity";
import { formatUsdc, shortenAddress } from "@/lib/format";

interface ActivityFeedProps {
  bets: ProtocolBet[];
  isLoading: boolean;
  error: Error | null;
  isRateLimited: boolean;
  onRetry: () => void;
}

export function ActivityFeed({
  bets,
  isLoading,
  error,
  isRateLimited,
  onRetry,
}: ActivityFeedProps) {
  const isReconnecting = Boolean(error);
  const status = isLoading
    ? "syncing"
    : isReconnecting
      ? "reconnecting"
      : "streaming";
  const errorTone = isRateLimited
    ? "border-amber-300/15 bg-amber-300/[0.04] text-amber-100"
    : "border-rose-300/15 bg-rose-300/[0.04] text-rose-200";

  return (
    <aside className="glass-panel overflow-hidden rounded-[28px] lg:sticky lg:top-24">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
        <div>
          <p className="data-label">Protocol tape</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-white">
            Live activity
          </h2>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider ${
            isRateLimited
              ? "bg-amber-300/[0.06] text-amber-200"
              : isReconnecting
                ? "bg-rose-300/[0.06] text-rose-200"
                : "bg-emerald-300/[0.06] text-emerald-300"
          }`}
        >
          {isReconnecting ? (
            <RefreshCw className="size-3 animate-spin" />
          ) : (
            <Radio className="size-3" />
          )}
          {status}
        </span>
      </div>

      <div className="max-h-[640px] overflow-y-auto">
        {isLoading && bets.length === 0 ? (
          <div className="grid min-h-48 place-items-center text-center">
            <div>
              <Waves className="mx-auto size-5 animate-pulse text-cyan-300" />
              <p className="mt-3 text-xs text-slate-500">Syncing Arc events…</p>
            </div>
          </div>
        ) : error && bets.length === 0 ? (
          <div
            className={`m-5 rounded-xl border p-4 ${errorTone}`}
            role="alert"
          >
            <p className="text-xs leading-5">{error.message}</p>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-current transition hover:text-white"
              onClick={onRetry}
            >
              <RefreshCw className="size-3" /> Try again now
            </button>
          </div>
        ) : bets.length === 0 ? (
          <div className="p-8 text-center">
            <Waves className="mx-auto size-6 text-slate-700" />
            <p className="mt-3 text-sm font-semibold text-slate-300">
              The tape is quiet
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              The first confirmed bet will appear here directly from Arc.
            </p>
          </div>
        ) : (
          <>
            {error ? (
              <div
                className={`m-4 flex items-start justify-between gap-3 rounded-xl border p-3 ${errorTone}`}
                role="status"
              >
                <p className="text-[11px] leading-5">{error.message}</p>
                <button
                  type="button"
                  className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-wider text-current transition hover:text-white"
                  onClick={onRetry}
                >
                  Retry
                </button>
              </div>
            ) : null}
            <div className="divide-y divide-white/[0.055]">
              {bets.slice(0, 24).map((bet, index) => {
                const yes = bet.outcome === 0;
                return (
                  <motion.a
                    key={bet.id}
                    href={`https://testnet.arcscan.app/tx/${bet.transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                    initial={index === 0 ? { opacity: 0, x: 10 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    className="group flex items-center gap-3 px-5 py-4 transition hover:bg-white/[0.025]"
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl border text-[10px] font-black ${yes ? "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-300" : "border-rose-300/15 bg-rose-300/[0.05] text-rose-300"}`}
                    >
                      {yes ? "Y" : "N"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-300">
                        {shortenAddress(bet.bettor)} bought{" "}
                        <span
                          className={yes ? "text-emerald-300" : "text-rose-300"}
                        >
                          {yes ? "YES" : "NO"}
                        </span>
                      </span>
                      <span className="mt-1 block font-mono text-[9px] text-slate-600">
                        Block {bet.blockNumber.toString()}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-xs font-semibold text-white">
                        {formatUsdc(bet.amount, 2)}
                      </span>
                      <span className="flex items-center justify-end gap-1 text-[9px] text-slate-600">
                        USDC{" "}
                        <ArrowUpRight className="size-2.5 transition group-hover:text-cyan-300" />
                      </span>
                    </span>
                  </motion.a>
                );
              })}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
