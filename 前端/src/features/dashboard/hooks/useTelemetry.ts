import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackendMetricPayload,
  BackendStaticInfo,
  MetricData,
  SystemInfo,
  ConnectionStatus,
  TelemetryCategory
} from "../../../types";
import appConfig from "../../../config.json";
import {
  defaultMetricData,
  defaultSystemInfo,
  NetworkHistoryPoint
} from "../constants";
import { generateInitialHistory, normalizeSampleInterval, roundVal } from "../utils/telemetry";

const normalizeTelemetryCategories = (categories: TelemetryCategory[]) => {
  const unique = Array.from(new Set(categories));
  return unique.length > 0 ? unique : ["cpu"];
};

const normalizeStaticInfo = (data: BackendStaticInfo): SystemInfo => ({
  os: data.os ?? defaultSystemInfo.os,
  hostname: data.hostname ?? defaultSystemInfo.hostname,
  cpu_model: data.cpu?.model ?? defaultSystemInfo.cpu_model,
  cpu_cores: data.cpu?.cores_logical ?? data.cpu?.cores_physical ?? defaultSystemInfo.cpu_cores,
  cpu_freq: data.cpu?.freq_max ?? defaultSystemInfo.cpu_freq,
  ram_total_gb: data.ram?.total_gb ?? defaultSystemInfo.ram_total_gb,
  disk_total_gb: data.disk?.total_gb ?? defaultSystemInfo.disk_total_gb,
  up_time: data.system?.up_time ?? defaultSystemInfo.up_time,
  boot_time: data.system?.boot_time ?? defaultSystemInfo.boot_time
});

const normalizeMetricPayload = (payload: BackendMetricPayload, previous: MetricData): MetricData => {
  const timestamp = payload.system?.timestamp
    ? new Date(payload.system.timestamp).toTimeString().split(" ")[0]
    : new Date().toTimeString().split(" ")[0];

  return {
    ...previous,
    cpu_percent: payload.cpu?.percent ?? previous.cpu_percent,
    ram_percent: payload.ram?.percent ?? previous.ram_percent,
    ram_used_gb: payload.ram?.used_gb ?? previous.ram_used_gb,
    ram_total_gb: payload.ram?.total_gb ?? previous.ram_total_gb,
    disk_percent: payload.disk?.percent ?? previous.disk_percent,
    disk_used_gb: payload.disk?.used_gb ?? previous.disk_used_gb,
    disk_total_gb: payload.disk?.total_gb ?? previous.disk_total_gb,
    battery_percent: payload.battery?.percent ?? previous.battery_percent,
    net_sent_speed_kb: payload.network?.speed?.sent_kb ?? previous.net_sent_speed_kb,
    net_recv_speed_kb: payload.network?.speed?.recv_kb ?? previous.net_recv_speed_kb,
    gpu_percent: payload.gpu?.load_percent ?? previous.gpu_percent,
    gpu_temp: payload.gpu?.temp ?? previous.gpu_temp,
    cpu_freq_mhz: payload.cpu?.freq_current_mhz ?? previous.cpu_freq_mhz,
    gpu_freq_mhz: payload.gpu?.freq_mhz ?? previous.gpu_freq_mhz,
    gpu_mem_freq_mhz: payload.gpu?.mem_freq_mhz ?? previous.gpu_mem_freq_mhz,
    cpu_temp: payload.cpu?.temp ?? previous.cpu_temp,
    gpu_mem_percent: payload.gpu?.memory?.percent ?? previous.gpu_mem_percent,
    timestamp
  };
};

export function useTelemetry(isExtraWide: boolean, requestedCategories: TelemetryCategory[]) {
  const [wsUrl, setWsUrl] = useState<string>(() => {
    try {
      const stored = localStorage.getItem("telemetry_ws_url");
      return stored !== null ? stored : (appConfig.wsUrl || "ws://localhost:8765");
    } catch {
      return appConfig.wsUrl || "ws://localhost:8765";
    }
  });

  const [status, setStatus] = useState<ConnectionStatus>((appConfig.defaultMode || "SIMULATING") as ConnectionStatus);

  const [sampleInterval, setSampleInterval] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("telemetry_sample_interval");
      if (stored !== null) {
        const val = parseFloat(stored);
        if (!isNaN(val)) return normalizeSampleInterval(val);
      }
      return normalizeSampleInterval(appConfig.defaultSampleInterval || 3.0);
    } catch {
      return normalizeSampleInterval(appConfig.defaultSampleInterval || 3.0);
    }
  });

  const [isRealModeIntent, setIsRealModeIntent] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("telemetry_real_mode_intent");
      if (stored !== null) return stored === "true";
    } catch {}
    return appConfig.defaultMode === "CONNECTED";
  });

  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(defaultSystemInfo);
  const [latestData, setLatestData] = useState<MetricData>(defaultMetricData);
  const [netHistory, setNetHistory] = useState<NetworkHistoryPoint[]>(generateInitialHistory());

  const isRealModeIntentRef = useRef(isRealModeIntent);
  const wsUrlRef = useRef(wsUrl);
  const sampleIntervalRef = useRef(sampleInterval);
  const telemetryCategoriesRef = useRef(normalizeTelemetryCategories(requestedCategories));
  const latestDataRef = useRef(latestData);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketGenerationRef = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem("telemetry_ws_url", wsUrl);
    } catch (e) {
      console.error("Failed to persist wsUrl:", e);
    }
  }, [wsUrl]);

  useEffect(() => {
    try {
      localStorage.setItem("telemetry_sample_interval", sampleInterval.toFixed(1));
    } catch (e) {
      console.error("Failed to persist sampleInterval:", e);
    }
  }, [sampleInterval]);

  useEffect(() => {
    try {
      localStorage.setItem("telemetry_real_mode_intent", String(isRealModeIntent));
    } catch (e) {
      console.error("Failed to persist real mode intent:", e);
    }
  }, [isRealModeIntent]);

  const telemetryCategories = normalizeTelemetryCategories(requestedCategories);

  useEffect(() => {
    telemetryCategoriesRef.current = telemetryCategories;
  }, [telemetryCategories]);

  useEffect(() => {
    isRealModeIntentRef.current = isRealModeIntent;
  }, [isRealModeIntent]);

  useEffect(() => {
    wsUrlRef.current = wsUrl;
  }, [wsUrl]);

  useEffect(() => {
    sampleIntervalRef.current = sampleInterval;
  }, [sampleInterval]);

  useEffect(() => {
    latestDataRef.current = latestData;
  }, [latestData]);

  useEffect(() => {
    if (isExtraWide) {
      setNetHistory((prev) =>
        prev.map((pt) => {
          if (pt.cpu_percent !== undefined) return pt;
          const secs = new Date(pt.timestampMs).getSeconds();
          return {
            ...pt,
            cpu_percent: Math.round(15 + Math.abs(Math.sin(secs / 10) * 25) + Math.random() * 5),
            gpu_percent: Math.round(10 + Math.abs(Math.cos(secs / 15) * 20) + Math.random() * 5),
            ram_percent: Math.round(40 + Math.abs(Math.sin(secs / 20) * 2) + Math.random() * 0.5),
            gpu_mem_percent: Math.round(28 + Math.abs(Math.cos(secs / 25) * 1.5) + Math.random() * 0.5),
            cpu_freq_mhz: Math.round(3800 + Math.sin(secs / 11) * 90 + Math.random() * 10),
            gpu_freq_mhz: Math.round(2100 + Math.cos(secs / 13) * 120 + Math.random() * 10),
            gpu_mem_freq_mhz: Math.round(5000 + Math.sin(secs / 17) * 140 + Math.random() * 10),
            fan_speed_1: Math.round(30 + Math.abs(Math.sin(secs / 10) * 20) + Math.random() * 2),
            fan_speed_2: Math.round(35 + Math.abs(Math.cos(secs / 12) * 15) + Math.random() * 2),
            disk_percent: latestDataRef.current.disk_percent,
            battery_percent: latestDataRef.current.battery_percent
          };
        })
      );
    }
  }, [isExtraWide]);

  const appendHistoryData = useCallback((
    net_sent: number,
    net_recv: number,
    cpu_temp: number,
    gpu_temp: number,
    cpu_percent: number,
    gpu_percent: number,
    ram_percent: number,
    gpu_mem_percent: number,
    cpu_freq_mhz: number,
    gpu_freq_mhz: number,
    gpu_mem_freq_mhz: number,
    fan_speed_1: number,
    fan_speed_2: number
  ) => {
    setNetHistory((prev) => {
      const nowMs = Date.now();
      const cutoff = nowMs - 60000;
      const newPoint: NetworkHistoryPoint = {
        timestampMs: nowMs,
        timeStr: new Date().toTimeString().split(" ")[0],
        net_sent: Math.max(0.1, net_sent),
        net_recv: Math.max(0.1, net_recv),
        cpu_temp: cpu_temp ?? 42,
        gpu_temp: gpu_temp ?? 45,
        disk_percent: latestDataRef.current.disk_percent,
        battery_percent: latestDataRef.current.battery_percent,
        cpu_percent: cpu_percent ?? 10,
        gpu_percent: gpu_percent ?? 5,
        ram_percent: ram_percent ?? 40,
        gpu_mem_percent: gpu_mem_percent ?? 28,
        cpu_freq_mhz: cpu_freq_mhz ?? latestDataRef.current.cpu_freq_mhz ?? 0,
        gpu_freq_mhz: gpu_freq_mhz ?? 0,
        gpu_mem_freq_mhz: gpu_mem_freq_mhz ?? 0,
        fan_speed_1: fan_speed_1 ?? 30,
        fan_speed_2: fan_speed_2 ?? 35,
      };

      return [...prev, newPoint].filter((pt) => pt.timestampMs >= cutoff);
    });
  }, [isExtraWide]);

  const invalidateActiveSocket = useCallback(() => {
    socketGenerationRef.current += 1;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const lastSubscriptionRef = useRef<{ interval: number; categories: string }>({ interval: 0, categories: '' });

  const sendSubscription = useCallback((ws: WebSocket) => {
    const interval = sampleIntervalRef.current;
    const categories = telemetryCategoriesRef.current;
    const categoriesKey = [...categories].sort().join(',');
    
    // 检查配置是否变化
    if (lastSubscriptionRef.current.interval === interval && 
        lastSubscriptionRef.current.categories === categoriesKey) {
      console.log('[WebSocket] 订阅配置未变化，跳过发送');
      return;
    }
    
    lastSubscriptionRef.current = { interval, categories: categoriesKey };
    console.log('[WebSocket] 发送订阅请求:', { interval, categories });
    ws.send(JSON.stringify({
      type: "subscribe",
      interval,
      categories
    }));
  }, []);

  const connectDevice = useCallback(() => {
    setIsRealModeIntent(true);

    // 如果已有活跃连接，跳过
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] 已有活跃连接，跳过');
      return;
    }

    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (socketRef.current) {
      invalidateActiveSocket();
      try {
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
    }

    setStatus("CONNECTING");

    try {
      const targetUrl = wsUrlRef.current;
      const ws = new WebSocket(targetUrl);
      const currentGeneration = ++socketGenerationRef.current;
      socketRef.current = ws;

      ws.onopen = () => {
        if (currentGeneration !== socketGenerationRef.current) return;
        setStatus("CONNECTED");
        try {
          ws.send(JSON.stringify({ type: "get_static" }));
          sendSubscription(ws);
        } catch (e) {
          console.error("Failed to send initial websocket subscription:", e);
        }
      };

      ws.onmessage = (event) => {
        if (currentGeneration !== socketGenerationRef.current) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "static_info") {
            setSystemInfo(normalizeStaticInfo(payload.data));
          } else if (payload.type === "metrics") {
            const metrics = normalizeMetricPayload(payload.data, latestDataRef.current);

            setLatestData(metrics);
            appendHistoryData(
              metrics.net_sent_speed_kb,
              metrics.net_recv_speed_kb,
              metrics.cpu_temp,
              metrics.gpu_temp,
              metrics.cpu_percent,
              metrics.gpu_percent ?? 0,
              metrics.ram_percent,
              metrics.gpu_mem_percent ?? 0,
              metrics.cpu_freq_mhz ?? 0,
              metrics.gpu_freq_mhz ?? 0,
              metrics.gpu_mem_freq_mhz ?? 0,
              metrics.fan_speed_1 ?? 0,
              metrics.fan_speed_2 ?? 0
            );
          } else if (payload.type === "error") {
            console.error("WebSocket protocol error:", payload.data?.message);
          }
        } catch (err) {
          console.error("Error decoding websocket byte payload:", err);
        }
      };

      ws.onclose = () => {
        if (currentGeneration !== socketGenerationRef.current) return;
        setStatus("DISCONNECTED");
        socketRef.current = null;
        if (isRealModeIntentRef.current) {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            connectDevice();
          }, 3000);
        }
      };

      ws.onerror = (err) => {
        if (currentGeneration !== socketGenerationRef.current) return;
        console.error("WebSocket Link Error:", err);
        setStatus("DISCONNECTED");
        if (isRealModeIntentRef.current && !reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            connectDevice();
          }, 3000);
        }
      };
    } catch (e) {
      console.error("Initialization websocket failure:", e);
      setStatus("DISCONNECTED");
      if (isRealModeIntentRef.current && !reconnectTimerRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          connectDevice();
        }, 3000);
      }
    }
  }, [appendHistoryData, invalidateActiveSocket, sendSubscription]);

  const disconnectDevice = useCallback(() => {
    setIsRealModeIntent(false);
    invalidateActiveSocket();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
    }
    setStatus("DISCONNECTED");
  }, [invalidateActiveSocket]);

  const startSimulation = useCallback(() => {
    setIsRealModeIntent(false);
    invalidateActiveSocket();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
    }

    setStatus("SIMULATING");

    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }

    simulationIntervalRef.current = setInterval(() => {
      const now = new Date();
      const seconds = now.getSeconds();
      const timeStr = now.toTimeString().split(" ")[0];

      const cpuBase = Math.abs(Math.sin(seconds / 10) * 35) + 12;
      const cpuFuzz = Math.random() * 6 - 3;
      const finalCpu = Math.max(1, Math.min(100, cpuBase + cpuFuzz));

      const finalRam = 41.2 + Math.sin(seconds / 20) * 1.2 + (Math.random() * 0.1 - 0.05);
      const finalGpu = Math.max(0, Math.round(finalCpu * 0.82 + (Math.random() * 8 - 4)));
      const finalVram = 28.5 + Math.cos(seconds / 25) * 0.8 + (Math.random() * 0.1 - 0.05);

      const netSent = Math.max(1, finalCpu * 2.2 + (Math.random() * 12 - 6));
      const netRecv = Math.max(5, finalCpu * 6.4 + (Math.random() * 40 - 20));

      const cpuTempSim = Math.round(38 + finalCpu * 0.26 + (Math.random() * 2 - 1));
      const gpuTempSim = Math.round(41 + finalGpu * 0.20 + (Math.random() * 2 - 1));
      const cpuFreqSim = Math.round(3800 + (Math.random() * 120 - 60));
      const gpuFreqSim = Math.round(2100 + finalGpu * 8 + (Math.random() * 30 - 15));
      const gpuMemFreqSim = Math.round(5000 + finalGpu * 6 + (Math.random() * 30 - 15));

      const f1 = Math.round(22 + finalCpu * 0.65 + (Math.random() * 4 - 2));
      const f2 = Math.round(25 + finalGpu * 0.58 + (Math.random() * 4 - 2));

      const metrics: MetricData = {
        cpu_percent: finalCpu,
        cpu_cores_percent: Array.from({ length: 16 }, () => Math.round(finalCpu * (Math.random() * 0.6 + 0.7))),
        ram_percent: finalRam,
        ram_used_gb: roundVal((24.0 * finalRam) / 100, 2),
        ram_total_gb: 24.0,
        disk_percent: 54.8,
        disk_used_gb: 280.57,
        disk_total_gb: 512.0,
        net_sent_speed_kb: roundVal(netSent, 1),
        net_recv_speed_kb: roundVal(netRecv, 1),
        gpu_percent: finalGpu,
        gpu_temp: gpuTempSim,
        cpu_freq_mhz: cpuFreqSim,
        gpu_freq_mhz: gpuFreqSim,
        gpu_mem_freq_mhz: gpuMemFreqSim,
        cpu_temp: cpuTempSim,
        fan_speed_1: Math.max(5, Math.min(100, f1)),
        fan_speed_2: Math.max(5, Math.min(100, f2)),
        gpu_mem_percent: finalVram,
        battery_percent: 98,
        processes: [],
        timestamp: timeStr
      };

      setLatestData(metrics);
      appendHistoryData(
        metrics.net_sent_speed_kb,
        metrics.net_recv_speed_kb,
        metrics.cpu_temp!,
        metrics.gpu_temp!,
        metrics.cpu_percent,
        metrics.gpu_percent ?? 0,
        metrics.ram_percent,
        metrics.gpu_mem_percent ?? 0,
        metrics.cpu_freq_mhz ?? 0,
        metrics.gpu_freq_mhz ?? 0,
        metrics.gpu_mem_freq_mhz ?? 0,
        metrics.fan_speed_1 ?? 30,
        metrics.fan_speed_2 ?? 35
      );
    }, sampleInterval * 1000);
  }, [sampleInterval, appendHistoryData, invalidateActiveSocket]);

  // 初始化连接
  useEffect(() => {
    let isMounted = true;

    if (isRealModeIntentRef.current) {
      connectDevice();
    } else {
      startSimulation();
    }

    return () => {
      isMounted = false;
      // 延迟关闭，避免 StrictMode 双重挂载导致立即断开
      setTimeout(() => {
        if (!isMounted) {
          if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
          }
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          if (socketRef.current) {
            invalidateActiveSocket();
            try {
              socketRef.current.close();
            } catch (e) {}
            socketRef.current = null;
          }
        }
      }, 100);
    };
  }, []); // 空依赖，只执行一次

  // wsUrl 变化时重新连接
  useEffect(() => {
    if (isRealModeIntentRef.current && socketRef.current) {
      console.log('[WebSocket] URL 变化，重新连接');
      connectDevice();
    }
  }, [wsUrl]);

  useEffect(() => {
    if (status === "CONNECTED" && socketRef.current) {
      try {
        sendSubscription(socketRef.current);
      } catch (e) {
        console.error("Failed to update websocket subscription:", e);
      }
    } else if (status === "SIMULATING") {
      startSimulation();
    }
  }, [sampleInterval, telemetryCategories, status, startSimulation, sendSubscription]);

  return {
    wsUrl,
    setWsUrl,
    status,
    sampleInterval,
    setSampleInterval,
    telemetryCategories,
    isRealModeIntent,
    systemInfo,
    latestData,
    netHistory,
    connectDevice,
    disconnectDevice,
    startSimulation
  };
}
