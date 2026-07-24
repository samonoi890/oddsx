"use client";

import { motion } from "framer-motion";
import {
  ChartNoAxesCombined,
  Network,
  Target,
  TrendingDown,
  TrendingUp,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CandlestickData,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";
import { getMarketPriceFeed } from "@/lib/marketPrice";

type FeedStatus = "loading" | "live" | "reconnecting" | "offline";

const BINANCE_REST_URL = "https://data-api.binance.vision";
const BINANCE_STREAM_URL = "wss://stream.binance.com:443";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPrice(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  });
}

function statusCopy(status: FeedStatus) {
  if (status === "live") return "Live";
  if (status === "offline") return "Offline";
  if (status === "reconnecting") return "Reconnecting";
  return "Loading";
}

export function PriceChart({
  marketLabel,
  description,
}: {
  marketLabel: string;
  description: string;
}) {
  const feed = useMemo(
    () => getMarketPriceFeed(marketLabel, description),
    [description, marketLabel],
  );
  const chartContainer = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<FeedStatus>("loading");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);

  useEffect(() => {
    if (!feed || !chartContainer.current) return;
    const activeFeed = feed;

    let disposed = false;
    let chart: IChartApi | null = null;
    let candleSeries: ISeriesApi<"Candlestick"> | null = null;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let historyTimeout: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const historyController = new AbortController();

    setStatus(navigator.onLine ? "loading" : "offline");
    setCurrentPrice(null);
    setChange24h(null);
    setLastUpdated(null);
    setHistoryUnavailable(false);

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      clearReconnectTimer();
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      setStatus("reconnecting");
      const delay = Math.min(1_000 * 2 ** reconnectAttempt, 15_000);
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(connectStream, delay);
    };

    const updateCandle = (event: Record<string, unknown>) => {
      if (!candleSeries || !isRecord(event.k)) return;
      const openTime = finiteNumber(event.k.t);
      const open = finiteNumber(event.k.o);
      const high = finiteNumber(event.k.h);
      const low = finiteNumber(event.k.l);
      const close = finiteNumber(event.k.c);
      if (
        openTime === null ||
        open === null ||
        high === null ||
        low === null ||
        close === null
      ) {
        return;
      }
      candleSeries.update({
        time: Math.floor(openTime / 1_000) as UTCTimestamp,
        open,
        high,
        low,
        close,
      });
      setCurrentPrice(close);
      setLastUpdated(new Date());
    };

    const updateTicker = (event: Record<string, unknown>) => {
      const lastPrice = finiteNumber(event.c);
      const percentChange = finiteNumber(event.P);
      if (lastPrice !== null) setCurrentPrice(lastPrice);
      if (percentChange !== null) setChange24h(percentChange);
      if (lastPrice !== null || percentChange !== null) {
        setLastUpdated(new Date());
      }
    };

    function connectStream() {
      if (
        disposed ||
        !navigator.onLine ||
        socket?.readyState === WebSocket.OPEN ||
        socket?.readyState === WebSocket.CONNECTING
      ) {
        if (!navigator.onLine) setStatus("offline");
        return;
      }

      clearReconnectTimer();
      const streamSymbol = activeFeed.symbol.toLowerCase();
      try {
        socket = new WebSocket(
          `${BINANCE_STREAM_URL}/stream?streams=${streamSymbol}@kline_1m/${streamSymbol}@ticker`,
        );
      } catch {
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        reconnectAttempt = 0;
        setStatus("live");
      };
      socket.onmessage = (message) => {
        try {
          const envelope: unknown = JSON.parse(String(message.data));
          if (!isRecord(envelope) || !isRecord(envelope.data)) return;
          const event = envelope.data;
          if (event.e === "kline") updateCandle(event);
          if (event.e === "24hrTicker") updateTicker(event);
        } catch {
          // Ignore malformed external events and keep the healthy stream open.
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        socket = null;
        scheduleReconnect();
      };
    }

    const loadHistory = async () => {
      historyTimeout = window.setTimeout(
        () => historyController.abort(),
        8_000,
      );
      try {
        const response = await fetch(
          `${BINANCE_REST_URL}/api/v3/klines?symbol=${activeFeed.symbol}&interval=1m&limit=180`,
          { cache: "no-store", signal: historyController.signal },
        );
        if (!response.ok) throw new Error("Historical price request failed.");
        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) throw new Error("Invalid price history.");

        const candles = payload.flatMap(
          (entry): CandlestickData<UTCTimestamp>[] => {
            if (!Array.isArray(entry)) return [];
            const openTime = finiteNumber(entry[0]);
            const open = finiteNumber(entry[1]);
            const high = finiteNumber(entry[2]);
            const low = finiteNumber(entry[3]);
            const close = finiteNumber(entry[4]);
            if (
              openTime === null ||
              open === null ||
              high === null ||
              low === null ||
              close === null
            ) {
              return [];
            }
            return [
              {
                time: Math.floor(openTime / 1_000) as UTCTimestamp,
                open,
                high,
                low,
                close,
              },
            ];
          },
        );
        if (disposed || candles.length === 0 || !candleSeries || !chart) return;
        candleSeries.setData(candles);
        setCurrentPrice(candles.at(-1)?.close ?? null);
        chart.timeScale().fitContent();
      } catch {
        if (!disposed) setHistoryUnavailable(true);
      } finally {
        if (historyTimeout !== null) {
          window.clearTimeout(historyTimeout);
          historyTimeout = null;
        }
      }
    };

    const goOffline = () => {
      clearReconnectTimer();
      setStatus("offline");
      socket?.close();
    };
    const goOnline = () => {
      reconnectAttempt = 0;
      setStatus("reconnecting");
      connectStream();
    };

    const initialize = async () => {
      const { CandlestickSeries, ColorType, LineStyle, createChart } =
        await import("lightweight-charts");
      if (disposed || !chartContainer.current) return;

      chart = createChart(chartContainer.current, {
        width: chartContainer.current.clientWidth,
        height: 320,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#64748b",
          fontFamily: "var(--font-manrope), sans-serif",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(51, 65, 85, 0.22)" },
          horzLines: { color: "rgba(51, 65, 85, 0.22)" },
        },
        rightPriceScale: {
          borderColor: "rgba(148, 163, 184, 0.12)",
          scaleMargins: { top: 0.12, bottom: 0.12 },
        },
        timeScale: {
          borderColor: "rgba(148, 163, 184, 0.12)",
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 4,
          barSpacing: 7,
        },
        localization: { priceFormatter: formatPrice },
      });
      candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#34d399",
        downColor: "#fb7185",
        borderVisible: false,
        wickUpColor: "#6ee7b7",
        wickDownColor: "#fda4af",
        priceLineColor: "rgba(103, 232, 249, 0.5)",
        priceLineWidth: 1,
      });
      if (activeFeed.targetPrice !== null) {
        candleSeries.createPriceLine({
          price: activeFeed.targetPrice,
          color: "#67e8f9",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${activeFeed.direction?.toUpperCase() ?? ""} TARGET`.trim(),
        });
      }

      resizeObserver = new ResizeObserver(([entry]) => {
        if (entry && chart) {
          chart.applyOptions({ width: Math.floor(entry.contentRect.width) });
        }
      });
      resizeObserver.observe(chartContainer.current);

      window.addEventListener("offline", goOffline);
      window.addEventListener("online", goOnline);
      await loadHistory();
      if (!disposed) connectStream();
      if (disposed) resizeObserver.disconnect();
    };

    void initialize();

    return () => {
      disposed = true;
      clearReconnectTimer();
      if (historyTimeout !== null) window.clearTimeout(historyTimeout);
      historyController.abort();
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      resizeObserver?.disconnect();
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      chart?.remove();
    };
  }, [feed]);

  if (!feed) {
    return (
      <div className="border-b border-white/[0.07] bg-slate-950/35 p-5 sm:p-7">
        <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-white/[0.08] bg-slate-950/40 p-6 text-center">
          <div className="max-w-md">
            <ChartNoAxesCombined className="mx-auto size-6 text-slate-700" />
            <p className="mt-3 text-sm font-semibold text-slate-300">
              No supported reference feed detected
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Live price context appears when the market label or question
              identifies BTC or ETH.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const changePositive = change24h !== null && change24h >= 0;
  const targetGap =
    currentPrice !== null && feed.targetPrice !== null
      ? currentPrice - feed.targetPrice
      : null;
  const targetGapPercent =
    targetGap !== null && feed.targetPrice
      ? (targetGap / feed.targetPrice) * 100
      : null;
  const targetMet =
    targetGap !== null && feed.direction
      ? feed.direction === "above"
        ? targetGap >= 0
        : targetGap <= 0
      : false;
  const currentMarkerPosition =
    targetGapPercent === null
      ? 50
      : Math.max(5, Math.min(95, 50 + targetGapPercent * 5));

  return (
    <section className="border-b border-white/[0.07] bg-[#030a14]/80 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="data-label text-cyan-300">Reference market</p>
            <span className="font-mono text-[9px] text-slate-600">· 1m</span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-display text-lg font-semibold text-white">
              {feed.asset}
              <span className="text-slate-600">/USDC</span>
            </h3>
            <span className="font-mono text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {currentPrice === null ? "—" : `$${formatPrice(currentPrice)}`}
            </span>
            {change24h !== null ? (
              <span
                className={`flex items-center gap-1 font-mono text-xs font-bold ${changePositive ? "text-emerald-300" : "text-rose-300"}`}
              >
                {changePositive ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {changePositive ? "+" : ""}
                {change24h.toFixed(2)}%
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider ${
              status === "live"
                ? "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200"
                : status === "offline"
                  ? "border-rose-300/15 bg-rose-300/[0.05] text-rose-200"
                  : "border-amber-300/15 bg-amber-300/[0.05] text-amber-100"
            }`}
          >
            {status === "offline" ? (
              <WifiOff className="size-3" />
            ) : (
              <Network
                className={
                  status === "live" ? "size-3" : "size-3 animate-pulse"
                }
              />
            )}
            {statusCopy(status)}
          </span>
          <p className="mt-2 font-mono text-[9px] text-slate-600">
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}`
              : "Waiting for market data"}
          </p>
        </div>
      </div>

      <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/55">
        <div ref={chartContainer} className="h-80 w-full" />
        {status !== "live" && currentPrice === null ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/55 backdrop-blur-[2px]">
            <div className="text-center">
              {status === "offline" ? (
                <WifiOff className="mx-auto size-5 text-rose-300" />
              ) : (
                <ChartNoAxesCombined className="mx-auto size-5 animate-pulse text-cyan-300" />
              )}
              <p className="mt-3 text-xs text-slate-400">
                {status === "offline"
                  ? "Price feed paused while offline."
                  : "Loading recent candles…"}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {feed.targetPrice !== null ? (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.025] p-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 data-label text-cyan-300">
                <Target className="size-3" /> {feed.direction ?? "price"} target
              </p>
              <p className="mt-2 font-mono text-lg font-semibold text-white">
                ${formatPrice(feed.targetPrice)}
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-xs font-bold ${targetMet ? "text-emerald-300" : "text-slate-300"}`}
              >
                {targetGap === null
                  ? "Waiting for live price"
                  : targetMet
                    ? "Target condition currently met"
                    : `$${formatPrice(Math.abs(targetGap))} away`}
              </p>
              {targetGapPercent !== null ? (
                <p className="mt-1 font-mono text-[10px] text-slate-600">
                  Current price is {Math.abs(targetGapPercent).toFixed(2)}%{" "}
                  {targetGapPercent >= 0 ? "above" : "below"} target
                </p>
              ) : null}
            </div>
          </div>
          <div
            className="relative mt-4 h-5"
            aria-label="Current price distance from target"
          >
            <div className="absolute left-[5%] right-[5%] top-2 h-px bg-gradient-to-r from-rose-300/35 via-cyan-300/60 to-emerald-300/35" />
            <span className="absolute left-1/2 top-0 h-5 w-px bg-cyan-300" />
            <motion.span
              className={`absolute top-0.5 size-3 -translate-x-1/2 rounded-full border-2 border-slate-950 ${targetMet ? "bg-emerald-300 shadow-yes" : "bg-white shadow-[0_0_16px_rgba(255,255,255,.3)]"}`}
              animate={{ left: `${currentMarkerPosition}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-[8px] uppercase tracking-wider text-slate-700">
            <span>-10%</span>
            <span>target</span>
            <span>+10%</span>
          </div>
        </motion.div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[9px] text-slate-700">
        <span>
          {historyUnavailable
            ? status === "live"
              ? "Recent candle history unavailable · live updates continue"
              : "Recent candle history unavailable · live stream reconnecting"
            : "Reference data by Binance · settlement follows the market oracle"}
        </span>
        <span className="flex items-center gap-2">
          <a
            href="https://www.binance.com/en/markets/overview"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-slate-400"
          >
            Binance ↗
          </a>
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-slate-400"
          >
            Charts by TradingView ↗
          </a>
        </span>
      </div>
    </section>
  );
}
