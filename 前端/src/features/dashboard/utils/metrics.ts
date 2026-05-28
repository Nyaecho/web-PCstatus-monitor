import { ChartPoint, DashboardMetricKey, dashboardMetricOptions } from "../constants";
import { MetricData } from "../../../types";

export const getLatestMetricValue = (latestData: MetricData, metric: DashboardMetricKey) => {
  switch (metric) {
    case "net_sent":
      return latestData.net_sent_speed_kb;
    case "net_recv":
      return latestData.net_recv_speed_kb;
    case "gpu_percent":
      return latestData.gpu_percent ?? 0;
    case "gpu_temp":
      return latestData.gpu_temp ?? 45;
    case "cpu_temp":
      return latestData.cpu_temp ?? 42;
    case "fan_speed_1":
      return latestData.fan_speed_1 ?? 32;
    case "fan_speed_2":
      return latestData.fan_speed_2 ?? 38;
    case "gpu_mem_percent":
      return latestData.gpu_mem_percent ?? 28.5;
    case "cpu_freq_mhz":
      return latestData.cpu_freq_mhz ?? 3800;
    case "gpu_freq_mhz":
      return latestData.gpu_freq_mhz ?? 0;
    case "gpu_mem_freq_mhz":
      return latestData.gpu_mem_freq_mhz ?? 0;
    case "battery_percent":
      return latestData.battery_percent ?? 0;
    default:
      return latestData[metric];
  }
};

export const getChartMetricValue = (point: ChartPoint, metric: DashboardMetricKey) => {
  return point[metric] ?? 0;
};

export const formatMetricValue = (value: number, metric: DashboardMetricKey, decimals = 0) => {
  const option = dashboardMetricOptions[metric];
  if (option.valueType === "speed") {
    return value >= 1024 ? `${(value / 1024).toFixed(1)} MB/s` : `${value.toFixed(decimals)} KB/s`;
  }
  if (option.valueType === "frequency") {
    return `${value.toFixed(0)} MHz`;
  }
  return `${value.toFixed(decimals)}${option.unit}`;
};

export const getProgressMemoryText = (latestData: MetricData, metric: DashboardMetricKey) => {
  if (metric === "ram_percent") {
    return `${latestData.ram_used_gb.toFixed(1)}G / ${latestData.ram_total_gb.toFixed(0)}G`;
  }

  if (metric === "gpu_mem_percent") {
    return `${((8.0 * (latestData.gpu_mem_percent ?? 28.5)) / 100).toFixed(1)}G / 8G`;
  }

  if (metric === "cpu_freq_mhz") {
    return `${(latestData.cpu_freq_mhz ?? 3800).toFixed(0)} MHz`;
  }

  if (metric === "gpu_freq_mhz") {
    return `${(latestData.gpu_freq_mhz ?? 0).toFixed(0)} MHz`;
  }

  if (metric === "gpu_mem_freq_mhz") {
    return `${(latestData.gpu_mem_freq_mhz ?? 0).toFixed(0)} MHz`;
  }

  if (metric === "disk_percent") {
    return `${latestData.disk_used_gb.toFixed(1)}G / ${latestData.disk_total_gb.toFixed(0)}G`;
  }

  if (metric === "battery_percent") {
    return latestData.battery_percent !== undefined ? "当前电量" : "未检测到电池";
  }

  return dashboardMetricOptions[metric].label;
};
