"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const BLOOMBERG_BLUE = "oklch(0.65 0.15 250)";
const BLOOMBERG_AMBER = "oklch(0.7 0.12 60)";
const BORDER = "oklch(0.25 0.01 240)";
const MUTED_FG = "oklch(0.6 0.01 200)";
const CARD_BG = "oklch(0.12 0.01 240)";

interface BarCompareDataPoint {
  name: string;
  valueA: number;
  valueB: number;
  labelA?: string;
  labelB?: string;
}

interface BarCompareChartProps {
  data: BarCompareDataPoint[];
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
          {entry.name}: {entry.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export default function BarCompareChart({ data }: BarCompareChartProps) {
  const labelA = data[0]?.labelA ?? "A";
  const labelB = data[0]?.labelB ?? "B";

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} opacity={0.5} />
        <XAxis
          dataKey="name"
          tick={{ fill: MUTED_FG, fontSize: 10, fontFamily: "monospace" }}
          axisLine={{ stroke: BORDER }}
          tickLine={{ stroke: BORDER }}
        />
        <YAxis
          tick={{ fill: MUTED_FG, fontSize: 10, fontFamily: "monospace" }}
          axisLine={{ stroke: BORDER }}
          tickLine={{ stroke: BORDER }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{
            fontFamily: "monospace",
            fontSize: 11,
            color: MUTED_FG,
          }}
        />
        <Bar
          dataKey="valueA"
          name={labelA}
          fill={BLOOMBERG_BLUE}
          radius={[2, 2, 0, 0]}
        />
        <Bar
          dataKey="valueB"
          name={labelB}
          fill={BLOOMBERG_AMBER}
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
