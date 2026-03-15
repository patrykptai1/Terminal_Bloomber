"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";

const BLOOMBERG_GREEN = "oklch(0.75 0.15 145)";
const BLOOMBERG_AMBER = "oklch(0.7 0.12 60)";
const BLOOMBERG_BLUE = "oklch(0.65 0.15 250)";
const BLOOMBERG_RED = "oklch(0.6 0.2 25)";
const BORDER = "oklch(0.25 0.01 240)";
const MUTED_FG = "oklch(0.6 0.01 200)";
const FG = "oklch(0.93 0.01 200)";
const CARD_BG = "oklch(0.12 0.01 240)";

interface PriceDataPoint {
  date: string;
  close: number;
  ma50?: number;
  ma200?: number;
}

interface PriceChartProps {
  data: PriceDataPoint[];
  supports?: number[];
  resistances?: number[];
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        padding: "8px 12px",
        fontFamily: "monospace",
        fontSize: 11,
      }}
    >
      <p style={{ color: MUTED_FG, marginBottom: 4 }}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value?.toFixed(2)}
        </p>
      ))}
    </div>
  );
}

export default function PriceChart({
  data,
  supports = [],
  resistances = [],
}: PriceChartProps) {
  const hasMA50 = data.some((d) => d.ma50 !== undefined);
  const hasMA200 = data.some((d) => d.ma200 !== undefined);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BLOOMBERG_GREEN} stopOpacity={0.3} />
            <stop offset="100%" stopColor={BLOOMBERG_GREEN} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} opacity={0.5} />
        <XAxis
          dataKey="date"
          tick={{ fill: MUTED_FG, fontSize: 10, fontFamily: "monospace" }}
          axisLine={{ stroke: BORDER }}
          tickLine={{ stroke: BORDER }}
        />
        <YAxis
          tick={{ fill: MUTED_FG, fontSize: 10, fontFamily: "monospace" }}
          axisLine={{ stroke: BORDER }}
          tickLine={{ stroke: BORDER }}
          domain={["auto", "auto"]}
        />
        <Tooltip content={<CustomTooltip />} />

        <Area
          type="monotone"
          dataKey="close"
          stroke={BLOOMBERG_GREEN}
          fill="url(#priceGradient)"
          strokeWidth={2}
          name="Price"
          dot={false}
        />

        {hasMA50 && (
          <Line
            type="monotone"
            dataKey="ma50"
            stroke={BLOOMBERG_AMBER}
            strokeWidth={1.5}
            dot={false}
            name="MA50"
            strokeDasharray="4 2"
          />
        )}

        {hasMA200 && (
          <Line
            type="monotone"
            dataKey="ma200"
            stroke={BLOOMBERG_BLUE}
            strokeWidth={1.5}
            dot={false}
            name="MA200"
            strokeDasharray="6 3"
          />
        )}

        {supports.map((level) => (
          <ReferenceLine
            key={`s-${level}`}
            y={level}
            stroke={BLOOMBERG_GREEN}
            strokeDasharray="6 4"
            strokeWidth={1}
            label={{
              value: `S ${level}`,
              fill: BLOOMBERG_GREEN,
              fontSize: 10,
              fontFamily: "monospace",
              position: "right",
            }}
          />
        ))}

        {resistances.map((level) => (
          <ReferenceLine
            key={`r-${level}`}
            y={level}
            stroke={BLOOMBERG_RED}
            strokeDasharray="6 4"
            strokeWidth={1}
            label={{
              value: `R ${level}`,
              fill: BLOOMBERG_RED,
              fontSize: 10,
              fontFamily: "monospace",
              position: "right",
            }}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
