// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import { Header } from "@/components/Header";
import { Web3Provider } from "@/providers/Web3Provider";

export const metadata: Metadata = {
  title: "OddsX — Arc Prediction Markets",
  description: "Trade verifiable outcomes with native USDC on Arc Testnet.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-ink">
      <body className="font-sans antialiased">
        <Web3Provider>
          <Header />
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
