"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Coins,
  RotateCcw,
  TrendingUp,
  Trophy,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

const DISMISSAL_KEY = "oddsx:how-it-works:dismissed";

interface OnboardingStep {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  surface: string;
}

const steps: OnboardingStep[] = [
  {
    title: "Connect Wallet",
    description:
      "Switch to Arc Testnet, then connect the wallet you use to hold native USDC.",
    icon: Wallet,
    accent: "text-cyan-300",
    surface: "border-cyan-300/20 bg-cyan-300/[0.06]",
  },
  {
    title: "Analyze Odds",
    description:
      "Review the live YES/NO pool ratio and your estimated USDC payout multiplier.",
    icon: TrendingUp,
    accent: "text-violet-300",
    surface: "border-violet-300/20 bg-violet-300/[0.06]",
  },
  {
    title: "Cast Prediction",
    description:
      "Choose YES or NO and commit native USDC to that outcome's shared pool.",
    icon: Coins,
    accent: "text-emerald-300",
    surface: "border-emerald-300/20 bg-emerald-300/[0.06]",
  },
  {
    title: "Claim Payout",
    description:
      "After resolution, claim your pro-rata share of the distributable pool onchain.",
    icon: Trophy,
    accent: "text-amber-300",
    surface: "border-amber-300/20 bg-amber-300/[0.06]",
  },
];

export function HowItWorks() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    try {
      setIsDismissed(window.localStorage.getItem(DISMISSAL_KEY) === "true");
    } catch {
      // Storage may be disabled; the guide remains available for this session.
    }
  }, []);

  const dismiss = () => {
    setIsDismissed(true);
    try {
      window.localStorage.setItem(DISMISSAL_KEY, "true");
    } catch {
      // The in-memory dismissal still keeps the current session unobstructed.
    }
  };

  const restore = () => {
    setIsDismissed(false);
    setIsExpanded(true);
    try {
      window.localStorage.removeItem(DISMISSAL_KEY);
    } catch {
      // Restoring the in-memory state is sufficient when storage is unavailable.
    }
  };

  if (isDismissed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-slate-950/45 px-4 py-3"
      >
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg border border-cyan-300/15 bg-cyan-300/[0.05] text-cyan-300">
            <RotateCcw className="size-3.5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-300">
              Need a protocol refresher?
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
              Wallet to payout in four steps
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={restore}
          className="soft-button px-3 py-2 text-xs"
        >
          Open guide
        </button>
      </motion.div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel relative mb-5 overflow-hidden rounded-[24px]"
      aria-labelledby="how-oddsx-works-title"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
      <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 font-mono text-[10px] font-bold text-cyan-300">
            01-04
          </span>
          <div>
            <h3
              id="how-oddsx-works-title"
              className="font-display text-lg font-semibold tracking-[-0.025em] text-white"
            >
              How OddsX works
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              One shared pool sets the odds. Winning positions divide the payout
              in proportion to their stake.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="soft-button size-9 p-0"
            aria-expanded={isExpanded}
            aria-controls="how-oddsx-works-steps"
            aria-label={isExpanded ? "Collapse guide" : "Expand guide"}
          >
            {isExpanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="soft-button size-9 p-0 text-slate-500 hover:text-rose-200"
            aria-label="Dismiss guide"
            title="Dismiss guide"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            id="how-oddsx-works-steps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="relative border-t border-white/[0.06] px-4 pb-5 pt-5 sm:px-5">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <motion.article
                      key={step.title}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06 }}
                      whileHover={{ y: -3 }}
                      className="group relative rounded-2xl border border-white/[0.07] bg-slate-950/35 p-3 transition hover:border-white/[0.12] hover:bg-white/[0.035]"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`grid size-11 place-items-center rounded-xl border ${step.surface} ${step.accent}`}
                        >
                          <Icon className="size-4.5" />
                        </span>
                        <span className="font-mono text-[9px] font-bold tracking-[0.16em] text-slate-700 transition group-hover:text-slate-500">
                          0{index + 1}
                        </span>
                      </div>
                      <h4 className="mt-4 text-sm font-bold text-slate-200">
                        {step.title}
                      </h4>
                      <p className="mt-1.5 text-xs leading-5 text-slate-500">
                        {step.description}
                      </p>
                    </motion.article>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
