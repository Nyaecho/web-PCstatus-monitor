import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { HistoricalHistory } from "../types";
import { LineChart, Cpu, Wifi } from "lucide-react";

interface PerformanceChartsProps {
  history: HistoricalHistory;
}

export default function PerformanceCharts({ history }: PerformanceChartsProps) {
  const [chartMode, setChartMode] = useState<"system" | "network">("system");

  // Transform historical arrays to array of objects for Recharts
  const chartData = history.timestamps.map((time, idx) => {
    return {
      time,
      cpu: history.cpu[idx] ?? 0,
      ram: history.ram[idx] ?? 0,
      disk: history.disk[idx] ?? 0,
      net_sent: history.net_sent[idx] ?? 0,
      net_recv: history.net_recv[idx] ?? 0
    };
  });

  return (
    <div className="border border-blue-100 bg-white rounded-[28px] p-6 shadow-sm">
      {/* Chart Headers & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-blue-50 pb-5 mb-5">
        <div className="flex items-start gap-3">
          <span className="p-2.5 rounded-2xl bg-blue-50 text-blue-600">
            <LineChart size={18} />
          </span>
          <div>
            <h3 className="text-xs font-bold tracking-[0.2em] uppercase text-blue-500">
              历史数据性能诊断指标趋势
            </h3>
            <p className="text-xs text-slate-400 font-serif italic mt-0.5">
              直接从受监控主机的底层内核钩子捕获的连续运行状态。
            </p>
          </div>
        </div>

        {/* Chart View selector tabs */}
        <div className="flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200 select-none self-start sm:self-auto">
          <button
            onClick={() => setChartMode("system")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              chartMode === "system"
                ? "bg-white text-blue-600 border border-slate-200 shadow-sm font-semibold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Cpu size={13} /> 处理器/内存负载
          </button>
          <button
            onClick={() => setChartMode("network")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              chartMode === "network"
                ? "bg-white text-blue-600 border border-slate-200 shadow-sm font-semibold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Wifi size={13} /> 网络收发吞吐
          </button>
        </div>
      </div>

      {/* Chart body rendering */}
      <div className="h-64 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartMode === "system" ? (
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#94a3b8"
                fontSize={10}
                fontFamily="sans-serif"
                tickLine={false}
                dy={8}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={10}
                fontFamily="sans-serif"
                tickLine={false}
                domain={[0, 100]}
                unit="%"
                dx={-4}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.96)",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                  color: "#1e293b"
                }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: "11px",
                  fontFamily: "sans-serif",
                  paddingTop: "15px"
                }}
              />
              <Area
                type="linear"
                dataKey="cpu"
                name="CPU 占用率"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#cpuGrad)"
                strokeWidth={2}
                activeDot={{ r: 5 }}
              />
              <Area
                type="linear"
                dataKey="ram"
                name="运行内存 (RAM) 占用率"
                stroke="#6366f1"
                fillOpacity={1}
                fill="url(#ramGrad)"
                strokeWidth={2}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="netSentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="netRecvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#94a3b8"
                fontSize={10}
                fontFamily="sans-serif"
                tickLine={false}
                dy={8}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={10}
                fontFamily="sans-serif"
                tickLine={false}
                unit=" KB"
                dx={-4}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.96)",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                  color: "#1e293b"
                }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: "11px",
                  fontFamily: "sans-serif",
                  paddingTop: "15px"
                }}
              />
              <Area
                type="linear"
                dataKey="net_sent"
                name="上行发送速度 (KB/s)"
                stroke="#0ea5e9"
                fillOpacity={1}
                fill="url(#netSentGrad)"
                strokeWidth={2}
                activeDot={{ r: 5 }}
              />
              <Area
                type="linear"
                dataKey="net_recv"
                name="下行接收速度 (KB/s)"
                stroke="#0d9488"
                fillOpacity={1}
                fill="url(#netRecvGrad)"
                strokeWidth={2}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
