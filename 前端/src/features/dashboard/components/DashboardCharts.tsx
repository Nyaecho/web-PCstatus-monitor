import { Activity, Database, Wifi } from "lucide-react";
import { MetricData } from "../../../types";
import { ChartPoint, DashboardComponentConfig, dashboardMetricOptions } from "../constants";
import { formatMetricValue, getLatestMetricValue } from "../utils/metrics";
import { TrendChart } from "./TrendChart";

interface DashboardChartsProps {
  latestData: MetricData;
  chartData: ChartPoint[];
  isExtraWide: boolean;
  timeWindowSeconds: number;
  timeAxisTicks: number[];
  componentConfig: DashboardComponentConfig;
}

export function DashboardCharts({
  latestData,
  chartData,
  isExtraWide,
  timeWindowSeconds,
  timeAxisTicks,
  componentConfig
}: DashboardChartsProps) {
  const networkLeftMetric = componentConfig.networkChartLeft.metric;
  const networkRightMetric = componentConfig.networkChartRight.metric;
  const temperatureLeftMetric = componentConfig.temperatureChartLeft.metric;
  const temperatureRightMetric = componentConfig.temperatureChartRight.metric;
  const loadLeftMetric = componentConfig.loadChartLeft.metric;
  const loadRightMetric = componentConfig.loadChartRight.metric;
  const memoryLeftMetric = componentConfig.memoryChartLeft.metric;
  const memoryRightMetric = componentConfig.memoryChartRight.metric;

  const networkLeftOption = dashboardMetricOptions[networkLeftMetric];
  const networkRightOption = dashboardMetricOptions[networkRightMetric];
  const temperatureLeftOption = dashboardMetricOptions[temperatureLeftMetric];
  const temperatureRightOption = dashboardMetricOptions[temperatureRightMetric];
  const loadLeftOption = dashboardMetricOptions[loadLeftMetric];
  const loadRightOption = dashboardMetricOptions[loadRightMetric];
  const memoryLeftOption = dashboardMetricOptions[memoryLeftMetric];
  const memoryRightOption = dashboardMetricOptions[memoryRightMetric];

  return (
    <>
      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        <TrendChart
          data={chartData}
          timeWindowSeconds={timeWindowSeconds}
          ticks={timeAxisTicks}
          yTickFormatter={(val) => `${val.toFixed(0)}`}
          tooltipFormatter={(val, dataKey) => formatMetricValue(val, dataKey === networkLeftMetric ? networkLeftMetric : networkRightMetric, 1)}
          lines={[
            { dataKey: networkLeftMetric, name: networkLeftOption.shortLabel, stroke: "#ef4444" },
            { dataKey: networkRightMetric, name: networkRightOption.shortLabel, stroke: "#2563eb" }
          ]}
          title={(
            <span className="text-[10px] uppercase font-bold text-sky-900 tracking-wider flex items-center gap-1">
              <Wifi size={11} className="text-blue-500" /> 网络流量趋势
            </span>
          )}
          summary={(
            <div className="flex gap-3 text-[9px] text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-rose-500 inline-block" />
                {networkLeftOption.shortLabel}: <b className="text-rose-600">{formatMetricValue(getLatestMetricValue(latestData, networkLeftMetric), networkLeftMetric, 0)}</b>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-blue-500 inline-block" />
                {networkRightOption.shortLabel}: <b className="text-blue-600">{formatMetricValue(getLatestMetricValue(latestData, networkRightMetric), networkRightMetric, 0)}</b>
              </span>
            </div>
          )}
        />

        <TrendChart
          data={chartData}
          timeWindowSeconds={timeWindowSeconds}
          ticks={timeAxisTicks}
          yTickFormatter={(val) => `${val.toFixed(0)}°C`}
          tooltipFormatter={(val, dataKey) => formatMetricValue(val, dataKey === temperatureLeftMetric ? temperatureLeftMetric : temperatureRightMetric, 1)}
          lines={[
            { dataKey: temperatureLeftMetric, name: temperatureLeftOption.shortLabel, stroke: "#ef4444" },
            { dataKey: temperatureRightMetric, name: temperatureRightOption.shortLabel, stroke: "#2563eb" }
          ]}
          title={(
            <span className="text-[10px] uppercase font-bold text-sky-900 tracking-wider flex items-center gap-1.5">
              <Activity size={11} className="text-rose-500" /> 核心芯片温度趋势
            </span>
          )}
          summary={(
            <div className="flex gap-3 text-[9px] text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-rose-500 inline-block" />
                {temperatureLeftOption.shortLabel}: <b className="text-rose-600">{formatMetricValue(getLatestMetricValue(latestData, temperatureLeftMetric), temperatureLeftMetric, 0)}</b>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-blue-500 inline-block" />
                {temperatureRightOption.shortLabel}: <b className="text-blue-600">{formatMetricValue(getLatestMetricValue(latestData, temperatureRightMetric), temperatureRightMetric, 0)}</b>
              </span>
            </div>
          )}
        />
      </div>

      {isExtraWide && (
        <div className="grid grid-cols-2 gap-3 shrink-0 pt-0.5 pb-2">
          <TrendChart
            data={chartData}
            timeWindowSeconds={timeWindowSeconds}
            ticks={timeAxisTicks}
            yDomain={[0, 100]}
            yTickFormatter={(val) => `${val}%`}
            tooltipFormatter={(val, dataKey) => formatMetricValue(val, dataKey === loadLeftMetric ? loadLeftMetric : loadRightMetric, 1)}
            compact
            aspectClassName="aspect-[2.3/1]"
            lines={[
              { dataKey: loadLeftMetric, name: loadLeftOption.shortLabel, stroke: "#2563eb" },
              { dataKey: loadRightMetric, name: loadRightOption.shortLabel, stroke: "#10b981" }
            ]}
            title={(
              <span className="text-[10px] uppercase font-bold text-sky-900 tracking-wider flex items-center gap-1.5">
                <Activity size={11} className="text-blue-500" /> CPU & GPU 负载率趋势
              </span>
            )}
            summary={(
              <div className="flex gap-3 text-[9px] text-slate-500 font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-blue-600 inline-block" />
                  {loadLeftOption.shortLabel}: <b className="text-blue-605">{formatMetricValue(getLatestMetricValue(latestData, loadLeftMetric), loadLeftMetric, 0)}</b>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-emerald-500 inline-block" />
                  {loadRightOption.shortLabel}: <b className="text-emerald-600">{formatMetricValue(getLatestMetricValue(latestData, loadRightMetric), loadRightMetric, 0)}</b>
                </span>
              </div>
            )}
          />

          <TrendChart
            data={chartData}
            timeWindowSeconds={timeWindowSeconds}
            ticks={timeAxisTicks}
            yDomain={[0, 100]}
            yTickFormatter={(val) => `${val}%`}
            tooltipFormatter={(val, dataKey) => formatMetricValue(val, dataKey === memoryLeftMetric ? memoryLeftMetric : memoryRightMetric, 1)}
            compact
            aspectClassName="aspect-[2.3/1]"
            lines={[
              { dataKey: memoryLeftMetric, name: memoryLeftOption.shortLabel, stroke: "#6366f1" },
              { dataKey: memoryRightMetric, name: memoryRightOption.shortLabel, stroke: "#14b8a6" }
            ]}
            title={(
              <span className="text-[10px] uppercase font-bold text-sky-900 tracking-wider flex items-center gap-1.5">
                <Database size={11} className="text-indigo-500" /> RAM & 显存 (VRAM) 占用率趋势
              </span>
            )}
            summary={(
              <div className="flex gap-3 text-[9px] text-slate-500 font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-indigo-500 inline-block" />
                  {memoryLeftOption.shortLabel}: <b className="text-indigo-600">{formatMetricValue(getLatestMetricValue(latestData, memoryLeftMetric), memoryLeftMetric, 1)}</b>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-teal-500 inline-block" />
                  {memoryRightOption.shortLabel}: <b className="text-teal-600">{formatMetricValue(getLatestMetricValue(latestData, memoryRightMetric), memoryRightMetric, 1)}</b>
                </span>
              </div>
            )}
          />
        </div>
      )}
    </>
  );
}
