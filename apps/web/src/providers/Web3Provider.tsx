// apps/web/src/providers/Web3Provider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import {
  ARC_TESTNET_RPC_URL,
  arcTestnet,
  supportedChains,
} from "@oddsx/config";
import { isRpcRateLimitError } from "@/lib/rpc";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [
    injected(),
    coinbaseWallet({ appName: "OddsX" }),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: {
              name: "OddsX",
              description: "Binary prediction markets on Arc Testnet",
              url: "https://oddsx-web-beta.vercel.app",
              icons: [],
            },
            showQrModal: true,
          }),
        ]
      : []),
  ],
  batch: {
    multicall: {
      wait: 100,
    },
  },
  pollingInterval: 30_000,
  transports: {
    [arcTestnet.id]: http(ARC_TESTNET_RPC_URL, {
      // The public Arc RPC rate-limits per HTTP request, not per JSON-RPC call
      // (verified: 50 individual calls => mostly 429; the same calls sent as a
      // handful of batches => all 200). Coalescing the burst the app makes on
      // load into a few batched HTTP requests is what stops the "Arc offline"
      // flapping. Retry with backoff absorbs any remaining transient 429s.
      batch: { wait: 16, batchSize: 20 },
      retryCount: 3,
      retryDelay: 1_000,
      timeout: 15_000,
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
