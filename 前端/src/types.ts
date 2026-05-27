/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SystemInfo {
  os: string;
  hostname: string;
  cpu_model: string;
  cpu_cores: number;
  cpu_freq: string;
  ram_total_gb: number;
  disk_total_gb: number;
  up_time: string;
  boot_time: string;
}

export type TelemetryCategory = "cpu" | "ram" | "gpu" | "network" | "disk" | "battery" | "system";

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
  memory_used_mb: number;
}

export interface MetricData {
  cpu_percent: number;
  cpu_cores_percent: number[];
  ram_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  disk_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  battery_percent?: number;
  net_sent_speed_kb: number; // sent in KB/s
  net_recv_speed_kb: number; // received in KB/s
  gpu_percent?: number;
  gpu_temp?: number;
  cpu_temp?: number;
  fan_speed_1?: number;
  fan_speed_2?: number;
  gpu_mem_percent?: number;
  processes: ProcessInfo[];
  timestamp: string; // "HH:MM:SS"
}

export interface BackendStaticInfo {
  os?: string;
  hostname?: string;
  cpu?: {
    model?: string;
    cores_physical?: number;
    cores_logical?: number;
    freq_max?: string;
  };
  ram?: {
    total_gb?: number;
  };
  disk?: {
    total_gb?: number;
  };
  gpu?: Array<{
    id?: number;
    name?: string;
    memory_total_gb?: number;
  }>;
  system?: {
    boot_time?: string;
    up_time?: string;
    python_version?: string;
  };
}

export interface BackendMetricPayload {
  cpu?: {
    percent?: number;
    temp?: number | null;
    freq_current_mhz?: number | null;
  };
  ram?: {
    percent?: number;
    used_gb?: number;
    available_gb?: number;
    total_gb?: number;
  };
  gpu?: {
    load_percent?: number;
    temp?: number;
    memory?: {
      used_gb?: number;
      total_gb?: number;
      percent?: number;
    };
  };
  network?: {
    speed?: {
      sent_kb?: number;
      recv_kb?: number;
    };
    total?: {
      sent_gb?: number;
      recv_gb?: number;
    };
  };
  disk?: {
    percent?: number;
    used_gb?: number;
    free_gb?: number;
    total_gb?: number;
  };
  battery?: {
    percent?: number;
    power_plugged?: boolean;
    secs_left?: number | null;
  };
  system?: {
    up_time?: string;
    timestamp?: string;
  };
}

export interface HistoricalHistory {
  cpu: number[];
  ram: number[];
  disk: number[];
  net_sent: number[];
  net_recv: number[];
  timestamps: string[];
}

export type ConnectionStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "SIMULATING";
