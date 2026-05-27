import { Maximize, Minimize, Settings } from "lucide-react";

interface HeaderControlsProps {
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onToggleConfig: () => void;
}

export function HeaderControls({ isFullScreen, onToggleFullScreen, onToggleConfig }: HeaderControlsProps) {
  return (
    <div className="absolute top-2 right-2 flex items-center gap-1.5 z-30">
      <button
        onClick={onToggleFullScreen}
        className="p-1.5 bg-white/80 hover:bg-white border border-sky-200/60 rounded-lg text-sky-600 hover:text-sky-800 shadow-sm transition-all cursor-pointer flex items-center justify-center"
        title={isFullScreen ? "退出全屏" : "全屏显示"}
        style={{ width: "26px", height: "26px" }}
      >
        {isFullScreen ? <Minimize size={12} /> : <Maximize size={12} />}
      </button>
      <button
        onClick={onToggleConfig}
        className="p-1.5 bg-white/80 hover:bg-white border border-sky-200/60 rounded-lg text-sky-600 hover:text-sky-800 shadow-sm transition-all cursor-pointer flex items-center justify-center"
        title="配置频率与数据源"
        style={{ width: "26px", height: "26px" }}
      >
        <Settings size={12} className="hover:rotate-45 transition-transform duration-300" />
      </button>
    </div>
  );
}
