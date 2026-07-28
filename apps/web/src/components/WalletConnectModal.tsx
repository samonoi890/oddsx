"use client";

import { LoaderCircle, Wallet } from "lucide-react";
import { useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { arcTestnet } from "@oddsx/config";
import { getSafeErrorMessage } from "@/lib/errors";
import { Modal } from "./Modal";

export function WalletConnectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isConnected } = useAccount();
  const { connectors, connect, error, isPending, variables } = useConnect();

  useEffect(() => {
    if (isConnected && open) onClose();
  }, [isConnected, onClose, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Arc Testnet"
      title="Choose a wallet"
    >
      <div className="space-y-2">
        {connectors.map((connector) => {
          const connecting = isPending && variables?.connector === connector;
          return (
            <button
              key={connector.uid}
              type="button"
              className="soft-button w-full justify-between px-4 py-3"
              disabled={isPending}
              onClick={() => connect({ connector, chainId: arcTestnet.id })}
            >
              <span className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05]">
                  <Wallet className="size-4 text-cyan-300" />
                </span>
                <span className="text-sm font-bold text-slate-200">
                  {connector.name}
                </span>
              </span>
              {connecting ? (
                <LoaderCircle className="size-4 animate-spin text-cyan-300" />
              ) : (
                <span className="font-mono text-[10px] text-slate-600">
                  Connect
                </span>
              )}
            </button>
          );
        })}
      </div>
      {error ? (
        <p
          className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-xs text-rose-200"
          role="alert"
        >
          {getSafeErrorMessage(
            error,
            "The wallet connection could not be completed.",
          )}
        </p>
      ) : null}
      <p className="mt-4 text-[10px] leading-5 text-slate-600">
        WalletConnect appears when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is
        configured. Arc Testnet will be requested during connection.
      </p>
    </Modal>
  );
}
