import { useEffect, useState } from "react";
import {
  DashboardComponentConfig,
  DashboardComponentId,
  DashboardMetricKey,
  defaultDashboardComponentConfig
} from "../constants";

const STORAGE_KEY = "telemetry_dashboard_component_config";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isMetricKey = (value: unknown): value is DashboardMetricKey => {
  return typeof value === "string" && [
    "cpu_percent",
    "gpu_percent",
    "ram_percent",
    "gpu_mem_percent",
    "cpu_freq_mhz",
    "gpu_freq_mhz",
    "gpu_mem_freq_mhz",
    "disk_percent",
    "battery_percent",
    "net_sent",
    "net_recv",
    "cpu_temp",
    "gpu_temp",
    "fan_speed_1",
    "fan_speed_2"
  ].includes(value);
};

const componentIds: DashboardComponentId[] = [
  "primaryGaugeLeft",
  "primaryGaugeRight",
  "progressTop",
  "progressBottom",
  "fanCompactLeft",
  "fanCompactRight",
  "networkChartLeft",
  "networkChartRight",
  "temperatureChartLeft",
  "temperatureChartRight",
  "loadChartLeft",
  "loadChartRight",
  "memoryChartLeft",
  "memoryChartRight"
];

const hydrateConfig = (raw: unknown): DashboardComponentConfig => {
  if (!isRecord(raw)) return defaultDashboardComponentConfig;

  return componentIds.reduce<DashboardComponentConfig>((config, id) => {
    const item = raw[id];
    if (!isRecord(item)) return config;

    const metric = item.metric;
    if (!isMetricKey(metric)) return config;

    return {
      ...config,
      [id]: {
        ...config[id],
        metric
      }
    };
  }, defaultDashboardComponentConfig);
};

export function useDashboardComponentConfig() {
  const [componentConfig, setComponentConfig] = useState<DashboardComponentConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? hydrateConfig(JSON.parse(stored)) : defaultDashboardComponentConfig;
    } catch {
      return defaultDashboardComponentConfig;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(componentConfig));
    } catch (e) {
      console.error("Failed to persist dashboard component config:", e);
    }
  }, [componentConfig]);

  const updateComponentMetric = (componentId: DashboardComponentId, metric: DashboardMetricKey) => {
    setComponentConfig((prev) => ({
      ...prev,
      [componentId]: {
        ...prev[componentId],
        metric
      }
    }));
  };

  const resetComponentConfig = () => {
    setComponentConfig(defaultDashboardComponentConfig);
  };

  return {
    componentConfig,
    updateComponentMetric,
    resetComponentConfig
  };
}
