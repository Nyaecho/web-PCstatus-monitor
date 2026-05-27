import { Settings, Wifi, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ConnectionStatus } from "../../../types";

interface OfflineOverlayProps {
  isRealModeIntent: boolean;
  status: ConnectionStatus;
  wsUrl: string;
}

export function OfflineOverlay({ isRealModeIntent, status, wsUrl }: OfflineOverlayProps) {
  return (
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
            提示：可点击右上角 <Settings size={10} className="inline mx-0.5 animate-spin" style={{ animationDuration: "4s" }} /> 设置图标修改配置或切回仿真模式
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
