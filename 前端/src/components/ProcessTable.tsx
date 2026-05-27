import { useState, useMemo } from "react";
import { ProcessInfo } from "../types";
import { Search, Cpu, HardDrive, Activity } from "lucide-react";

interface ProcessTableProps {
  processes: ProcessInfo[];
}

export default function ProcessTable({ processes }: ProcessTableProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"cpu" | "memory">("cpu");

  // Filter and Sort processes
  const processedList = useMemo(() => {
    let filtered = processes.filter(
      (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.pid.toString().includes(search)
    );

    return filtered.sort((a, b) => {
      if (sortBy === "cpu") {
        return b.cpu_percent - a.cpu_percent;
      } else {
        return b.memory_percent - a.memory_percent;
      }
    });
  }, [processes, search, sortBy]);

  return (
    <div className="border border-blue-100 bg-white rounded-[28px] overflow-hidden shadow-sm">
      {/* Table Header Section */}
      <div className="p-6 bg-white border-b border-blue-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-blue-50 text-blue-600">
              <Activity size={14} className="animate-pulse" />
            </span>
            <h3 className="text-xs font-bold tracking-[0.2em] uppercase text-blue-500">
              活动进程监视器 // 活动系统负载进程
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-serif italic pl-8">
            物理终端当前正在处理的操作系统后台应用进程指标及调度顺位。
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 pl-8 sm:pl-0">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="通过 PID / 进程名称搜索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-48 pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
            />
            <Search size={12} className="absolute left-3 top-2.5 text-slate-400" />
          </div>

          {/* Sort Toggles */}
          <div className="flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200 col-span-1">
            <button
              onClick={() => setSortBy("cpu")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-mono transition-all ${
                sortBy === "cpu"
                  ? "bg-white text-blue-600 border border-slate-200 shadow-sm font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Cpu size={11} /> CPU 占比排序
            </button>
            <button
              onClick={() => setSortBy("memory")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-mono transition-all ${
                sortBy === "memory"
                  ? "bg-white text-blue-600 border border-slate-200 shadow-sm font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <HardDrive size={11} /> 内存占比排序
            </button>
          </div>
        </div>
      </div>

      {/* Grid columns titles */}
      <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-slate-50/60 border-b border-blue-50 text-[10px] font-sans text-slate-400 uppercase tracking-widest">
        <span className="col-span-2">进程 PID</span>
        <span className="col-span-4">进程实例名称</span>
        <span className="col-span-3 text-right font-sans">CPU 占用率</span>
        <span className="col-span-3 text-right font-sans">实际内存进驻</span>
      </div>

      {/* Table Rows Body */}
      <div className="max-h-72 overflow-y-auto divide-y divide-blue-50/40">
        {processedList.length > 0 ? (
          processedList.map((proc, index) => (
            <div
              key={`${proc.pid}-${index}`}
              className="grid grid-cols-12 gap-2 px-6 py-3 hover:bg-sky-50/20 transition-colors text-xs items-center"
            >
              <span className="col-span-2 text-slate-400 font-mono">#{proc.pid}</span>
              <span className="col-span-4 text-slate-800 font-medium truncate hover:text-blue-600" title={proc.name}>
                {proc.name}
              </span>

              {/* CPU load rating */}
              <div className="col-span-3 flex flex-col items-end gap-1.5">
                <span className={`font-mono font-bold ${proc.cpu_percent > 30 ? "text-amber-500" : proc.cpu_percent > 70 ? "text-rose-500" : "text-blue-600"}`}>
                  {proc.cpu_percent.toFixed(1)}%
                </span>
                <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500/80"
                    style={{ width: `${Math.min(100, proc.cpu_percent)}%` }}
                  />
                </div>
              </div>

              {/* Memory Usage column */}
              <div className="col-span-3 flex flex-col items-end gap-0.5">
                <span className="text-slate-700 font-semibold font-mono">{proc.memory_used_mb.toFixed(0)} MB</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {proc.memory_percent.toFixed(1)}%
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <span className="text-2xl opacity-60">📭</span>
            <span className="text-xs font-serif italic">未匹配到任何符合条件的活动系统进程。</span>
          </div>
        )}
      </div>
    </div>
  );
}
