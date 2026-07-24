// apps/web/src/components/Dashboard.tsx
"use client";

import { motion } from "framer-motion";
import {
  ArrowDown,
  Blocks,
  CircleDollarSign,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { Hex } from "viem";
import { ActivityFeed } from "./ActivityFeed";
import { FeaturedMarkets } from "./FeaturedMarkets";
import { HowItWorks } from "./HowItWorks";
import { MarketCard } from "./MarketCard";
import { MarketLookup } from "./MarketLookup";
import { NewMarketModal } from "./NewMarketModal";
import { Portfolio } from "./Portfolio";
import { useFeaturedMarkets } from "@/hooks/useFeaturedMarkets";
import { useProtocolActivity } from "@/hooks/useProtocolActivity";
import { formatUsdc } from "@/lib/format";
import { DEFAULT_MARKET } from "@/lib/marketCatalog";

export function Dashboard() {
  const [marketId, setMarketId] = useState<Hex>(DEFAULT_MARKET.id);
  const [marketLabel, setMarketLabel] = useState<string>(DEFAULT_MARKET.label);
  const [isNewMarketOpen, setIsNewMarketOpen] = useState(false);
  const activity = useProtocolActivity();
  const featured = useFeaturedMarkets();

  const changeMarket = useCallback((nextMarketId: Hex, label: string) => {
    setMarketId(nextMarketId);
    setMarketLabel(label);
  }, []);

  const protocolStats = useMemo(() => {
    const volume = activity.bets.reduce((sum, bet) => sum + bet.amount, 0n);
    const traders = new Set(
      activity.bets.map((bet) => bet.bettor.toLowerCase()),
    ).size;
    return { volume, traders };
  }, [activity.bets]);

  return (
    <main className="pb-20">
      <section className="relative overflow-hidden border-b border-white/[0.055]">
        <div className="mx-auto grid min-h-[380px] w-full max-w-[1440px] items-end gap-10 px-4 pb-12 pt-20 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8 lg:pb-14 lg:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="mb-5 flex items-center gap-2">
              <span className="h-px w-8 bg-emerald-300" />
              <span className="data-label text-emerald-300">
                Prediction markets · native USDC
              </span>
            </div>
            <h1 className="max-w-4xl font-display text-5xl font-semibold leading-[0.95] tracking-[-0.065em] text-white sm:text-6xl lg:text-8xl">
              Price conviction.
              <br />
              <span className="text-slate-600">Trade the outcome.</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
              Binary markets settled transparently on Arc. Every pool, order,
              and payout is verifiable in real time.
            </p>
          </motion.div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] lg:w-[430px]">
            <div className="bg-slate-950/80 p-4">
              <CircleDollarSign className="size-4 text-emerald-300" />
              <p className="mt-5 data-label">Volume</p>
              <p className="mt-1 font-mono text-sm font-semibold text-white">
                {formatUsdc(protocolStats.volume, 1)}
              </p>
            </div>
            <div className="bg-slate-950/80 p-4">
              <Blocks className="size-4 text-cyan-300" />
              <p className="mt-5 data-label">Trades</p>
              <p className="mt-1 font-mono text-sm font-semibold text-white">
                {activity.bets.length}
              </p>
            </div>
            <div className="bg-slate-950/80 p-4">
              <ShieldCheck className="size-4 text-violet-300" />
              <p className="mt-5 data-label">Traders</p>
              <p className="mt-1 font-mono text-sm font-semibold text-white">
                {protocolStats.traders}
              </p>
            </div>
          </div>
        </div>
        <a
          href="#markets"
          className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 text-slate-700 transition hover:text-cyan-300 lg:block"
          aria-label="Scroll to markets"
        >
          <ArrowDown className="size-5 animate-bounce" />
        </a>
      </section>

      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <section id="markets" className="scroll-mt-24 py-10 sm:py-14">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="data-label">Featured binary market</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] text-white">
                Trade the live book
              </h2>
            </div>
            <div className="flex w-full gap-2 sm:max-w-xl">
              <div className="min-w-0 flex-1">
                <MarketLookup onMarketChange={changeMarket} />
              </div>
              <button
                type="button"
                className="soft-button shrink-0 px-3 sm:px-4"
                onClick={() => setIsNewMarketOpen(true)}
              >
                <Plus className="size-4 text-cyan-300" />
                <span className="hidden sm:inline">New Market</span>
              </button>
            </div>
          </div>
          <HowItWorks />
          <FeaturedMarkets
            markets={featured.markets}
            activeMarketId={marketId}
            isLoading={featured.isLoading}
            error={featured.error}
            onSelect={changeMarket}
          />
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <MarketCard
              key={marketId}
              marketId={marketId}
              marketLabel={marketLabel}
            />
            <ActivityFeed
              bets={activity.bets}
              isLoading={activity.isLoading}
              error={activity.error}
              isRateLimited={activity.isRateLimited}
            />
          </div>
        </section>

        <Portfolio
          key={marketId}
          marketId={marketId}
          marketLabel={marketLabel}
          bets={activity.bets}
        />
      </div>
      <NewMarketModal
        open={isNewMarketOpen}
        onClose={() => setIsNewMarketOpen(false)}
        onCreated={(createdMarketId, label) => {
          featured.addMarket(createdMarketId, label);
          changeMarket(createdMarketId, label);
          setIsNewMarketOpen(false);
        }}
      />
    </main>
  );
}
