import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { MetricData } from "../../../types";
import ArcGauge from "../../../components/ArcGauge";
import { ChartPoint, DashboardComponentConfig, dashboardMetricOptions } from "../constants";
import { formatMetricValue, getChartMetricValue, getLatestMetricValue, getProgressMemoryText } from "../utils/metrics";

interface HardwareSummaryProps {
  latestData: MetricData;
  chartData: ChartPoint[];
  isExtraWide: boolean;
  timeWindowSeconds: number;
  compactTimeAxisTicks: number[];
  componentConfig: DashboardComponentConfig;
}

export function HardwareSummary({
  latestData,
  chartData,
  isExtraWide,
  timeWindowSeconds,
  compactTimeAxisTicks,
  componentConfig
}: HardwareSummaryProps) {
  const primaryGaugeLeftMetric = componentConfig.primaryGaugeLeft.metric;
  const primaryGaugeRightMetric = componentConfig.primaryGaugeRight.metric;
  const progressTopMetric = componentConfig.progressTop.metric;
  const progressBottomMetric = componentConfig.progressBottom.metric;
  const fanCompactLeftMetric = componentConfig.fanCompactLeft.metric;
  const fanCompactRightMetric = componentConfig.fanCompactRight.metric;

  const primaryGaugeLeftOption = dashboardMetricOptions[primaryGaugeLeftMetric];
  const primaryGaugeRightOption = dashboardMetricOptions[primaryGaugeRightMetric];
  const progressTopOption = dashboardMetricOptions[progressTopMetric];
  const progressBottomOption = dashboardMetricOptions[progressBottomMetric];
  const fanCompactLeftOption = dashboardMetricOptions[fanCompactLeftMetric];
  const fanCompactRightOption = dashboardMetricOptions[fanCompactRightMetric];

  const primaryGaugeLeftValue = getLatestMetricValue(latestData, primaryGaugeLeftMetric);
  const primaryGaugeRightValue = getLatestMetricValue(latestData, primaryGaugeRightMetric);
  const progressTopValue = getLatestMetricValue(latestData, progressTopMetric);
  const progressBottomValue = getLatestMetricValue(latestData, progressBottomMetric);
  const fanCompactLeftValue = getLatestMetricValue(latestData, fanCompactLeftMetric);
  const fanCompactRightValue = getLatestMetricValue(latestData, fanCompactRightMetric);
  const fanChartData = chartData.map((point) => ({
    ...point,
    fanCompactLeft: getChartMetricValue(point, fanCompactLeftMetric),
    fanCompactRight: getChartMetricValue(point, fanCompactRightMetric)
  }));
  const avgSpeed = (fanCompactLeftValue + fanCompactRightValue) / 2;

  return (
    <section className="shrink-0 flex items-center p-2.5 bg-white/70 border border-sky-100/90 rounded-xl gap-4 overflow-hidden min-h-0 shadow-sm shadow-blue-50/50">
      <div className="flex items-center gap-1 shrink-0">
        <ArcGauge value={Math.max(0, Math.min(100, primaryGaugeLeftValue))} label={primaryGaugeLeftOption.shortLabel} color={primaryGaugeLeftOption.color} />
        <ArcGauge value={Math.max(0, Math.min(100, primaryGaugeRightValue))} label={primaryGaugeRightOption.shortLabel} color={primaryGaugeRightOption.color} />
      </div>

      <div className="w-px h-10 bg-sky-200/80 self-center shrink-0" />

      <div className="w-[30%] xl:w-[35%] flex-none flex flex-col justify-center gap-2 min-w-0 pr-1">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center justify-between text-[9px] text-sky-800/80 font-mono">
            <span className="font-semibold text-sky-900">{progressTopOption.shortLabel}</span>
            <span>{getProgressMemoryText(latestData, progressTopMetric)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-sky-100/50 h-1.5 rounded-full overflow-hidden border border-sky-200/30 relative">
              <div
                className="bg-gradient-to-r from-blue-500 to-sky-450 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, progressTopValue))}%` }}
              />
            </div>
            <span className="text-[11px] font-bold font-mono text-sky-950 min-w-[32px] text-right shrink-0">
              {formatMetricValue(progressTopValue, progressTopMetric, 0)}
            </span>
            <span className="text-[9px] font-bold text-sky-700 min-w-[28px] text-center bg-sky-100/70 px-1 rounded border border-sky-200/90 shrink-0">
              {progressTopOption.shortLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center justify-between text-[9px] text-sky-800/80 font-mono">
            <span className="font-semibold text-sky-900">{progressBottomOption.shortLabel}</span>
            <span>{getProgressMemoryText(latestData, progressBottomMetric)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-sky-100/50 h-1.5 rounded-full overflow-hidden border border-sky-200/30 relative">
              <div
                className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, progressBottomValue))}%` }}
              />
            </div>
            <span className="text-[11px] font-bold font-mono text-sky-950 min-w-[32px] text-right shrink-0">
              {formatMetricValue(progressBottomValue, progressBottomMetric, 0)}
            </span>
            <span className="text-[9px] font-bold text-sky-700 min-w-[28px] text-center bg-sky-100/70 px-1 rounded border border-sky-200/90 shrink-0">
              {progressBottomOption.shortLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="w-px h-10 bg-sky-200/80 self-center shrink-0" />

      <div className="flex-1 min-w-0 h-full flex flex-col justify-center">
        {isExtraWide ? (
          <div className="flex-1 flex gap-3 items-center min-w-0 h-[68px]">
            <div className="flex flex-col gap-1 justify-center shrink-0 font-mono text-left select-none pl-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[9px] font-bold text-sky-800">{fanCompactLeftOption.shortLabel}: <b className="text-blue-600">{formatMetricValue(fanCompactLeftValue, fanCompactLeftMetric, 0)}</b></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold text-sky-800">{fanCompactRightOption.shortLabel}: <b className="text-emerald-600">{formatMetricValue(fanCompactRightValue, fanCompactRightMetric, 0)}</b></span>
              </div>
            </div>
            <div className="flex-1 min-w-0 h-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fanChartData} margin={{ top: 4, right: 4, left: -26, bottom: -12 }} style={{ outline: "none" }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2f0fe" opacity={0.6} vertical={false} />
                  <XAxis
                    dataKey="elapsed"
                    type="number"
                    domain={[-timeWindowSeconds, 0]}
                    ticks={compactTimeAxisTicks}
                    tickFormatter={(val) => val === 0 ? "现在" : `${val}s`}
                    stroke="#64748b"
                    fontSize={8}
                    tickLine={false}
                    dy={2}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={8}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(val) => `${val}%`}
                    dx={-2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.98)",
                      border: "1px solid #bae6fd",
                      borderRadius: "8px",
                      fontSize: "10px",
                      color: "#0f172a",
                      outline: "none"
                    }}
                    labelFormatter={(lbl) => `偏移时间: ${lbl}s`}
                    formatter={(val: number, name: string) => [
                      formatMetricValue(val, name === fanCompactLeftOption.shortLabel ? fanCompactLeftMetric : fanCompactRightMetric, 1)
                    ]}
                  />
                  <Line type="linear" dataKey="fanCompactLeft" name={fanCompactLeftOption.shortLabel} stroke="#2563eb" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="fanCompactRight" name={fanCompactRightOption.shortLabel} stroke="#10b981" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 min-w-0 justify-start">
            <div className="relative w-[72px] h-[72px] flex items-center justify-center bg-sky-50 border border-sky-100/90 rounded-2xl shrink-0 overflow-hidden shadow-inner">
              {(() => {
                const fanDuration = avgSpeed > 0 ? Math.max(0.12, 4.0 - (avgSpeed / 100) * 3.88) : 5.0;
                return (
                  <svg
                    viewBox="0 0 24 24"
                    className="w-14 h-14 text-blue-500 fill-blue-500/10 origin-center"
                    style={{
                      animation: `spin ${fanDuration.toFixed(3)}s linear infinite`,
                      willChange: "transform",
                      transform: "translateZ(0)"
                    }}
                  >
                    <path d="M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A2,2 0 0,1 14,6C14,7.5 12,10 12,10C12,10 10,7.5 10,6A2,2 0 0,1 12,4M6,12A2,2 0 0,1 8,10C9.5,10 12,12 12,12C12,12 9.5,14 8,14A2,2 0 0,1 6,12M12,20A2,2 0 0,1 10,18C10,16.5 12,14 12,14C12,14 14,16.5 14,18A2,2 0 0,1 12,20M18,12A2,2 0 0,1 16,14C14.5,14 12,12 12,12C12,12 14.5,10 16,10A2,2 0 0,1 18,12Z" />
                  </svg>
                );
              })()}
              <div className="absolute w-3 h-3 bg-white border border-sky-300 rounded-full" />
            </div>

            <div className="flex flex-col gap-1.5 justify-center font-mono leading-tight shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[9px] font-bold text-sky-700 uppercase tracking-widest bg-sky-100/70 px-1.5 py-0.5 rounded border border-sky-200/80">{fanCompactLeftOption.shortLabel}</span>
                <span className="text-sm font-black text-blue-600">{formatMetricValue(fanCompactLeftValue, fanCompactLeftMetric, 0)}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[9px] font-bold text-sky-700 uppercase tracking-widest bg-sky-100/70 px-1.5 py-0.5 rounded border border-sky-200/80">{fanCompactRightOption.shortLabel}</span>
                <span className="text-sm font-black text-emerald-600">{formatMetricValue(fanCompactRightValue, fanCompactRightMetric, 0)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
