// apps/web/src/providers/Web3Provider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "@wagmi/core";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import {
  ARC_TESTNET_RPC_URL,
  arcTestnet,
  supportedChains,
} from "@oddsx/config";
import { isRpcRateLimitError } from "@/lib/rpc";

const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [injected()],
  batch: {
    multicall: {
      wait: 100,
    },
  },
  pollingInterval: 12_000,
  transports: {
    [arcTestnet.id]: http(ARC_TESTNET_RPC_URL, {
      retryCount: 1,
      retryDelay: 1_000,
      timeout: 10_000,
    }),
  },
  ssr: true,
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 12_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) =>
              !isRpcRateLimitError(error) && failureCount < 2,
            retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
