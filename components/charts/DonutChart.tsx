"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const BORDER = "#222244";
const MUTED_FG = "#888899";
const CARD_BG = "#0a0a1a";

const DEFAULT_COLORS = [
  "#22bb44", // bloomberg-green
  "#ff8c00",   // bloomberg-amber
  "#3399ff", // bloomberg-blue
  "#ff3333",    // bloomberg-red
  "#cc66ff",   // chart-5 purple
  "#339999",  // teal
  "#cc5533",  // rust
  "#aacc44",   // lime
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
            stroke="#0a0a1a"
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
