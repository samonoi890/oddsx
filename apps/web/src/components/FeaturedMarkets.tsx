"use client";

import { motion } from "framer-motion";
import { Clock3, Layers3, Radio } from "lucide-react";
import type { Hex } from "viem";
import type { FeaturedMarket } from "@/hooks/useFeaturedMarkets";
import { getSafeErrorMessage } from "@/lib/errors";
import { formatDateTime, formatUsdc, marketStateLabel } from "@/lib/format";

interface FeaturedMarketsProps {
  markets: FeaturedMarket[];
  activeMarketId: Hex;
  isLoading: boolean;
  error: Error | null;
  onSelect: (marketId: Hex, label: string) => void;
}

export function FeaturedMarkets({
  markets,
  activeMarketId,
  isLoading,
  error,
  onSelect,
}: FeaturedMarketsProps) {
  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/55">
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Layers3 className="size-4 text-cyan-300" />
          <p className="data-label text-slate-300">Featured markets</p>
        </div>
        <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          <Radio className="size-3 text-emerald-300" /> Deployed on Arc
        </span>
      </div>

      {error && markets.length === 0 ? (
        <p className="px-4 py-4 text-xs text-amber-200/80">
          {getSafeErrorMessage(
            error,
            "Featured markets are temporarily unavailable.",
          )}
        </p>
      ) : null}

      <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-3">
        {markets.map(({ id, label, market }) => {
          const active = id.toLowerCase() === activeMarketId.toLowerCase();
          return (
            <motion.button
              key={id}
              type="button"
              whileHover={{ y: -2 }}
              onClick={() => onSelect(id, label)}
              className={`relative min-w-0 bg-slate-950/90 p-4 text-left transition hover:bg-slate-900/90 ${
                active ? "shadow-[inset_0_-2px_0_#67e8f9]" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-mono text-xs font-bold text-white">
                  {label}
                </span>
                <span
                  className={`rounded-full px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider ${
                    market.state === 1
                      ? "bg-emerald-300/10 text-emerald-300"
                      : "bg-white/[0.06] text-slate-500"
                  }`}
                >
                  {marketStateLabel(market.state)}
                </span>
              </div>
              <p className="mt-2 line-clamp-1 text-xs text-slate-500">
                {market.description}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3 text-[10px] text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Clock3 className="size-3" /> {formatDateTime(market.endTime)}
                </span>
                <span className="font-mono text-slate-400">
                  {formatUsdc(market.totalPool, 1)} USDC
                </span>
              </div>
            </motion.button>
          );
        })}
        {isLoading && markets.length === 0
          ? Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="h-[118px] animate-pulse bg-slate-950/90 p-4"
              >
                <div className="h-3 w-2/5 rounded bg-white/[0.06]" />
                <div className="mt-4 h-2 w-4/5 rounded bg-white/[0.04]" />
              </div>
            ))
          : null}
      </div>
    </section>
  );
}
