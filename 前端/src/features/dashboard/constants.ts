import { MetricData, SystemInfo, TelemetryCategory } from "../../types";

export interface NetworkHistoryPoint {
  timestampMs: number;
  timeStr: string;
  net_sent: number;
  net_recv: number;
  cpu_temp: number;
  gpu_temp: number;
  cpu_percent?: number;
  gpu_percent?: number;
  ram_percent?: number;
  gpu_mem_percent?: number;
  cpu_freq_mhz?: number;
  gpu_freq_mhz?: number;
  gpu_mem_freq_mhz?: number;
  fan_speed_1?: number;
  fan_speed_2?: number;
  disk_percent?: number;
  battery_percent?: number;
}

export interface ChartPoint extends NetworkHistoryPoint {
  elapsed: number;
}

export interface TimeAxisConfig {
  windowSeconds: number;
  ticks: number[];
  compactTicks: number[];
}

export type DashboardMetricKey =
  | "cpu_percent"
  | "gpu_percent"
  | "ram_percent"
  | "gpu_mem_percent"
  | "cpu_freq_mhz"
  | "gpu_freq_mhz"
  | "gpu_mem_freq_mhz"
  | "disk_percent"
  | "battery_percent"
  | "net_sent"
  | "net_recv"
  | "cpu_temp"
  | "gpu_temp"
  | "fan_speed_1"
  | "fan_speed_2";

export type DashboardComponentId =
  | "primaryGaugeLeft"
  | "primaryGaugeRight"
  | "progressTop"
  | "progressBottom"
  | "fanCompactLeft"
  | "fanCompactRight"
  | "networkChartLeft"
  | "networkChartRight"
  | "temperatureChartLeft"
  | "temperatureChartRight"
  | "loadChartLeft"
  | "loadChartRight"
  | "memoryChartLeft"
  | "memoryChartRight";

export interface DashboardMetricOption {
  key: DashboardMetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  color: string;
  valueType: "percent" | "temperature" | "speed" | "frequency";
}

export interface DashboardComponentConfigItem {
  metric: DashboardMetricKey;
}

export type DashboardComponentConfig = Record<DashboardComponentId, DashboardComponentConfigItem>;

export const sampleIntervalOptions = [0.5, 1, 3] as const;

export const telemetryCategoryOptions: Array<{ key: TelemetryCategory; label: string; description: string }> = [
  { key: "cpu", label: "CPU", description: "占用率、温度、频率" },
  { key: "ram", label: "内存", description: "占用率、已用/总量" },
  { key: "gpu", label: "GPU", description: "负载、温度、显存" },
  { key: "network", label: "网络", description: "上传/下载速度" },
  { key: "disk", label: "磁盘", description: "系统盘使用情况" },
  { key: "battery", label: "电池", description: "电量、充电状态" },
  { key: "system", label: "系统", description: "运行时间、时间戳" }
];

export const defaultTelemetryCategories: TelemetryCategory[] = ["cpu", "ram", "gpu", "network", "disk", "system"];

export const dashboardMetricOptions: Record<DashboardMetricKey, DashboardMetricOption> = {
  cpu_percent: { key: "cpu_percent", label: "CPU 负载", shortLabel: "CPU", unit: "%", color: "#2563eb", valueType: "percent" },
  cpu_freq_mhz: { key: "cpu_freq_mhz", label: "CPU 频率", shortLabel: "CPU频率", unit: "MHz", color: "#7c3aed", valueType: "frequency" },
  gpu_percent: { key: "gpu_percent", label: "GPU 负载", shortLabel: "GPU", unit: "%", color: "#10b981", valueType: "percent" },
  ram_percent: { key: "ram_percent", label: "RAM 占用", shortLabel: "RAM", unit: "%", color: "#6366f1", valueType: "percent" },
  gpu_mem_percent: { key: "gpu_mem_percent", label: "显存占用", shortLabel: "显存", unit: "%", color: "#14b8a6", valueType: "percent" },
  gpu_freq_mhz: { key: "gpu_freq_mhz", label: "GPU 核心频率", shortLabel: "GPU频率", unit: "MHz", color: "#8b5cf6", valueType: "frequency" },
  gpu_mem_freq_mhz: { key: "gpu_mem_freq_mhz", label: "GPU 显存频率", shortLabel: "显存频率", unit: "MHz", color: "#0ea5e9", valueType: "frequency" },
  disk_percent: { key: "disk_percent", label: "磁盘占用", shortLabel: "磁盘", unit: "%", color: "#f59e0b", valueType: "percent" },
  battery_percent: { key: "battery_percent", label: "电池电量", shortLabel: "电池", unit: "%", color: "#22c55e", valueType: "percent" },
  net_sent: { key: "net_sent", label: "上传速率", shortLabel: "上传", unit: "KB/s", color: "#ef4444", valueType: "speed" },
  net_recv: { key: "net_recv", label: "下载速率", shortLabel: "下载", unit: "KB/s", color: "#2563eb", valueType: "speed" },
  cpu_temp: { key: "cpu_temp", label: "CPU 温度", shortLabel: "CPU温度", unit: "°C", color: "#ef4444", valueType: "temperature" },
  gpu_temp: { key: "gpu_temp", label: "GPU 温度", shortLabel: "GPU温度", unit: "°C", color: "#2563eb", valueType: "temperature" },
  fan_speed_1: { key: "fan_speed_1", label: "FAN1 转速", shortLabel: "FAN1", unit: "%", color: "#2563eb", valueType: "percent" },
  fan_speed_2: { key: "fan_speed_2", label: "FAN2 转速", shortLabel: "FAN2", unit: "%", color: "#10b981", valueType: "percent" }
};

export const defaultDashboardComponentConfig: DashboardComponentConfig = {
  primaryGaugeLeft: { metric: "cpu_percent" },
  primaryGaugeRight: { metric: "gpu_percent" },
  progressTop: { metric: "ram_percent" },
  progressBottom: { metric: "gpu_mem_percent" },
  fanCompactLeft: { metric: "fan_speed_1" },
  fanCompactRight: { metric: "fan_speed_2" },
  networkChartLeft: { metric: "net_sent" },
  networkChartRight: { metric: "net_recv" },
  temperatureChartLeft: { metric: "cpu_temp" },
  temperatureChartRight: { metric: "gpu_temp" },
  loadChartLeft: { metric: "cpu_percent" },
  loadChartRight: { metric: "gpu_percent" },
  memoryChartLeft: { metric: "ram_percent" },
  memoryChartRight: { metric: "gpu_mem_percent" }
};

export const metricToTelemetryCategory: Record<DashboardMetricKey, TelemetryCategory> = {
  cpu_percent: "cpu",
  cpu_temp: "cpu",
  cpu_freq_mhz: "cpu",
  fan_speed_1: "cpu",
  ram_percent: "ram",
  gpu_percent: "gpu",
  gpu_temp: "gpu",
  gpu_mem_percent: "gpu",
  gpu_freq_mhz: "gpu",
  gpu_mem_freq_mhz: "gpu",
  fan_speed_2: "gpu",
  net_sent: "network",
  net_recv: "network",
  disk_percent: "disk",
  battery_percent: "battery"
};

export const deriveTelemetryCategoriesFromConfig = (config: DashboardComponentConfig): TelemetryCategory[] => {
  return Array.from(new Set(
    Object.values(config).map((item) => metricToTelemetryCategory[item.metric])
  ));
};

export const defaultSystemInfo: SystemInfo = {
  os: "macOS Sequoia 15.1 (高级仿真节点)",
  hostname: "Nexus-01",
  cpu_model: "Apple M4 Max",
  cpu_cores: 16,
  cpu_freq: "4200 MHz",
  ram_total_gb: 24.0,
  disk_total_gb: 512.0,
  up_time: "02:44:12",
  boot_time: "2026-05-25 11:51:24"
};

export const defaultMetricData: MetricData = {
  cpu_percent: 18.4,
  cpu_cores_percent: [12, 24, 8, 32, 16, 20, 10, 24, 8, 38, 14, 22, 10, 26, 8, 18],
  cpu_freq_mhz: 3800,
  ram_percent: 41.2,
  ram_used_gb: 9.89,
  ram_total_gb: 24.0,
  disk_percent: 54.8,
  disk_used_gb: 280.57,
  disk_total_gb: 512.0,
  battery_percent: 98,
  net_sent_speed_kb: 45.4,
  net_recv_speed_kb: 182.9,
  gpu_percent: 24.0,
  gpu_temp: 45,
  cpu_temp: 42,
  fan_speed_1: 32,
  fan_speed_2: 38,
  gpu_freq_mhz: 2100,
  gpu_mem_freq_mhz: 5000,
  gpu_mem_percent: 28.5,
  processes: [],
  timestamp: "14:06:12"
};

export const timeAxisConfigMap: Record<number, TimeAxisConfig> = {
  0.5: { windowSeconds: 10, ticks: [-10, -8, -6, -4, -2, 0], compactTicks: [-10, -5, 0] },
  1: { windowSeconds: 20, ticks: [-20, -15, -10, -5, 0], compactTicks: [-20, -10, 0] },
  3: { windowSeconds: 60, ticks: [-60, -45, -30, -15, 0], compactTicks: [-60, -30, 0] }
};
