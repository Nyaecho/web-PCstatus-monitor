import { ChartPoint, NetworkHistoryPoint, sampleIntervalOptions, timeAxisConfigMap } from "../constants";

export const normalizeSampleInterval = (val: number) => {
  if (!Number.isFinite(val)) return sampleIntervalOptions[2];
  return sampleIntervalOptions.reduce((closest, option) => {
    return Math.abs(option - val) < Math.abs(closest - val) ? option : closest;
  }, sampleIntervalOptions[0]);
};

export const roundVal = (val: number, decimals: number) => {
  const power = Math.pow(10, decimals);
  return Math.round(val * power) / power;
};

export const generateInitialHistory = (): NetworkHistoryPoint[] => {
  const points: NetworkHistoryPoint[] = [];
  const now = Date.now();
  for (let i = 30; i >= 0; i--) {
    const timeMs = now - i * 2000;
    const date = new Date(timeMs);
    const secs = date.getSeconds();
    points.push({
      timestampMs: timeMs,
      timeStr: date.toTimeString().split(" ")[0],
      net_sent: Math.max(5.0, Math.abs(Math.sin(secs / 10) * 50) + 12 + Math.random() * 5),
      net_recv: Math.max(15.0, Math.abs(Math.cos(secs / 8) * 280) + 40 + Math.random() * 20),
      cpu_temp: Math.round(41 + Math.abs(Math.sin(secs / 12) * 12) + Math.random() * 2),
      cpu_freq_mhz: Math.round(3800 + Math.abs(Math.sin(secs / 13) * 120) + Math.random() * 10),
      gpu_temp: Math.round(44 + Math.abs(Math.cos(secs / 15) * 10) + Math.random() * 2),
      gpu_freq_mhz: Math.round(2100 + Math.abs(Math.sin(secs / 18) * 180) + Math.random() * 25),
      gpu_mem_freq_mhz: Math.round(5000 + Math.abs(Math.cos(secs / 20) * 150) + Math.random() * 25)
    });
  }
  return points;
};

export const buildChartData = (history: NetworkHistoryPoint[], sampleInterval: number): ChartPoint[] => {
  const timeAxisConfig = timeAxisConfigMap[sampleInterval] ?? timeAxisConfigMap[1];
  const latestTimeMs = history.length > 0 ? history[history.length - 1].timestampMs : Date.now();

  return history
    .map((pt) => ({
      ...pt,
      elapsed: (pt.timestampMs - latestTimeMs) / 1000
    }))
    .filter((pt) => pt.elapsed >= -timeAxisConfig.windowSeconds);
};
