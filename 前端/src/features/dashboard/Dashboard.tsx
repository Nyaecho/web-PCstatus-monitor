import { useState } from "react";
import { HeaderControls } from "./components/HeaderControls";
import { OfflineOverlay } from "./components/OfflineOverlay";
import { PortraitGuard } from "./components/PortraitGuard";
import { SettingsDialog } from "./components/SettingsDialog";
import { HardwareSummary } from "./components/HardwareSummary";
import { DashboardCharts } from "./components/DashboardCharts";
import { deriveTelemetryCategoriesFromConfig, timeAxisConfigMap } from "./constants";
import { useFullscreen } from "./hooks/useFullscreen";
import { useDashboardComponentConfig } from "./hooks/useDashboardComponentConfig";
import { useResponsiveViewport } from "./hooks/useResponsiveViewport";
import { useTelemetry } from "./hooks/useTelemetry";
import { useWakeLock } from "./hooks/useWakeLock";
import { buildChartData } from "./utils/telemetry";

export function Dashboard() {
  const [showConfig, setShowConfig] = useState(false);
  const { isPortrait, bypassPortrait, setBypassPortrait, isExtraWide } = useResponsiveViewport();
  const { isFullScreen, toggleFullScreen } = useFullscreen();

  useWakeLock();

  const componentConfigState = useDashboardComponentConfig();
  const telemetry = useTelemetry(
    isExtraWide,
    deriveTelemetryCategoriesFromConfig(componentConfigState.componentConfig)
  );
  const timeAxisConfig = timeAxisConfigMap[telemetry.sampleInterval] ?? timeAxisConfigMap[1];
  const chartData = buildChartData(telemetry.netHistory, telemetry.sampleInterval);

  if (isPortrait && !bypassPortrait) {
    return <PortraitGuard onContinue={() => setBypassPortrait(true)} />;
  }

  return (
    <div className={`w-full h-screen bg-[#EAF4FE] text-slate-800 flex flex-col font-sans select-none p-2 relative ${isExtraWide ? "overflow-y-auto" : "overflow-hidden"}`}>
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500 opacity-90" />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .recharts-wrapper,
        .recharts-surface,
        .recharts-legend-wrapper,
        .recharts-responsive-container,
        .recharts-wrapper *,
        svg,
        path,
        rect,
        circle,
        g {
          outline: none !important;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>

      <OfflineOverlay
        isRealModeIntent={telemetry.isRealModeIntent}
        status={telemetry.status}
        wsUrl={telemetry.wsUrl}
      />

      <HeaderControls
        isFullScreen={isFullScreen}
        onToggleFullScreen={toggleFullScreen}
        onToggleConfig={() => setShowConfig((prev) => !prev)}
      />

      <main className={`flex-1 flex flex-col gap-2.5 p-0.5 ${isExtraWide ? "" : "h-full overflow-hidden"}`}>
        <HardwareSummary
          latestData={telemetry.latestData}
          componentConfig={componentConfigState.componentConfig}
        />

        <DashboardCharts
          latestData={telemetry.latestData}
          chartData={chartData}
          isExtraWide={isExtraWide}
          timeWindowSeconds={timeAxisConfig.windowSeconds}
          timeAxisTicks={timeAxisConfig.ticks}
          componentConfig={componentConfigState.componentConfig}
        />
      </main>

      <SettingsDialog
        open={showConfig}
        wsUrl={telemetry.wsUrl}
        setWsUrl={telemetry.setWsUrl}
        sampleInterval={telemetry.sampleInterval}
        setSampleInterval={telemetry.setSampleInterval}
        isRealModeIntent={telemetry.isRealModeIntent}
        status={telemetry.status}
        onClose={() => setShowConfig(false)}
        connectDevice={telemetry.connectDevice}
        disconnectDevice={telemetry.disconnectDevice}
        startSimulation={telemetry.startSimulation}
        componentConfig={componentConfigState.componentConfig}
        updateComponentMetric={componentConfigState.updateComponentMetric}
        resetComponentConfig={componentConfigState.resetComponentConfig}
      />
    </div>
  );
}
