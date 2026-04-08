"use client";

import {
  RadarChart as RechartsRadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

const BLOOMBERG_GREEN = "#1a9938";
const MUTED_FG = "#888899";
const BORDER = "#222244";

interface RadarDataPoint {
  metric: string;
  value: number;
  fullMark: number;
}

interface RadarChartProps {
  data: RadarDataPoint[];
  color?: string;
}

export default function RadarChart({
  data,
  color = BLOOMBERG_GREEN,
}: RadarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsRadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
        <PolarGrid stroke={BORDER} />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fill: MUTED_FG, fontSize: 11, fontFamily: "monospace" }}
        />
        <PolarRadiusAxis
          angle={90}
          tick={{ fill: MUTED_FG, fontSize: 10, fontFamily: "monospace" }}
          axisLine={false}
          stroke={BORDER}
        />
        <Radar
          name="Value"
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}
