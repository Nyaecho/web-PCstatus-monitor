import { useEffect, useState } from "react";
import { MetricData } from "../../../types";
import ArcGauge from "../../../components/ArcGauge";
import { DashboardComponentConfig, dashboardMetricOptions } from "../constants";
import { formatMetricValue, getLatestMetricValue, getProgressMemoryText } from "../utils/metrics";

interface FanGaugeCardProps {
  label: string;
  shortLabel: string;
  value: number;
  color: string;
  unit?: string;
}

function FanGaugeCard({ label, shortLabel, value, color, unit = "%" }: FanGaugeCardProps) {
  const [historicalMax, setHistoricalMax] = useState(() => Math.max(1, value));

  useEffect(() => {
    setHistoricalMax((prev) => Math.max(prev, value, 1));
  }, [value]);

  const currentRatio = historicalMax > 0 ? (value / historicalMax) * 100 : 0;

  return (
    <div className="flex flex-col items-center justify-center select-none p-1 relative">
      <div className="relative w-28 h-28 xl:w-32 xl:h-32 flex items-center justify-center">
        <ArcGauge
          value={value}
          displayValue={value}
          progressValue={currentRatio}
          label={label}
          color={color}
          unit={unit}
          sizeClassName="w-28 h-28 xl:w-32 xl:h-32"
        />
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[8px] font-mono text-slate-500 whitespace-nowrap">
          最大 {historicalMax.toFixed(0)}{unit}
        </div>
      </div>
    </div>
  );
}

interface HardwareSummaryProps {
  latestData: MetricData;
  componentConfig: DashboardComponentConfig;
}

export function HardwareSummary({
  latestData,
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

      <div className="flex-1 min-w-0 h-full flex items-center">
        <div className="grid h-[96px] min-w-0 flex-1 grid-cols-2 gap-3 xl:h-[104px]">
          <FanGaugeCard
            label={fanCompactLeftOption.shortLabel}
            shortLabel={fanCompactLeftOption.shortLabel}
            value={fanCompactLeftValue}
            color={fanCompactLeftOption.color}
            unit={fanCompactLeftOption.unit}
          />
          <FanGaugeCard
            label={fanCompactRightOption.shortLabel}
            shortLabel={fanCompactRightOption.shortLabel}
            value={fanCompactRightValue}
            color={fanCompactRightOption.color}
            unit={fanCompactRightOption.unit}
          />
        </div>
      </div>
    </section>
  );
}
