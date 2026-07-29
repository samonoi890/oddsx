"use client";

import { arcTestnet } from "@oddsx/config";
import {
  CalendarClock,
  CheckCircle2,
  FlaskConical,
  Gavel,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Hex } from "viem";
import { useChainId, useSwitchChain } from "wagmi";
import { useCreateMarket } from "@/hooks/useCreateMarket";
import { getSafeErrorMessage } from "@/lib/errors";
import { TEST_MARKET_TEMPLATES } from "@/lib/marketCatalog";
import { Modal } from "./Modal";

interface NewMarketModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (marketId: Hex, label: string) => void;
}

function defaultExpiry() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function normalizeLabel(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function NewMarketModal({
  open,
  onClose,
  onCreated,
}: NewMarketModalProps) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [expiry, setExpiry] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const handleConfirmed = useCallback(
    (marketId: Hex, createdLabel: string) => {
      onCreated(marketId, createdLabel);
      setLabel("");
      setDescription("");
      setExpiry(defaultExpiry());
    },
    [onCreated],
  );
  const creation = useCreateMarket(handleConfirmed);

  useEffect(() => {
    if (!open) return;
    setValidationError(null);
    setExpiry(defaultExpiry());
  }, [open]);

  const normalizedLabel = normalizeLabel(label);
  const isArc = chainId === arcTestnet.id;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Permissionless · Native USDC"
      title="Create a market"
    >
      <div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-cyan-300" />
          <p className="text-xs leading-5 text-slate-400">
            Anyone can open a two-outcome (YES/NO) native USDC market. Liquidity
            is provided by traders&apos; bets; the protocol fee is fixed by the
            contract.
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4">
        <div className="flex items-start gap-3">
          <Gavel className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <p className="text-[11px] leading-5 text-amber-100/80">
            You will be set as this market&apos;s <strong>oracle</strong> — the
            wallet trusted to report the winning outcome after expiry. Traders
            should only take positions in markets whose resolver they trust.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="data-label mb-2">Quick templates</p>
        <div className="flex flex-wrap gap-2">
          {TEST_MARKET_TEMPLATES.map((template) => (
            <button
              key={template.label}
              type="button"
              className="soft-button px-3 py-2 font-mono text-[10px]"
              onClick={() => {
                setLabel(template.label);
                setDescription(template.description);
              }}
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>

      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setValidationError(null);
          if (!creation.isConnected) {
            setValidationError("Connect your wallet to create a market.");
            return;
          }
          const expiryMs = new Date(expiry).getTime();
          if (!normalizedLabel) {
            setValidationError("Enter a market label.");
            return;
          }
          if (!description.trim()) {
            setValidationError("Enter a clear market question.");
            return;
          }
          if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) {
            setValidationError("Choose a future market expiry.");
            return;
          }
          creation.createMarket({
            label: normalizedLabel,
            description: description.trim(),
            endTime: BigInt(Math.floor(expiryMs / 1_000)),
          });
        }}
      >
        <label className="block">
          <span className="data-label mb-2 block">Market label</span>
          <input
            className="field font-mono"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. BTC_ABOVE_100000"
            autoComplete="off"
          />
          {normalizedLabel && normalizedLabel !== label ? (
            <span className="mt-1.5 block font-mono text-[10px] text-cyan-300/70">
              ID label: {normalizedLabel}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="data-label mb-2 block">Market question</span>
          <textarea
            className="field min-h-24 resize-none"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Define the exact condition that will settle YES."
          />
        </label>

        <label className="block">
          <span className="data-label mb-2 flex items-center gap-2">
            <CalendarClock className="size-3" /> Expiry
          </span>
          <input
            className="field [color-scheme:dark]"
            type="datetime-local"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          />
        </label>

        {validationError ? (
          <p className="rounded-xl border border-rose-400/15 bg-rose-400/[0.06] px-3 py-2 text-xs text-rose-200">
            {validationError}
          </p>
        ) : null}
        {creation.error ? (
          <p className="rounded-xl border border-rose-400/15 bg-rose-400/[0.06] px-3 py-2 text-xs text-rose-200">
            {getSafeErrorMessage(
              creation.error,
              "The market transaction could not be completed. Please try again.",
            )}
          </p>
        ) : null}

        {!creation.isConnected ? (
          <p className="text-xs text-amber-200/80">
            Connect your wallet to continue.
          </p>
        ) : null}

        {creation.transactionHash ? (
          <a
            className="flex items-center gap-2 font-mono text-[10px] text-cyan-300 hover:text-cyan-200"
            href={`https://testnet.arcscan.app/tx/${creation.transactionHash}`}
            target="_blank"
            rel="noreferrer"
          >
            <CheckCircle2 className="size-3.5" /> View transaction on ArcScan
          </a>
        ) : null}

        {creation.isConnected && !isArc ? (
          <button
            className="primary-button w-full"
            type="button"
            disabled={isSwitching}
            onClick={() => switchChain({ chainId: arcTestnet.id })}
          >
            {isSwitching ? "Switching…" : "Switch to Arc Testnet"}
          </button>
        ) : (
          <button
            className="primary-button w-full"
            type="submit"
            disabled={!creation.isConnected || creation.isPending}
          >
            {creation.isPending
              ? "Confirming on Arc…"
              : !creation.isConnected
                ? "Connect wallet to create"
                : "Create market"}
          </button>
        )}
      </form>
    </Modal>
  );
}
