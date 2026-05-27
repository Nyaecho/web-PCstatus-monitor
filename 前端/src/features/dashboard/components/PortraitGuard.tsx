interface PortraitGuardProps {
  onContinue: () => void;
}

export function PortraitGuard({ onContinue }: PortraitGuardProps) {
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
            onClick={onContinue}
            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer"
          >
            仍要继续浏览 (保持竖屏)
          </button>
        </div>
      </div>
    </div>
  );
}
