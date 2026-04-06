"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";

const BLOOMBERG_GREEN = "#22bb44";
const BLOOMBERG_AMBER = "#ff8c00";
const BORDER = "#222244";
const MUTED_FG = "#888899";
const CARD_BG = "#0a0a1a";
const FG = "#e0e0e0";

interface HorizontalBarDataPoint {
  label: string;
  value: number;
  benchmark?: number;
  color?: string;
}

interface HorizontalBarProps {
  data: HorizontalBarDataPoint[];
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  payload: HorizontalBarDataPoint;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
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
      <p style={{ color: FG, marginBottom: 2 }}>{d.label}</p>
      <p style={{ color: BLOOMBERG_GREEN }}>
        Value: {d.value?.toLocaleString()}
      </p>
      {d.benchmark !== undefined && (
        <p style={{ color: BLOOMBERG_AMBER }}>
          Benchmark: {d.benchmark.toLocaleString()}
        </p>
      )}
    </div>
  );
}

export default function HorizontalBar({ data }: HorizontalBarProps) {
  const hasBenchmark = data.some((d) => d.benchmark !== undefined);
  const maxBenchmark = hasBenchmark
    ? Math.max(...data.filter((d) => d.benchmark !== undefined).map((d) => d.benchmark!))
    : undefined;

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 45 + 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={BORDER}
          opacity={0.5}
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fill: MUTED_FG, fontSize: 10, fontFamily: "monospace" }}
          axisLine={{ stroke: BORDER }}
          tickLine={{ stroke: BORDER }}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: MUTED_FG, fontSize: 11, fontFamily: "monospace" }}
          axisLine={{ stroke: BORDER }}
          tickLine={false}
          width={100}
        />
        <Tooltip content={<CustomTooltip />} />

        <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={20}>
          {data.map((entry, idx) => (
            <Cell
              key={`bar-${idx}`}
              fill={entry.color ?? BLOOMBERG_GREEN}
            />
          ))}
        </Bar>

        {hasBenchmark &&
          data.map(
            (d) =>
              d.benchmark !== undefined && (
                <ReferenceLine
                  key={`bm-${d.label}`}
                  x={d.benchmark}
                  stroke={BLOOMBERG_AMBER}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                />
              )
          )}

        {maxBenchmark !== undefined && (
          <ReferenceLine
            x={maxBenchmark}
            stroke="transparent"
            label=""
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
