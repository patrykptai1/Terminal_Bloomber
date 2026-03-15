"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

const BLOOMBERG_GREEN = "oklch(0.75 0.15 145)";

interface MiniSparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export default function MiniSparkline({
  data,
  color = BLOOMBERG_GREEN,
  width = 120,
  height = 32,
}: MiniSparklineProps) {
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <div style={{ width, height, display: "inline-block" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
