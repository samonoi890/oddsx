// apps/web/src/components/BetForm.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, LoaderCircle, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { formatEther, parseEther, type Hex } from "viem";
import { useAccount, useBalance } from "wagmi";
import { arcTestnet } from "@oddsx/config";
import { useMarketActions } from "@/hooks/useMarketActions";
import { getSafeErrorMessage } from "@/lib/errors";
import { formatUsdc } from "@/lib/format";

const MAX_UINT256 = (1n << 256n) - 1n;

interface BetFormProps {
  marketId: Hex;
  outcome: number;
  onOutcomeChange: (outcome: number) => void;
  totalPool: bigint;
  outcomePools: bigint[];
  feeBps: number;
  onConfirmed: () => void;
}

function parseAmount(value: string) {
  try {
    return value.trim() ? parseEther(value.trim()) : 0n;
  } catch {
    return 0n;
  }
}

export function BetForm({
  marketId,
  outcome,
  onOutcomeChange,
  totalPool,
  outcomePools,
  feeBps,
  onConfirmed,
}: BetFormProps) {
  const { address, isConnected } = useAccount();
  const balance = useBalance({ address, chainId: arcTestnet.id });
  const [amount, setAmount] = useState("10");
  const [validationError, setValidationError] = useState<string | null>(null);
  const {
    placeNativeBet,
    isPending,
    isConfirmed,
    transactionHash,
    actionError,
    isCorrectChain,
  } = useMarketActions(marketId, onConfirmed);

  const parsedAmount = useMemo(() => parseAmount(amount), [amount]);
  const { potentialReturn, poolShare, multiplier } = useMemo(() => {
    const selectedPool = outcomePools[outcome] ?? 0n;
    const postBetTotal = totalPool + parsedAmount;
    const postBetOutcomePool = selectedPool + parsedAmount;
    const distributable =
      postBetTotal - (postBetTotal * BigInt(feeBps)) / 10_000n;
    const nextPotentialReturn =
      parsedAmount > 0n && postBetOutcomePool > 0n
        ? (parsedAmount * distributable) / postBetOutcomePool
        : 0n;
    return {
      potentialReturn: nextPotentialReturn,
      poolShare:
        parsedAmount > 0n && postBetOutcomePool > 0n
          ? Number((parsedAmount * 10_000n) / postBetOutcomePool) / 100
          : 0,
      multiplier:
        parsedAmount > 0n
          ? Number((nextPotentialReturn * 100n) / parsedAmount) / 100
          : 0,
    };
  }, [feeBps, outcome, outcomePools, parsedAmount, totalPool]);

  const addPreset = (addition: bigint) => {
    setAmount(formatEther(parseAmount(amount) + addition));
    setValidationError(null);
  };

  const setMax = () => {
    if (!balance.data) return;
    const spendable = (balance.data.value * 95n) / 100n;
    setAmount(formatEther(spendable));
    setValidationError(null);
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const normalizedAmount = amount.trim();
        if (!isConnected)
          return setValidationError("Connect your wallet to trade.");
        if (!isCorrectChain)
          return setValidationError(
            "Switch your wallet to Arc Testnet to trade.",
          );
        if (!normalizedAmount) return setValidationError("Enter a bet amount.");

        let value: bigint;
        try {
          value = parseEther(normalizedAmount);
        } catch {
          return setValidationError(
            "Enter a valid USDC amount with no more than 18 decimals.",
          );
        }
        if (value <= 0n)
          return setValidationError("Bet amount must be greater than zero.");
        if (value > MAX_UINT256)
          return setValidationError("Bet amount is too large.");
        if (balance.data && value >= balance.data.value) {
          return setValidationError(
            "Leave enough native USDC to pay Arc network fees.",
          );
        }
        setValidationError(null);
        placeNativeBet(outcome, value);
      }}
    >
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/70 p-1.5">
        {[0, 1].map((index) => {
          const yes = index === 0;
          const active = outcome === index;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onOutcomeChange(index)}
              className={`relative rounded-xl px-4 py-3 text-sm font-extrabold transition ${
                active
                  ? yes
                    ? "bg-emerald-300 text-emerald-950 shadow-yes"
                    : "bg-rose-300 text-rose-950 shadow-no"
                  : "text-slate-500 hover:text-slate-200"
              }`}
            >
              {yes ? "YES" : "NO"}
              <span className="ml-2 font-mono text-[10px] opacity-70">
                {formatUsdc(outcomePools[index] ?? 0n)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="data-label">Order size</span>
          <span className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
            <Wallet className="size-3" />
            {balance.data ? formatUsdc(balance.data.value, 2) : "—"} USDC
          </span>
        </div>
        <div className="relative">
          <input
            className="field h-16 pr-20 font-mono text-xl font-semibold"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setValidationError(null);
            }}
            aria-label="Bet amount in USDC"
            aria-invalid={Boolean(validationError)}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
            USDC
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => addPreset(10n * 10n ** 18n)}
            className="soft-button py-2 text-xs"
          >
            +10 USDC
          </button>
          <button
            type="button"
            onClick={() => addPreset(50n * 10n ** 18n)}
            className="soft-button py-2 text-xs"
          >
            +50 USDC
          </button>
          <button
            type="button"
            onClick={setMax}
            className="soft-button py-2 text-xs"
            title="Uses 95% and reserves 5% for Arc gas"
          >
            MAX
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07]">
        <div className="bg-slate-950/80 p-4">
          <p className="data-label">Potential return</p>
          <p className="mt-2 font-mono text-lg font-semibold text-white">
            {formatUsdc(potentialReturn, 2)}{" "}
            <span className="text-xs text-slate-500">USDC</span>
          </p>
          <p className="mt-1 text-[10px] text-emerald-300">
            {multiplier.toFixed(2)}× if correct
          </p>
        </div>
        <div className="bg-slate-950/80 p-4">
          <p className="data-label">Est. pool share</p>
          <p className="mt-2 font-mono text-lg font-semibold text-white">
            {poolShare.toFixed(2)}%
          </p>
          <p className="mt-1 text-[10px] text-slate-500">After this order</p>
        </div>
      </div>

      <AnimatePresence>
        {validationError || actionError || (isConnected && !isCorrectChain) ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-xs text-rose-200"
            role="alert"
          >
            {validationError ??
              (actionError
                ? getSafeErrorMessage(
                    actionError,
                    "The transaction could not be completed. Please try again.",
                  )
                : "Switch your wallet to Arc Testnet to trade.")}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <button
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
          outcome === 0
            ? "bg-emerald-300 text-emerald-950 hover:bg-emerald-200"
            : "bg-rose-300 text-rose-950 hover:bg-rose-200"
        }`}
        type="submit"
        disabled={isPending || isConfirmed || !isCorrectChain}
      >
        {isConfirmed ? (
          <>
            <CheckCircle2 className="size-4" /> Position confirmed
          </>
        ) : isPending ? (
          <>
            <LoaderCircle className="size-4 animate-spin" /> Confirming on Arc…
          </>
        ) : (
          <>
            Buy {outcome === 0 ? "YES" : "NO"}{" "}
            <ArrowUpRight className="size-4" />
          </>
        )}
      </button>

      {transactionHash ? (
        <a
          href={`https://testnet.arcscan.app/tx/${transactionHash}`}
          target="_blank"
          rel="noreferrer"
          className="block text-center font-mono text-[10px] text-cyan-300 hover:text-cyan-200"
        >
          View transaction on ArcScan ↗
        </a>
      ) : null}
    </form>
  );
}
