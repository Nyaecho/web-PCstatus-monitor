import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Settings,
  Activity,
  Play,
  RefreshCw,
  CheckCircle2,
  Database,
  Wifi,
  Maximize,
  Minimize
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { MetricData, SystemInfo, ConnectionStatus } from "./types";
import RotarySelector from "./components/RotarySelector";
import ArcGauge from "./components/ArcGauge";
import appConfig from "./config.json";

interface NetworkHistoryPoint {
  timestampMs: number;
  timeStr: string;
  net_sent: number; // sent in KB/s
  net_recv: number; // received in KB/s
  cpu_temp: number; // temperature in °C
  gpu_temp: number; // temperature in °C
  cpu_percent?: number; // CPU % (Optional, only loaded in extra wide mode)
  gpu_percent?: number; // GPU %
  ram_percent?: number; // RAM %
  gpu_mem_percent?: number; // VRAM %
  fan_speed_1?: number; // Fan 1 speed %
  fan_speed_2?: number; // Fan 2 speed %
}

const sampleIntervalOptions = [0.5, 1, 3] as const;

const normalizeSampleInterval = (val: number) => {
  if (!Number.isFinite(val)) return sampleIntervalOptions[2];
  return sampleIntervalOptions.reduce((closest, option) => {
    return Math.abs(option - val) < Math.abs(closest - val) ? option : closest;
  }, sampleIntervalOptions[0]);
};

// Generates 60 seconds of realistic baseline history on load so elements fit beautifully immediately
const generateInitialHistory = (): NetworkHistoryPoint[] => {
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
      gpu_temp: Math.round(44 + Math.abs(Math.cos(secs / 15) * 10) + Math.random() * 2)
    });
  }
  return points;
};

export default function App() {
  // Config states initialized with local storage persistence
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

  // State pointing to if the user intentionally wants to connect to a real device
  const [isRealModeIntent, setIsRealModeIntent] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("telemetry_real_mode_intent");
      if (stored !== null) return stored === "true";
    } catch {}
    return appConfig.defaultMode === "CONNECTED";
  });

  // Dynamic values synchronized back to localStorage on change
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

  // Sync refs to bypass closures inside WebSocket event handlers
  const isRealModeIntentRef = useRef(isRealModeIntent);
  const wsUrlRef = useRef(wsUrl);
  const sampleIntervalRef = useRef(sampleInterval);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isRealModeIntentRef.current = isRealModeIntent;
  }, [isRealModeIntent]);

  useEffect(() => {
    wsUrlRef.current = wsUrl;
  }, [wsUrl]);

  useEffect(() => {
    sampleIntervalRef.current = sampleInterval;
  }, [sampleInterval]);
  const [showConfig, setShowConfig] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [bypassPortrait, setBypassPortrait] = useState(false);
  const [isExtraWide, setIsExtraWide] = useState(false);

  useEffect(() => {
    const handleOrientationAndWidth = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
      setIsExtraWide(window.innerWidth >= 1000);
    };
    handleOrientationAndWidth();
    window.addEventListener("resize", handleOrientationAndWidth);
    return () => window.removeEventListener("resize", handleOrientationAndWidth);
  }, []);

  // Performance Optimization: Backfill or strip memory-heavy additional telemetry fields on viewport transitions
  useEffect(() => {
    if (isExtraWide) {
      setNetHistory((prev) =>
        prev.map((pt) => {
          if (pt.cpu_percent !== undefined) return pt; // Already populated
          const secs = new Date(pt.timestampMs).getSeconds();
          return {
            ...pt,
            cpu_percent: Math.round(15 + Math.abs(Math.sin(secs / 10) * 25) + Math.random() * 5),
            gpu_percent: Math.round(10 + Math.abs(Math.cos(secs / 15) * 20) + Math.random() * 5),
            ram_percent: Math.round(40 + Math.abs(Math.sin(secs / 20) * 2) + Math.random() * 0.5),
            gpu_mem_percent: Math.round(28 + Math.abs(Math.cos(secs / 25) * 1.5) + Math.random() * 0.5),
            fan_speed_1: Math.round(30 + Math.abs(Math.sin(secs / 10) * 20) + Math.random() * 2),
            fan_speed_2: Math.round(35 + Math.abs(Math.cos(secs / 12) * 15) + Math.random() * 2)
          };
        })
      );
    } else {
      setNetHistory((prev) =>
        prev.map((pt) => {
          const {
            cpu_percent,
            gpu_percent,
            ram_percent,
            gpu_mem_percent,
            fan_speed_1,
            fan_speed_2,
            ...stripped
          } = pt;
          return stripped;
        })
      );
    }
  }, [isExtraWide]);
  const wakeLockRef = useRef<any>(null);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
    };
  }, []);

  const requestWakeLock = async () => {
    if ("wakeLock" in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        console.log("Screen Wake Lock active");
      } catch (err: any) {
        console.warn(`Wake Lock request failed: ${err.message}`);
      }
    }
  };

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log("Screen Wake Lock released");
      } catch (err: any) {
        console.error(`Wake Lock release failed: ${err.message}`);
      }
    }
  }, []);

  useEffect(() => {
    requestWakeLock();

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        await requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // System target info
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>({
    os: "macOS Sequoia 15.1 (高级仿真节点)",
    hostname: "Nexus-01",
    cpu_model: "Apple M4 Max",
    cpu_cores: 16,
    cpu_freq: "4200 MHz",
    ram_total_gb: 24.0,
    disk_total_gb: 512.0,
    up_time: "02:44:12",
    boot_time: "2026-05-25 11:51:24"
  });

  // Latest instant values
  const [latestData, setLatestData] = useState<MetricData>({
    cpu_percent: 18.4,
    cpu_cores_percent: [12, 24, 8, 32, 16, 20, 10, 24, 8, 38, 14, 22, 10, 26, 8, 18],
    ram_percent: 41.2,
    ram_used_gb: 9.89,
    ram_total_gb: 24.0,
    disk_percent: 54.8,
    disk_used_gb: 280.57,
    disk_total_gb: 512.0,
    net_sent_speed_kb: 45.4,
    net_recv_speed_kb: 182.9,
    gpu_percent: 24.0,
    gpu_temp: 45,
    cpu_temp: 42,
    fan_speed_1: 32,
    fan_speed_2: 38,
    gpu_mem_percent: 28.5,
    processes: [],
    timestamp: "14:06:12"
  });

  // History queue precisely restricted to 60 seconds (prevents memory leak)
  const [netHistory, setNetHistory] = useState<NetworkHistoryPoint[]>(generateInitialHistory());

  // Refs for tracking
  const socketRef = useRef<WebSocket | null>(null);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketGenerationRef = useRef(0);

  // Standard safe rounding
  const roundVal = (val: number, decimals: number) => {
    const power = Math.pow(10, decimals);
    return Math.round(val * power) / power;
  };

  // Prepend and filter out records older than 60s
  const appendHistoryData = useCallback((
    net_sent: number,
    net_recv: number,
    cpu_temp: number,
    gpu_temp: number,
    cpu_percent: number,
    gpu_percent: number,
    ram_percent: number,
    gpu_mem_percent: number,
    fan_speed_1: number,
    fan_speed_2: number
  ) => {
    setNetHistory((prev) => {
      const nowMs = Date.now();
      const cutoff = nowMs - 60000; // Subtract exactly 60 seconds (60,000ms)
      
      const newPoint: NetworkHistoryPoint = {
        timestampMs: nowMs,
        timeStr: new Date().toTimeString().split(" ")[0],
        net_sent: Math.max(0.1, net_sent),
        net_recv: Math.max(0.1, net_recv),
        cpu_temp: cpu_temp ?? 42,
        gpu_temp: gpu_temp ?? 45,
        // Memory optimization: only record and track the heavy telemetry metrics if we are actually rendering them in extra wide mode
        ...(isExtraWide ? {
          cpu_percent: cpu_percent ?? 10,
          gpu_percent: gpu_percent ?? 5,
          ram_percent: ram_percent ?? 40,
          gpu_mem_percent: gpu_mem_percent ?? 28,
          fan_speed_1: fan_speed_1 ?? 30,
          fan_speed_2: fan_speed_2 ?? 35
        } : {})
      };

      // Merge and filter queue to instantly drop points older than 60s
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

  // Web Socket Routine
  const connectDevice = useCallback(() => {
    setIsRealModeIntent(true);

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
          ws.send(JSON.stringify({ type: "set_interval", value: sampleIntervalRef.current }));
        } catch (e) {
          console.error("Failed to send initial set_interval msg:", e);
        }
      };

      ws.onmessage = (event) => {
        if (currentGeneration !== socketGenerationRef.current) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "static_info") {
            setSystemInfo(payload.data);
          } else if (payload.type === "metrics") {
            const metrics: MetricData = payload.data;
            // Align and fallback enriched parameters
            const cpuTemp = metrics.cpu_temp ?? Math.round(38 + metrics.cpu_percent * 0.25);
            const gpuTemp = metrics.gpu_temp ?? Math.round(41 + (metrics.gpu_percent ?? 15) * 0.22);
            const f1 = metrics.fan_speed_1 ?? Math.round(20 + metrics.cpu_percent * 0.7);
            const f2 = metrics.fan_speed_2 ?? Math.round(22 + (metrics.gpu_percent ?? 15) * 0.65);
            
            const enriched: MetricData = {
              ...metrics,
              cpu_temp: cpuTemp,
              gpu_temp: gpuTemp,
              fan_speed_1: Math.max(0, Math.min(100, f1)),
              fan_speed_2: Math.max(0, Math.min(100, f2))
            };
            setLatestData(enriched);
            appendHistoryData(
              enriched.net_sent_speed_kb,
              enriched.net_recv_speed_kb,
              enriched.cpu_temp!,
              enriched.gpu_temp!,
              enriched.cpu_percent,
              enriched.gpu_percent ?? 0,
              enriched.ram_percent,
              enriched.gpu_mem_percent ?? 0,
              enriched.fan_speed_1 ?? 30,
              enriched.fan_speed_2 ?? 35
            );
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
          }, 3000); // Attempt reconnection every 3s
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
  }, [appendHistoryData]);

  const disconnectDevice = () => {
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
  };

  // Launch standard fluid simulation generator
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
        cpu_temp: cpuTempSim,
        fan_speed_1: Math.max(5, Math.min(100, f1)),
        fan_speed_2: Math.max(5, Math.min(100, f2)),
        gpu_mem_percent: finalVram,
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
        metrics.fan_speed_1 ?? 30,
        metrics.fan_speed_2 ?? 35
      );
    }, sampleInterval * 1000);
  }, [sampleInterval, appendHistoryData]);

  // Sync core operational mode automatically
  useEffect(() => {
    if (isRealModeIntent) {
      connectDevice();
    } else {
      startSimulation();
    }
    return () => {
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
    };
  }, [isRealModeIntent, wsUrl, startSimulation, connectDevice]);

  // Handle active sampling adjustments
  useEffect(() => {
    if (status === "CONNECTED" && socketRef.current) {
      try {
        socketRef.current.send(JSON.stringify({ type: "set_interval", value: sampleInterval }));
      } catch (e) {
        console.error("Failed to update sample interval over websocket:", e);
      }
    } else if (status === "SIMULATING") {
      startSimulation();
    }
  }, [sampleInterval, status, startSimulation]);

  const timeAxisConfigMap: Record<number, { windowSeconds: number; ticks: number[]; compactTicks: number[] }> = {
    0.5: { windowSeconds: 10, ticks: [-10, -8, -6, -4, -2, 0], compactTicks: [-10, -5, 0] },
    1: { windowSeconds: 20, ticks: [-20, -15, -10, -5, 0], compactTicks: [-20, -10, 0] },
    3: { windowSeconds: 60, ticks: [-60, -45, -30, -15, 0], compactTicks: [-60, -30, 0] }
  };

  const timeAxisConfig = timeAxisConfigMap[sampleInterval] ?? timeAxisConfigMap[1];
  const timeWindowSeconds = timeAxisConfig.windowSeconds;
  const timeAxisTicks = timeAxisConfig.ticks;
  const compactTimeAxisTicks = timeAxisConfig.compactTicks;

  // Build relative time offsets for plotting within the dynamic window
  const latestTimeMs = netHistory.length > 0 ? netHistory[netHistory.length - 1].timestampMs : Date.now();
  const chartData = netHistory
    .map((pt) => {
      const elapsed = (pt.timestampMs - latestTimeMs) / 1000; // Ranges <= 0
      return {
        ...pt,
        elapsed
      };
    })
    .filter((pt) => pt.elapsed >= -timeWindowSeconds);

  if (isPortrait && !bypassPortrait) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#EAF4FE] to-[#D5E6F5] flex flex-col items-center justify-center p-6 text-center z-50 select-none font-sans">
        <div className="bg-white/95 border border-sky-100 rounded-3xl p-8 max-w-sm shadow-2xl backdrop-blur-sm relative space-y-6">
          <div className="mx-auto w-20 h-20 bg-blue-50 border border-sky-100 rounded-full flex items-center justify-center animate-bounce shadow-inner">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-blue-600 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <path d="M12 18h.01" />
              <path d="M16 6h2M16 10h2M16 14h2" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black text-sky-950 tracking-tight">请将设备旋转为横屏</h2>
            <p className="text-xs text-slate-500 leading-relaxed px-1">
              检测到您正在使用<b>竖屏</b>浏览。遥测仪表盘和流式波形趋势更适合宽屏视野，推荐您将机器或浏览器调节为横屏。
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => setBypassPortrait(true)}
              className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer"
            >
              仍要继续浏览 (保持竖屏)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-screen bg-[#EAF4FE] text-slate-800 flex flex-col font-sans select-none p-2 relative ${isExtraWide ? "overflow-y-auto" : "overflow-hidden"}`}>
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500 opacity-90" />
      
      {/* Dynamic Keyframes & Reset Outline Focus Styling Inject */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        /* Prevent interaction or focused outline boxes on Recharts dynamic sections on mouse actions / mouse down */
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

      {/* Connection Offline Overlay (rendered at z-20 so it is behind buttons z-30 and settings z-50) */}
      <AnimatePresence>
        {isRealModeIntent && status !== "CONNECTED" && (
          <motion.div
            key="offline-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md flex flex-col items-center justify-center z-20 text-center p-6 space-y-4 rounded-2xl"
          >
            <div className="w-16 h-16 bg-white/10 border border-white/20 rounded-full flex items-center justify-center animate-pulse shadow-lg backdrop-blur-sm">
              <Wifi size={24} className="text-rose-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-white drop-shadow-sm">物理链路未连接</h3>
              <p className="text-xs text-sky-100/80 font-medium max-w-sm px-4">
                系统当前处于真机运行模式，但未检测到活跃的遥测链路。
              </p>
            </div>
            <div className="bg-slate-950/60 backdrop-blur-md border border-sky-300/10 rounded-xl px-4 py-2.5 font-mono text-[10px] text-sky-200/90 space-y-1.5 text-left min-w-[260px] shadow-2xl">
              <div>目标地址: <span className="text-white font-bold">{wsUrl}</span></div>
              <div className="flex items-center gap-1.5">
                实时状态: 
                {status === "CONNECTING" ? (
                  <span className="text-amber-300 font-bold flex items-center gap-1">
                    <RefreshCw size={9} className="animate-spin inline" /> 正在重连中...
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold">未就绪 (自动连重中)</span>
                )}
              </div>
            </div>
            <p className="text-[10px] text-sky-100/50 select-auto">
              提示：可点击右上角 <Settings size={10} className="inline mx-0.5 animate-spin" style={{ animationDuration: '4s' }} /> 设置图标修改配置或切回仿真模式
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unobtrusive, highly minimalist controls placed in the absolute top right corner */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 z-30">
        <button
          onClick={toggleFullScreen}
          className="p-1.5 bg-white/80 hover:bg-white border border-sky-200/60 rounded-lg text-sky-600 hover:text-sky-800 shadow-sm transition-all cursor-pointer flex items-center justify-center"
          title={isFullScreen ? "退出全屏" : "全屏显示"}
          style={{ width: "26px", height: "26px" }}
        >
          {isFullScreen ? <Minimize size={12} /> : <Maximize size={12} />}
        </button>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="p-1.5 bg-white/80 hover:bg-white border border-sky-200/60 rounded-lg text-sky-600 hover:text-sky-800 shadow-sm transition-all cursor-pointer flex items-center justify-center"
          title="配置频率与数据源"
          style={{ width: "26px", height: "26px" }}
        >
          <Settings size={12} className="hover:rotate-45 transition-transform duration-300" />
        </button>
      </div>

      {/* Immersive Dashboard Columns Block -> Completely shifted up with zero high space wastage */}
      <main className={`flex-1 flex flex-col gap-2.5 p-0.5 ${isExtraWide ? "" : "h-full overflow-hidden"}`}>
        
        {/* Top Hardware Section - Shunted further upward and made extremely thin & compact */}
        <section className="shrink-0 flex items-center p-2.5 bg-white/70 border border-sky-100/90 rounded-xl gap-4 overflow-hidden min-h-0 shadow-sm shadow-blue-50/50">
          
          {/* Gauges (Left Side, CPU / GPU shrunken in the top-left) */}
          <div className="flex items-center gap-1 shrink-0">
            <ArcGauge
              value={latestData.cpu_percent}
              label="CPU"
              color="#2563eb"
            />
            <ArcGauge
              value={latestData.gpu_percent ?? 0}
              label="GPU"
              color="#10b981"
            />
          </div>

          {/* Thin ambient vertical divider */}
          <div className="w-px h-10 bg-sky-200/80 self-center shrink-0" />

          {/* Compressed Progress stack level-bars (RAM & VRAM) */}
          <div className="w-[30%] xl:w-[35%] flex-none flex flex-col justify-center gap-2 min-w-0 pr-1">
            
            {/* RAM Progress level */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center justify-between text-[9px] text-sky-800/80 font-mono">
                <span className="font-semibold text-sky-900">RAM</span>
                <span>{latestData.ram_used_gb.toFixed(1)}G / {latestData.ram_total_gb.toFixed(0)}G</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Horizontal Bar */}
                <div className="flex-1 bg-sky-100/50 h-1.5 rounded-full overflow-hidden border border-sky-200/30 relative">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-sky-450 h-full rounded-full transition-all duration-500"
                    style={{ width: `${latestData.ram_percent}%` }}
                  />
                </div>
                {/* Value display */}
                <span className="text-[11px] font-bold font-mono text-sky-950 min-w-[32px] text-right shrink-0">
                  {latestData.ram_percent.toFixed(0)}%
                </span>
                {/* Outer label */}
                <span className="text-[9px] font-bold text-sky-700 min-w-[28px] text-center bg-sky-100/70 px-1 rounded border border-sky-200/90 shrink-0">
                  RAM
                </span>
              </div>
            </div>

            {/* VRAM Progress level */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center justify-between text-[9px] text-sky-800/80 font-mono">
                <span className="font-semibold text-sky-900">显存</span>
                <span>{((8.0 * (latestData.gpu_mem_percent ?? 28.5)) / 100).toFixed(1)}G / 8G</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Horizontal Bar */}
                <div className="flex-1 bg-sky-100/50 h-1.5 rounded-full overflow-hidden border border-sky-200/30 relative">
                  <div
                    className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${latestData.gpu_mem_percent ?? 28.5}%` }}
                  />
                </div>
                {/* Value display */}
                <span className="text-[11px] font-bold font-mono text-sky-950 min-w-[32px] text-right shrink-0">
                  {(latestData.gpu_mem_percent ?? 28.5).toFixed(0)}%
                </span>
                {/* Outer label */}
                <span className="text-[9px] font-bold text-sky-700 min-w-[28px] text-center bg-sky-100/70 px-1 rounded border border-sky-200/90 shrink-0">
                  显存
                </span>
              </div>
            </div>

          </div>

          {/* Thin ambient vertical divider */}
          <div className="w-px h-10 bg-sky-200/80 self-center shrink-0" />

          {/* Premium spinning cooling fan indicator & stack (Right side) */}
          <div className="flex-1 min-w-0 h-full flex flex-col justify-center">
            {isExtraWide ? (
              <div className="flex-1 flex gap-3 items-center min-w-0 h-[68px]">
                {/* Micro info board on left side */}
                <div className="flex flex-col gap-1 justify-center shrink-0 font-mono text-left select-none pl-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-sky-800">FAN1: <b className="text-blue-600">{(latestData.fan_speed_1 ?? 32).toFixed(0)}%</b></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-sky-800">FAN2: <b className="text-emerald-600">{(latestData.fan_speed_2 ?? 38).toFixed(0)}%</b></span>
                  </div>
                </div>
                {/* Micro mini line chart for Fan speeds */}
                <div className="flex-1 min-w-0 h-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: -26, bottom: -12 }} style={{ outline: 'none' }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2f0fe" opacity={0.6} vertical={false} />
                      <XAxis
                        dataKey="elapsed"
                        type="number"
                        domain={[-timeWindowSeconds, 0]}
                        ticks={compactTimeAxisTicks}
                        tickFormatter={(val) => val === 0 ? "现在" : `${val}s`}
                        stroke="#64748b"
                        fontSize={8}
                        tickLine={false}
                        dy={2}
                      />
                      <YAxis
                        stroke="#64748b"
                        fontSize={8}
                        tickLine={false}
                        domain={[0, 100]}
                        tickFormatter={(val) => `${val}%`}
                        dx={-2}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.98)",
                          border: "1px solid #bae6fd",
                          borderRadius: "8px",
                          fontSize: "10px",
                          color: "#0f172a",
                          outline: "none"
                        }}
                        labelFormatter={(lbl) => `偏移时间: ${lbl}s`}
                        formatter={(val: number) => [`${val.toFixed(1)}%`]}
                      />
                      <Line
                        type="linear"
                        dataKey="fan_speed_1"
                        name="FAN1"
                        stroke="#2563eb"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="linear"
                        dataKey="fan_speed_2"
                        name="FAN2"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 min-w-0 justify-start">
                <div className="relative w-[72px] h-[72px] flex items-center justify-center bg-sky-50 border border-sky-100/90 rounded-2xl shrink-0 overflow-hidden shadow-inner">
                  {/* Dynamic spinning core fan blades SVG */}
                  {(() => {
                    const avgSpeed = ((latestData.fan_speed_1 ?? 32) + (latestData.fan_speed_2 ?? 38)) / 2;
                    // Higher average speed = faster spin (shorter duration). At 100% avg, duration is 0.12s; at 0% avg, it is 5.0s.
                    const fanDuration = avgSpeed > 0 ? Math.max(0.12, 4.0 - (avgSpeed / 100) * 3.88) : 5.0;
                    return (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-14 h-14 text-blue-500 fill-blue-500/10 origin-center"
                        style={{
                          animation: `spin ${fanDuration.toFixed(3)}s linear infinite`,
                          willChange: "transform",
                          transform: "translateZ(0)"
                        }}
                      >
                        <path d="M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A2,2 0 0,1 14,6C14,7.5 12,10 12,10C12,10 10,7.5 10,6A2,2 0 0,1 12,4M6,12A2,2 0 0,1 8,10C9.5,10 12,12 12,12C12,12 9.5,14 8,14A2,2 0 0,1 6,12M12,20A2,2 0 0,1 10,18C10,16.5 12,14 12,14C12,14 14,16.5 14,18A2,2 0 0,1 12,20M18,12A2,2 0 0,1 16,14C14.5,14 12,12 12,12C12,12 14.5,10 16,10A2,2 0 0,1 18,12Z" />
                      </svg>
                    );
                  })()}
                  {/* Central hub element */}
                  <div className="absolute w-3 h-3 bg-white border border-sky-300 rounded-full" />
                </div>

                {/* Vertically stacked fan percentage indicators */}
                <div className="flex flex-col gap-1.5 justify-center font-mono leading-tight shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[9px] font-bold text-sky-700 uppercase tracking-widest bg-sky-100/70 px-1.5 py-0.5 rounded border border-sky-200/80">FAN1</span>
                    <span className="text-sm font-black text-blue-600">{(latestData.fan_speed_1 ?? 32).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[9px] font-bold text-sky-700 uppercase tracking-widest bg-sky-100/70 px-1.5 py-0.5 rounded border border-sky-200/80">FAN2</span>
                    <span className="text-sm font-black text-emerald-600">{(latestData.fan_speed_2 ?? 38).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </section>

        {/* Bottom Split Layout - 50/50 Split */}
        <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
          
          {/* Left Grid Panel - Network speed information in red-blue plots */}
          <section className="flex flex-col p-3 bg-white/70 border border-sky-100/90 rounded-2xl h-full overflow-hidden justify-between min-h-0 shadow-sm shadow-blue-50/50">
            <div className="flex justify-between items-center mb-1 px-1.5 shrink-0">
              <span className="text-[10px] uppercase font-bold text-sky-900 tracking-wider flex items-center gap-1">
                <Wifi size={11} className="text-blue-500" /> 网络流量趋势
              </span>
              <div className="flex gap-3 text-[9px] text-slate-500 font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-rose-500 inline-block" /> 
                  上传: <b className="text-rose-600">{latestData.net_sent_speed_kb >= 1024 ? `${(latestData.net_sent_speed_kb / 1024).toFixed(1)} MB/s` : `${latestData.net_sent_speed_kb.toFixed(0)} KB/s`}</b>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-blue-500 inline-block" /> 
                  下载: <b className="text-blue-600">{latestData.net_recv_speed_kb >= 1024 ? `${(latestData.net_recv_speed_kb / 1024).toFixed(1)} MB/s` : `${latestData.net_recv_speed_kb.toFixed(0)} KB/s`}</b>
                </span>
              </div>
            </div>

            {/* Recharts dynamic panel */}
            <div className="flex-1 w-full min-h-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -22, bottom: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2f0fe" opacity={0.8} vertical={false} />
                  <XAxis
                    dataKey="elapsed"
                    type="number"
                    domain={[-timeWindowSeconds, 0]}
                    ticks={timeAxisTicks}
                    tickFormatter={(val) => val === 0 ? "现在" : `${val}s`}
                    stroke="#64748b"
                    fontSize={9}
                    tickLine={false}
                    dy={4}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={9}
                    tickLine={false}
                    domain={["auto", "auto"]}
                    tickFormatter={(val) => `${val.toFixed(0)}`}
                    dx={-2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.98)",
                      border: "1px solid #bae6fd",
                      borderRadius: "8px",
                      fontSize: "11px",
                      color: "#0f172a"
                    }}
                    labelFormatter={(lbl) => `偏移时间: ${lbl} 秒`}
                    formatter={(val: number) => [`${val.toFixed(1)} KB/s`]}
                  />
                  <Line
                    type="linear"
                    dataKey="net_sent"
                    name="上传"
                    stroke="#ef4444" /* Bright Red Line - Upload */
                    strokeWidth={1.8}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="net_recv"
                    name="下载"
                    stroke="#2563eb" /* Bright Blue Line - Download */
                    strokeWidth={1.8}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Right Grid Panel - Core Temperatures (CPU vs GPU shown in red and blue curves) */}
          <section className="flex flex-col p-3 bg-white/70 border border-sky-100/90 rounded-2xl h-full overflow-hidden justify-between min-h-0 shadow-sm shadow-blue-50/50">
            <div className="flex justify-between items-center mb-1 px-1.5 shrink-0">
              <span className="text-[10px] uppercase font-bold text-sky-900 tracking-wider flex items-center gap-1.5">
                <Activity size={11} className="text-rose-500" /> 核心芯片温度趋势
              </span>
              <div className="flex gap-3 text-[9px] text-slate-500 font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-rose-500 inline-block" /> 
                  CPU温度: <b className="text-rose-600">{(latestData.cpu_temp ?? 42).toFixed(0)}°C</b>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-blue-500 inline-block" /> 
                  GPU温度: <b className="text-blue-600">{(latestData.gpu_temp ?? 45).toFixed(0)}°C</b>
                </span>
              </div>
            </div>

            {/* Recharts temperature curves panel */}
            <div className="flex-1 w-full min-h-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -22, bottom: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2f0fe" opacity={0.8} vertical={false} />
                  <XAxis
                    dataKey="elapsed"
                    type="number"
                    domain={[-timeWindowSeconds, 0]}
                    ticks={timeAxisTicks}
                    tickFormatter={(val) => val === 0 ? "现在" : `${val}s`}
                    stroke="#64748b"
                    fontSize={9}
                    tickLine={false}
                    dy={4}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={9}
                    tickLine={false}
                    domain={["auto", "auto"]}
                    tickFormatter={(val) => `${val.toFixed(0)}°C`}
                    dx={-2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.98)",
                      border: "1px solid #bae6fd",
                      borderRadius: "8px",
                      fontSize: "11px",
                      color: "#0f172a"
                    }}
                    labelFormatter={(lbl) => `偏移时间: ${lbl} 秒`}
                    formatter={(val: number) => [`${val.toFixed(1)} °C`]}
                  />
                  <Line
                    type="linear"
                    dataKey="cpu_temp"
                    name="CPU温度"
                    stroke="#ef4444" /* Red - CPU Temperature */
                    strokeWidth={1.8}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="gpu_temp"
                    name="GPU温度"
                    stroke="#2563eb" /* Blue - GPU Temperature */
                    strokeWidth={1.8}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

        </div>

        {/* Extra Wide Telemetry Grid - Only loaded when viewport matches high-width resolutions layout */}
        {isExtraWide && (
          <div className="grid grid-cols-2 gap-3 shrink-0 pt-0.5 pb-2">
            
            {/* 1. CPU & GPU Utilization Percentage Plot */}
            <section className="flex flex-col p-3 bg-white/70 border border-sky-100/90 rounded-2xl overflow-hidden justify-between shadow-sm shadow-blue-50/50 aspect-[2.3/1]">
              <div className="flex justify-between items-center mb-1.5 px-1.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-sky-900 tracking-wider flex items-center gap-1.5">
                  <Activity size={11} className="text-blue-500" /> CPU & GPU 负载率趋势
                </span>
                <div className="flex gap-3 text-[9px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-0.5 bg-blue-600 inline-block" /> 
                    CPU: <b className="text-blue-605">{latestData.cpu_percent.toFixed(0)}%</b>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-0.5 bg-emerald-500 inline-block" /> 
                    GPU: <b className="text-emerald-600">{(latestData.gpu_percent ?? 0).toFixed(0)}%</b>
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full min-h-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -22, bottom: -12 }} style={{ outline: 'none' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2f0fe" opacity={0.8} vertical={false} />
                    <XAxis
                      dataKey="elapsed"
                      type="number"
                      domain={[-timeWindowSeconds, 0]}
                      ticks={timeAxisTicks}
                      tickFormatter={(val) => val === 0 ? "现在" : `${val}s`}
                      stroke="#64748b"
                      fontSize={9}
                      tickLine={false}
                      dy={4}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={9}
                      tickLine={false}
                      domain={[0, 100]}
                      tickFormatter={(val) => `${val}%`}
                      dx={-2}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.98)",
                        border: "1px solid #bae6fd",
                        borderRadius: "8px",
                        fontSize: "11px",
                        color: "#0f172a",
                        outline: "none"
                      }}
                      labelFormatter={(lbl) => `偏移时间: ${lbl} 秒`}
                      formatter={(val: number) => [`${val.toFixed(1)}%`]}
                    />
                    <Line
                      type="linear"
                      dataKey="cpu_percent"
                      name="CPU 负载"
                      stroke="#2563eb"
                      strokeWidth={1.8}
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="linear"
                      dataKey="gpu_percent"
                      name="GPU 负载"
                      stroke="#10b981"
                      strokeWidth={1.8}
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* 2. Combined RAM & VRAM Percentage Plot */}
            <section className="flex flex-col p-3 bg-white/70 border border-sky-100/90 rounded-2xl overflow-hidden justify-between shadow-sm shadow-blue-50/50 aspect-[2.3/1]">
              <div className="flex justify-between items-center mb-1.5 px-1.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-sky-900 tracking-wider flex items-center gap-1.5">
                  <Database size={11} className="text-indigo-500" /> RAM & 显存 (VRAM) 占用率趋势
                </span>
                <div className="flex gap-3 text-[9px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-0.5 bg-indigo-500 inline-block" /> 
                    RAM: <b className="text-indigo-600">{latestData.ram_percent.toFixed(1)}%</b>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-0.5 bg-teal-500 inline-block" /> 
                    VRAM: <b className="text-teal-600">{(latestData.gpu_mem_percent ?? 0).toFixed(1)}%</b>
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full min-h-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -22, bottom: -12 }} style={{ outline: 'none' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2f0fe" opacity={0.8} vertical={false} />
                    <XAxis
                      dataKey="elapsed"
                      type="number"
                      domain={[-timeWindowSeconds, 0]}
                      ticks={timeAxisTicks}
                      tickFormatter={(val) => val === 0 ? "现在" : `${val}s`}
                      stroke="#64748b"
                      fontSize={9}
                      tickLine={false}
                      dy={4}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={9}
                      tickLine={false}
                      domain={[0, 100]}
                      tickFormatter={(val) => `${val}%`}
                      dx={-2}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.98)",
                        border: "1px solid #bae6fd",
                        borderRadius: "8px",
                        fontSize: "11px",
                        color: "#0f172a",
                        outline: "none"
                      }}
                      labelFormatter={(lbl) => `偏移时间: ${lbl} 秒`}
                      formatter={(val: number) => [`${val.toFixed(1)}%`]}
                    />
                    <Line
                      type="linear"
                      dataKey="ram_percent"
                      name="RAM"
                      stroke="#6366f1"
                      strokeWidth={1.8}
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="linear"
                      dataKey="gpu_mem_percent"
                      name="VRAM"
                      stroke="#14b8a6"
                      strokeWidth={1.8}
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

          </div>
        )}
      </main>

      {/* Extreme Minimal Settings Panel Overlay Dialog */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            key="config-dialog-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white border border-sky-100 w-full max-w-sm rounded-2xl p-4 shadow-2xl relative space-y-4 text-slate-800"
            >
              {/* Modal header */}
              <div className="flex justify-between items-center pb-2 border-b border-sky-100">
                <span className="font-bold text-xs text-sky-950 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  <Database size={13} className="text-blue-600" />
                  遥测数据链路配置
                </span>
                <button
                  onClick={() => setShowConfig(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Sampling rate custom slider container */}
              <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-100">
                <RotarySelector value={sampleInterval} onChange={setSampleInterval} />
              </div>

              {/* URL Address */}
              <div className="space-y-1.5 font-sans">
                <label className="text-[9px] text-sky-800 font-bold uppercase tracking-wider block">WebSocket 接收目标地址</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={wsUrl}
                    onChange={(e) => setWsUrl(e.target.value)}
                    placeholder="ws://localhost:8765"
                    className="flex-1 min-w-0 bg-sky-50/50 border border-sky-200 px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {isRealModeIntent ? (
                    <button
                      onClick={disconnectDevice}
                      className="px-2.5 py-1.5 bg-rose-600/10 text-rose-600 border border-rose-200 hover:bg-rose-600 hover:text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors text-center shrink-0 min-w-[50px]"
                    >
                      断开
                    </button>
                  ) : (
                    <button
                      onClick={connectDevice}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shrink-0"
                    >
                      连接
                    </button>
                  )}
                </div>
              </div>

              {/* Simulator / Raw triggers */}
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  onClick={startSimulation}
                  className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                    status === "SIMULATING"
                      ? "bg-blue-600 border-blue-600 text-white font-bold"
                      : "bg-sky-50 border-sky-100 text-sky-800 hover:bg-sky-100/75"
                  }`}
                >
                  <Activity size={12} /> 仿真数据模型
                </button>
                <button
                  onClick={isRealModeIntent ? disconnectDevice : connectDevice}
                  className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                    status === "CONNECTED"
                      ? "bg-emerald-600 border-emerald-600 text-white font-bold"
                      : status === "CONNECTING"
                      ? "bg-amber-500 border-amber-600 text-white"
                      : "bg-sky-50 border-sky-100 text-sky-800 hover:bg-sky-100/75"
                  }`}
                >
                  {status === "CONNECTED" ? (
                    <>
                      <CheckCircle2 size={12} /> 真机工作中
                    </>
                  ) : status === "CONNECTING" ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" /> 连接中...
                    </>
                  ) : (
                    <>
                      <Play size={12} /> 物理端链路
                    </>
                  )}
                </button>
              </div>

              {/* Close footer */}
              <div className="flex justify-end pt-2 border-t border-sky-100">
                <button
                  onClick={() => setShowConfig(false)}
                  className="px-3.5 py-1 bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
