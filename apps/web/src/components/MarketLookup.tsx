// apps/web/src/components/MarketLookup.tsx
"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { isHex, keccak256, stringToHex, type Hex } from "viem";

interface MarketLookupProps {
  onMarketChange: (marketId: Hex, label: string) => void;
}

function normalizeMarketId(value: string): Hex | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isHex(trimmed) && trimmed.length === 66) return trimmed as Hex;
  return keccak256(stringToHex(trimmed));
}

export function MarketLookup({ onMarketChange }: MarketLookupProps) {
  const [input, setInput] = useState("");

  return (
    <form
      className="flex w-full items-center gap-2 rounded-2xl border border-white/[0.08] bg-slate-950/65 p-2 backdrop-blur-xl"
      onSubmit={(event) => {
        event.preventDefault();
        const normalized = normalizeMarketId(input);
        if (normalized) onMarketChange(normalized, input.trim());
      }}
    >
      <Search className="ml-2 size-4 shrink-0 text-slate-500" />
      <input
        className="min-w-0 flex-1 bg-transparent px-1 py-2 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Enter market label..."
        aria-label="Market label or identifier"
        autoComplete="off"
        spellCheck={false}
      />
      <button className="soft-button shrink-0 px-3 py-2 text-xs" type="submit">
        Load
      </button>
    </form>
  );
}
