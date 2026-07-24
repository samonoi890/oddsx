// apps/web/src/components/Header.tsx
"use client";

import { arcTestnet } from "@oddsx/config";
import { motion } from "framer-motion";
import { ChevronDown, Radio, Wallet } from "lucide-react";
import Link from "next/link";
import { formatEther } from "viem";
import {
  useAccount,
  useBalance,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { shortenAddress } from "@/lib/format";

const navigation = [
  ["Markets", "#markets"],
  ["Portfolio", "#portfolio"],
] as const;

export function Header() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const balance = useBalance({ address, chainId: arcTestnet.id });
  const connector = connectors[0];
  const isArc = chainId === arcTestnet.id;
  const avatarHue = address
    ? Number.parseInt(address.slice(2, 6), 16) % 360
    : 150;

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-slate-950/75 backdrop-blur-2xl">
      <div className="mx-auto flex min-h-[72px] w-full max-w-[1440px] items-center gap-5 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label="OddsX home"
        >
          <span className="relative grid size-9 place-items-center rounded-xl border border-emerald-300/30 bg-emerald-300/[0.08] font-display text-sm font-bold text-emerald-300 shadow-yes">
            OX
            <span className="absolute inset-0 rounded-xl border border-emerald-300/20 opacity-0 transition group-hover:scale-125 group-hover:opacity-100" />
          </span>
          <span className="font-display text-xl font-semibold tracking-[-0.04em] text-white">
            Odds<span className="text-emerald-300">X</span>
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Primary navigation"
        >
          {navigation.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.05] px-3 py-1.5 sm:flex">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping-soft rounded-full bg-emerald-300" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-300" />
            </span>
            <Radio className="size-3 text-emerald-300" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200">
              Arc live
            </span>
          </div>

          {isConnected && address ? (
            !isArc ? (
              <button
                className="primary-button"
                type="button"
                disabled={isSwitching}
                onClick={() => switchChain({ chainId: arcTestnet.id })}
              >
                {isSwitching ? "Switching…" : "Switch to Arc"}
              </button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] p-1.5 pr-3 transition hover:border-white/20 hover:bg-white/[0.07]"
                type="button"
                onClick={() => disconnect()}
                title="Disconnect wallet"
              >
                <span
                  className="grid size-8 place-items-center rounded-lg text-xs font-black text-white"
                  style={{
                    background: `linear-gradient(135deg, hsl(${avatarHue} 80% 55%), hsl(${(avatarHue + 95) % 360} 80% 45%))`,
                  }}
                >
                  {address.slice(2, 4).toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block font-mono text-[10px] font-bold text-white">
                    {shortenAddress(address)}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {balance.data
                      ? Number(formatEther(balance.data.value)).toLocaleString(
                          undefined,
                          { maximumFractionDigits: 2 },
                        )
                      : "—"}{" "}
                    USDC
                  </span>
                </span>
                <ChevronDown className="size-3.5 text-slate-500" />
              </motion.button>
            )
          ) : (
            <motion.button
              whileTap={{ scale: 0.98 }}
              className="primary-button"
              type="button"
              disabled={!connector || isPending}
              onClick={() =>
                connector && connect({ connector, chainId: arcTestnet.id })
              }
            >
              <Wallet className="size-4" />
              <span className="hidden sm:inline">
                {isPending ? "Connecting…" : "Connect wallet"}
              </span>
              <span className="sm:hidden">Connect</span>
            </motion.button>
          )}
        </div>
      </div>
    </header>
  );
}
