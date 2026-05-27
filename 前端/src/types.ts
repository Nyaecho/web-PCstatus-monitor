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

export interface HistoricalHistory {
  cpu: number[];
  ram: number[];
  disk: number[];
  net_sent: number[];
  net_recv: number[];
  timestamps: string[];
}

export type ConnectionStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "SIMULATING";
