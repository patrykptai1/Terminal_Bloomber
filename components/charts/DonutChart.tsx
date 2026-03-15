"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const BORDER = "oklch(0.25 0.01 240)";
const MUTED_FG = "oklch(0.6 0.01 200)";
const CARD_BG = "oklch(0.12 0.01 240)";

const DEFAULT_COLORS = [
  "oklch(0.75 0.15 145)", // bloomberg-green
  "oklch(0.7 0.12 60)",   // bloomberg-amber
  "oklch(0.65 0.15 250)", // bloomberg-blue
  "oklch(0.6 0.2 25)",    // bloomberg-red
  "oklch(0.7 0.1 300)",   // chart-5 purple
  "oklch(0.6 0.12 180)",  // teal
  "oklch(0.55 0.15 30)",  // rust
  "oklch(0.8 0.1 100)",   // lime
];

interface DonutDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutDataPoint[];
  size?: number;
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  payload: { color?: string };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
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
      <p style={{ color: MUTED_FG }}>
        {entry.name}: {entry.value?.toLocaleString()}
      </p>
    </div>
  );
}

export default function DonutChart({ data, size = 280 }: DonutChartProps) {
  return (
    <div style={{ width: "100%", height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            dataKey="value"
            nameKey="name"
            stroke="oklch(0.12 0.01 240)"
            strokeWidth={2}
            paddingAngle={2}
          >
            {data.map((entry, idx) => (
              <Cell
                key={`cell-${idx}`}
                fill={entry.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{
              fontFamily: "monospace",
              fontSize: 11,
              color: MUTED_FG,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
