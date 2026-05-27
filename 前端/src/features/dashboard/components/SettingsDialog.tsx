import { Activity, CheckCircle2, Database, Play, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Dispatch, SetStateAction } from "react";
import { ConnectionStatus } from "../../../types";
import RotarySelector from "../../../components/RotarySelector";
import {
  DashboardComponentConfig,
  DashboardComponentId,
  DashboardMetricKey,
  dashboardMetricOptions
} from "../constants";

interface SettingsDialogProps {
  open: boolean;
  wsUrl: string;
  setWsUrl: Dispatch<SetStateAction<string>>;
  sampleInterval: number;
  setSampleInterval: Dispatch<SetStateAction<number>>;
  isRealModeIntent: boolean;
  status: ConnectionStatus;
  onClose: () => void;
  connectDevice: () => void;
  disconnectDevice: () => void;
  startSimulation: () => void;
  componentConfig: DashboardComponentConfig;
  updateComponentMetric: (componentId: DashboardComponentId, metric: DashboardMetricKey) => void;
  resetComponentConfig: () => void;
}

const componentConfigGroups: Array<{
  title: string;
  items: Array<{ id: DashboardComponentId; label: string }>;
}> = [
  {
    title: "顶部硬件区",
    items: [
      { id: "primaryGaugeLeft", label: "左侧环形图" },
      { id: "primaryGaugeRight", label: "右侧环形图" },
      { id: "progressTop", label: "上方条形进度" },
      { id: "progressBottom", label: "下方条形进度" },
      { id: "fanCompactLeft", label: "风扇信息 1 / 折线 1" },
      { id: "fanCompactRight", label: "风扇信息 2 / 折线 2" }
    ]
  },
  {
    title: "主图表区",
    items: [
      { id: "networkChartLeft", label: "左侧图表曲线 1" },
      { id: "networkChartRight", label: "左侧图表曲线 2" },
      { id: "temperatureChartLeft", label: "右侧图表曲线 1" },
      { id: "temperatureChartRight", label: "右侧图表曲线 2" }
    ]
  },
  {
    title: "宽屏扩展区",
    items: [
      { id: "loadChartLeft", label: "负载图表曲线 1" },
      { id: "loadChartRight", label: "负载图表曲线 2" },
      { id: "memoryChartLeft", label: "内存图表曲线 1" },
      { id: "memoryChartRight", label: "内存图表曲线 2" }
    ]
  }
];

const selectableMetrics = Object.values(dashboardMetricOptions);

export function SettingsDialog({
  open,
  wsUrl,
  setWsUrl,
  sampleInterval,
  setSampleInterval,
  isRealModeIntent,
  status,
  onClose,
  connectDevice,
  disconnectDevice,
  startSimulation,
  componentConfig,
  updateComponentMetric,
  resetComponentConfig
}: SettingsDialogProps) {
  return (
    <AnimatePresence>
      {open && (
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
            className="bg-white border border-sky-100 w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl p-4 shadow-2xl relative space-y-4 text-slate-800"
          >
            <div className="flex justify-between items-center pb-2 border-b border-sky-100">
              <span className="font-bold text-xs text-sky-950 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <Database size={13} className="text-blue-600" />
                遥测数据链路配置
              </span>
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-100">
              <RotarySelector value={sampleInterval} onChange={setSampleInterval} />
            </div>

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

            <div className="space-y-2 font-sans border-t border-sky-100 pt-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] text-sky-950 font-black uppercase tracking-wider">自定义组件数据</div>
                  <p className="text-[9px] text-slate-500 mt-0.5">只改变每个固定组件展示的数据；系统会合并重复需求并自动向后端订阅必要类别。</p>
                </div>
                <button
                  onClick={resetComponentConfig}
                  className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-100 text-[10px] font-semibold rounded-lg cursor-pointer transition-colors shrink-0"
                >
                  恢复默认
                </button>
              </div>

              {componentConfigGroups.map((group) => (
                <div key={group.title} className="bg-sky-50/70 border border-sky-100 rounded-xl p-2.5 space-y-2">
                  <div className="text-[9px] font-bold text-sky-800 uppercase tracking-wider">{group.title}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.items.map((item) => (
                      <label key={item.id} className="space-y-1">
                        <span className="text-[9px] text-slate-500 font-bold">{item.label}</span>
                        <select
                          value={componentConfig[item.id].metric}
                          onChange={(e) => updateComponentMetric(item.id, e.target.value as DashboardMetricKey)}
                          className="w-full bg-white border border-sky-200 px-2 py-1.5 rounded-lg text-[11px] font-mono text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                        >
                          {selectableMetrics.map((metric) => (
                            <option key={metric.key} value={metric.key}>
                              {metric.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-sky-100">
              <button
                onClick={onClose}
                className="px-3.5 py-1 bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                关闭
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
