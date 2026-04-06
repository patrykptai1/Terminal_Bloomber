"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Area,
} from "recharts";

const BLOOMBERG_GREEN = "#22bb44";
const BLOOMBERG_AMBER = "#ff8c00";
const BLOOMBERG_BLUE = "#3399ff";
const BLOOMBERG_RED = "#ff3333";
const BORDER = "#222244";
const MUTED_FG = "#888899";
const CARD_BG = "#0a0a1a";

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
  fairValue?: number | null;
  overvalued?: number | null;
  undervalued?: number | null;
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
  fairValue,
  overvalued,
  undervalued,
}: PriceChartProps) {
  const hasMA50 = data.some((d) => d.ma50 !== undefined);
  const hasMA200 = data.some((d) => d.ma200 !== undefined);

  // Calculate Y domain to include valuation zones
  const allCloses = data.map(d => d.close).filter(c => c > 0);
  const minClose = Math.min(...allCloses);
  const maxClose = Math.max(...allCloses);
  const margin = (maxClose - minClose) * 0.1;

  let yMin = minClose - margin;
  let yMax = maxClose + margin;
  if (undervalued && undervalued < yMin) yMin = undervalued * 0.95;
  if (overvalued && overvalued > yMax) yMax = overvalued * 1.05;

  return (
    <ResponsiveContainer width="100%" height={450}>
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
          tick={{ fill: MUTED_FG, fontSize: 9, fontFamily: "monospace" }}
          axisLine={{ stroke: BORDER }}
          tickLine={{ stroke: BORDER }}
          interval={Math.max(1, Math.floor(data.length / 12))}
        />
        <YAxis
          tick={{ fill: MUTED_FG, fontSize: 10, fontFamily: "monospace" }}
          axisLine={{ stroke: BORDER }}
          tickLine={{ stroke: BORDER }}
          domain={[yMin, yMax]}
        />
        <Tooltip content={<CustomTooltip />} />

        {/* ── Valuation zones (colored background areas) ── */}
        {overvalued != null && (
          <ReferenceArea
            y1={overvalued}
            y2={yMax}
            fill="#f4433620"
            fillOpacity={1}
            ifOverflow="hidden"
          />
        )}
        {undervalued != null && (
          <ReferenceArea
            y1={yMin}
            y2={undervalued}
            fill="#00e67615"
            fillOpacity={1}
            ifOverflow="hidden"
          />
        )}
        {fairValue != null && undervalued != null && overvalued != null && (
          <ReferenceArea
            y1={undervalued}
            y2={overvalued}
            fill="#ffeb3b08"
            fillOpacity={1}
            ifOverflow="hidden"
          />
        )}

        {/* ── Price area ── */}
        <Area
          type="monotone"
          dataKey="close"
          stroke={BLOOMBERG_GREEN}
          fill="url(#priceGradient)"
          strokeWidth={2}
          name="Cena"
          dot={false}
        />

        {/* ── Moving averages ── */}
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

        {/* ── Valuation reference lines ── */}
        {fairValue != null && (
          <ReferenceLine
            y={fairValue}
            stroke={BLOOMBERG_AMBER}
            strokeDasharray="8 4"
            strokeWidth={2}
            label={{
              value: `Fair Value ${fairValue.toFixed(0)}`,
              fill: BLOOMBERG_AMBER,
              fontSize: 10,
              fontFamily: "monospace",
              position: "right",
            }}
          />
        )}

        {overvalued != null && (
          <ReferenceLine
            y={overvalued}
            stroke={BLOOMBERG_RED}
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{
              value: `Przewartościowana ${overvalued.toFixed(0)}`,
              fill: BLOOMBERG_RED,
              fontSize: 9,
              fontFamily: "monospace",
              position: "right",
            }}
          />
        )}

        {undervalued != null && (
          <ReferenceLine
            y={undervalued}
            stroke={BLOOMBERG_GREEN}
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{
              value: `Niedowartościowana ${undervalued.toFixed(0)}`,
              fill: BLOOMBERG_GREEN,
              fontSize: 9,
              fontFamily: "monospace",
              position: "right",
            }}
          />
        )}

        {/* ── Support/Resistance lines (if no valuation data) ── */}
        {!fairValue && supports.map((level) => (
          <ReferenceLine
            key={`s-${level}`}
            y={level}
            stroke={BLOOMBERG_GREEN}
            strokeDasharray="6 4"
            strokeWidth={1}
            label={{
              value: `S ${level.toFixed(0)}`,
              fill: BLOOMBERG_GREEN,
              fontSize: 10,
              fontFamily: "monospace",
              position: "right",
            }}
          />
        ))}

        {!fairValue && resistances.map((level) => (
          <ReferenceLine
            key={`r-${level}`}
            y={level}
            stroke={BLOOMBERG_RED}
            strokeDasharray="6 4"
            strokeWidth={1}
            label={{
              value: `R ${level.toFixed(0)}`,
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
