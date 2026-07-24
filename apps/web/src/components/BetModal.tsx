// apps/web/src/components/BetModal.tsx
"use client";

import type { Hex } from "viem";
import { BetForm } from "./BetForm";
import { Modal } from "./Modal";

interface BetModalProps {
  open: boolean;
  onClose: () => void;
  marketId: Hex;
  marketTitle: string;
  outcome: number;
  onOutcomeChange: (outcome: number) => void;
  totalPool: bigint;
  outcomePools: bigint[];
  feeBps: number;
  onConfirmed: () => void;
}

export function BetModal(props: BetModalProps) {
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      eyebrow="Place order · Native USDC"
      title={props.marketTitle}
    >
      <BetForm
        marketId={props.marketId}
        outcome={props.outcome}
        onOutcomeChange={props.onOutcomeChange}
        totalPool={props.totalPool}
        outcomePools={props.outcomePools}
        feeBps={props.feeBps}
        onConfirmed={props.onConfirmed}
      />
    </Modal>
  );
}
