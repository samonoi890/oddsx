"use client";

import { Gavel, LoaderCircle, ShieldAlert } from "lucide-react";
import { useState } from "react";
import type { Hex } from "viem";
import { useAccount } from "wagmi";
import { useMarketLifecycleActions } from "@/hooks/useMarketLifecycleActions";
import type { MarketView } from "@/hooks/useMarket";
import { getSafeErrorMessage } from "@/lib/errors";

export function MarketLifecyclePanel({
  marketId,
  market,
  currentTime,
  onConfirmed,
}: {
  marketId: Hex;
  market: MarketView;
  currentTime: number;
  onConfirmed: () => void;
}) {
  const { address } = useAccount();
  const [reason, setReason] = useState("ORACLE_FAILURE");
  const lifecycle = useMarketLifecycleActions(marketId, onConfirmed);
  const isOracle = address?.toLowerCase() === market.oracle.toLowerCase();
  const canResolve = isOracle || lifecycle.hasResolverRole;
  const canCancel = lifecycle.hasCancellerRole;

  if (market.state !== 1 || !address || (!canResolve && !canCancel)) {
    return null;
  }

  const resolutionAvailableAt =
    Number(market.endTime) + Number(lifecycle.resolutionDelay);
  const resolutionReady = currentTime >= resolutionAvailableAt;

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-amber-300/15 bg-amber-300/[0.035]">
      <div className="flex items-start gap-3 border-b border-amber-300/10 p-4">
        <Gavel className="mt-0.5 size-4 shrink-0 text-amber-200" />
        <div>
          <p className="data-label text-amber-100">Settlement controls</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            {isOracle
              ? "You are this market’s designated oracle."
              : "Your wallet holds the resolver role."}
          </p>
        </div>
      </div>

      {canResolve ? (
        <div className="p-4">
          <p className="text-[11px] leading-5 text-slate-400">
            {resolutionReady
              ? "Choose the objectively correct outcome. If it has no stake, the contract cancels the market and enables refunds."
              : `Resolution unlocks after the market deadline${lifecycle.resolutionDelay > 0n ? " and configured delay" : ""}.`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-2.5 text-xs font-black text-emerald-200 transition hover:bg-emerald-300/[0.1] disabled:opacity-40"
              disabled={
                !resolutionReady ||
                lifecycle.isPending ||
                !lifecycle.isCorrectChain
              }
              onClick={() => lifecycle.resolveMarket(0)}
            >
              Resolve YES
            </button>
            <button
              type="button"
              className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-3 py-2.5 text-xs font-black text-rose-200 transition hover:bg-rose-300/[0.1] disabled:opacity-40"
              disabled={
                !resolutionReady ||
                lifecycle.isPending ||
                !lifecycle.isCorrectChain
              }
              onClick={() => lifecycle.resolveMarket(1)}
            >
              Resolve NO
            </button>
          </div>
        </div>
      ) : null}

      {canCancel ? (
        <div className="border-t border-amber-300/10 p-4">
          <label
            className="data-label mb-2 block"
            htmlFor="cancellation-reason"
          >
            Cancellation reason
          </label>
          <div className="flex gap-2">
            <input
              id="cancellation-reason"
              className="field min-w-0 flex-1 py-2 font-mono text-xs"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={80}
            />
            <button
              type="button"
              className="soft-button shrink-0 px-3 text-xs text-amber-100"
              disabled={
                lifecycle.isPending ||
                !reason.trim() ||
                !lifecycle.isCorrectChain
              }
              onClick={() => lifecycle.cancelMarket(reason)}
            >
              Cancel market
            </button>
          </div>
        </div>
      ) : null}

      {!lifecycle.isCorrectChain ? (
        <p className="border-t border-amber-300/10 px-4 py-3 text-[10px] text-amber-100">
          Switch your wallet to Arc Testnet to settle this market.
        </p>
      ) : null}

      {lifecycle.isPending ? (
        <p className="flex items-center gap-2 border-t border-amber-300/10 px-4 py-3 text-[10px] text-amber-100">
          <LoaderCircle className="size-3 animate-spin" /> Confirming settlement
          action on Arc…
        </p>
      ) : lifecycle.error ? (
        <p className="flex items-start gap-2 border-t border-rose-300/10 px-4 py-3 text-[10px] leading-5 text-rose-200">
          <ShieldAlert className="mt-0.5 size-3 shrink-0" />
          {getSafeErrorMessage(
            lifecycle.error,
            "The settlement action could not be completed.",
          )}
        </p>
      ) : null}

      {lifecycle.transactionHash ? (
        <a
          className="block border-t border-amber-300/10 px-4 py-3 font-mono text-[10px] text-cyan-300"
          href={`https://testnet.arcscan.app/tx/${lifecycle.transactionHash}`}
          target="_blank"
          rel="noreferrer"
        >
          Settlement transaction on ArcScan ↗
        </a>
      ) : null}
    </section>
  );
}
