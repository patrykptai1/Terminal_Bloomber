"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Text } from "recharts";

const BLOOMBERG_GREEN = "#22bb44";
const BLOOMBERG_AMBER = "#ff8c00";
const BLOOMBERG_RED = "#ff3333";
const MUTED_FG = "#888899";
const FG = "#e0e0e0";

interface GaugeChartProps {
  value: number;
  max: number;
  label: string;
  size?: number;
}

function getGaugeColor(ratio: number): string {
  if (ratio <= 0.33) return BLOOMBERG_GREEN;
  if (ratio <= 0.66) return BLOOMBERG_AMBER;
  return BLOOMBERG_RED;
}

export default function GaugeChart({
  value,
  max,
  label,
  size = 200,
}: GaugeChartProps) {
  const clamped = Math.min(Math.max(value, 0), max);
  const ratio = clamped / max;
  const fillAngle = ratio * 180;

  const data = [
    { name: "value", val: fillAngle },
    { name: "remaining", val: 180 - fillAngle },
    { name: "hidden", val: 180 },
  ];

  const activeColor = getGaugeColor(ratio);

  return (
    <div
      className="flex flex-col items-center"
      style={{ width: size, height: size * 0.65 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="80%"
            startAngle={180}
            endAngle={0}
            innerRadius="60%"
            outerRadius="90%"
            dataKey="val"
            stroke="none"
            isAnimationActive={true}
          >
            <Cell fill={activeColor} />
            <Cell fill="#111122" />
            <Cell fill="transparent" />
          </Pie>
          <Text
            x="50%"
            y="72%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill={FG}
            fontSize={size * 0.14}
            fontFamily="monospace"
            fontWeight={700}
          >
            {clamped % 1 === 0 ? clamped.toString() : clamped.toFixed(1)}
          </Text>
          <Text
            x="50%"
            y="92%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill={MUTED_FG}
            fontSize={size * 0.065}
            fontFamily="monospace"
          >
            {label}
          </Text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
