import { ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartPoint } from "../constants";

interface TrendLine {
  dataKey: string;
  name: string;
  stroke: string;
}

interface TrendChartProps {
  data: ChartPoint[];
  title: ReactNode;
  summary: ReactNode;
  timeWindowSeconds: number;
  ticks: number[];
  lines: TrendLine[];
  yDomain?: [number, number] | ["auto", "auto"];
  yTickFormatter: (value: number) => string;
  tooltipFormatter: (value: number, dataKey?: string) => string;
  compact?: boolean;
  aspectClassName?: string;
}

export function TrendChart({
  data,
  title,
  summary,
  timeWindowSeconds,
  ticks,
  lines,
  yDomain = ["auto", "auto"],
  yTickFormatter,
  tooltipFormatter,
  compact = false,
  aspectClassName = ""
}: TrendChartProps) {
  return (
    <section className={`flex flex-col p-3 bg-white/70 border border-sky-100/90 rounded-2xl overflow-hidden justify-between min-h-0 shadow-sm shadow-blue-50/50 ${aspectClassName}`}>
      <div className={`flex justify-between items-center ${compact ? "mb-1.5" : "mb-1"} px-1.5 shrink-0`}>
        {title}
        {summary}
      </div>

      <div className="flex-1 w-full min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -22, bottom: -12 }} style={{ outline: "none" }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2f0fe" opacity={0.8} vertical={false} />
            <XAxis
              dataKey="elapsed"
              type="number"
              domain={[-timeWindowSeconds, 0]}
              ticks={ticks}
              tickFormatter={(val) => val === 0 ? "现在" : `${val}s`}
              stroke="#64748b"
              fontSize={9}
              tickLine={false}
              dy={4}
            />
            <YAxis
              stroke="#64748b"
              fontSize={9}
              tickLine={false}
              domain={yDomain}
              tickFormatter={(val) => yTickFormatter(Number(val))}
              dx={-2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.98)",
                border: "1px solid #bae6fd",
                borderRadius: "8px",
                fontSize: "11px",
                color: "#0f172a",
                outline: "none"
              }}
              labelFormatter={(lbl) => `偏移时间: ${lbl} 秒`}
              formatter={(val: number, _name, props) => [tooltipFormatter(val, String(props.dataKey ?? ""))]}
            />
            {lines.map((line) => (
              <Line
                key={line.dataKey}
                type="linear"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.stroke}
                strokeWidth={1.8}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
