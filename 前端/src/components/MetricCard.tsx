import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  icon: LucideIcon;
  value: string | number;
  suffix?: string;
  percentage?: number;
  subtext: string;
  history?: number[];
  color?: "cyan" | "blue" | "indigo" | "danger" | "warning";
  isContrast?: boolean;
}

export default function MetricCard({
  title,
  icon: Icon,
  value,
  suffix = "",
  percentage,
  subtext,
  history = [],
  color = "cyan",
  isContrast = false
}: MetricCardProps) {
  // Editorial light and contrast presets
  const colorMap = {
    cyan: {
      border: "border-sky-100",
      text: "text-sky-600",
      svgStroke: "#0284c7",
      progressBg: "bg-sky-100",
      progressBar: "bg-sky-500"
    },
    blue: {
      border: "border-blue-100",
      text: "text-blue-600",
      svgStroke: "#2563eb",
      progressBg: "bg-blue-100",
      progressBar: "bg-blue-600"
    },
    indigo: {
      border: "border-indigo-100",
      text: "text-indigo-600",
      svgStroke: "#4f46e5",
      progressBg: "bg-indigo-100",
      progressBar: "bg-indigo-600"
    },
    warning: {
      border: "border-amber-100",
      text: "text-amber-600",
      svgStroke: "#d97706",
      progressBg: "bg-amber-100",
      progressBar: "bg-amber-600"
    },
    danger: {
      border: "border-rose-100",
      text: "text-rose-600",
      svgStroke: "#e11d48",
      progressBg: "bg-rose-100",
      progressBar: "bg-rose-500"
    }
  };

  const currentStyles = colorMap[color] || colorMap.cyan;

  // Sparkline Generator for editorial light mode style
  const renderSparkline = () => {
    if (history.length < 2) return null;
    const width = 140;
    const height = 45;
    const maxVal = Math.max(...history, 10);
    const minVal = Math.min(...history, 0);
    const range = maxVal - minVal || 1;

    const points = history.map((val, idx) => {
      const x = (idx / (history.length - 1)) * width;
      const y = height - ((val - minVal) / range) * (height - 6) - 3;
      return `${x},${y}`;
    });

    const pathD = `M ${points.join(" L ")}`;
    const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

    const activeStroke = isContrast ? "#38bdf8" : currentStyles.svgStroke;

    return (
      <svg width={width} height={height} className="opacity-95 mt-1 select-none">
        <defs>
          <linearGradient id={`grad-${title.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={activeStroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={activeStroke} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#grad-${title.replace(/\s+/g, "-")})`} />
        <path d={pathD} fill="none" stroke={activeStroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <div
      className={`relative p-6 rounded-[28px] overflow-hidden flex flex-col justify-between h-48 transition-all duration-300 ${
        isContrast
          ? "bg-[#1E293B] text-white shadow-lg shadow-slate-950/10 border border-slate-800 hover:border-slate-700 hover:shadow-xl"
          : "bg-white text-slate-800 border border-blue-100 shadow-sm hover:border-blue-200 hover:shadow-md"
      }`}
    >
      {/* Decorative top right editorial accent */}
      <div className={`absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl ${
        isContrast ? "from-blue-500/10" : "from-blue-50/40"
      } rounded-bl-full pointer-events-none`} />

      <div className="flex justify-between items-start z-10">
        <div className="space-y-1">
          <span className={`text-[10px] font-bold uppercase tracking-[0.18em] block ${
            isContrast ? "text-blue-300" : "text-blue-500"
          }`}>
            {title}
          </span>
          <div className="flex items-baseline gap-1">
            <span className={`text-4xl font-light tracking-tight ${
              isContrast ? "text-slate-100" : "text-slate-900"
            }`}>
              {typeof value === "number" ? value.toFixed(1) : value}
            </span>
            <span className={`text-sm font-mono opacity-80 ${isContrast ? "text-blue-300" : "text-blue-600"}`}>
              {suffix}
            </span>
          </div>
        </div>
        <div className={`p-2.5 rounded-2xl ${
          isContrast ? "bg-slate-800 text-blue-400" : "bg-blue-50 text-blue-600"
        }`}>
          <Icon size={18} />
        </div>
      </div>

      <div className="flex justify-between items-end mt-4 z-10 w-full">
        <div className="space-y-2 max-w-[50%] flex-1">
          {percentage !== undefined && (
            <div className={`w-full h-1 rounded-full overflow-hidden ${
              isContrast ? "bg-white/10" : "bg-slate-100"
            }`}>
              <div
                className={`h-full transition-all duration-300 ${
                  isContrast ? "bg-blue-400" : currentStyles.progressBar
                }`}
                style={{ width: `${Math.min(100, percentage)}%` }}
              />
            </div>
          )}
          <span className={`text-xs block truncate ${
            isContrast ? "text-slate-300 font-serif italic" : "text-slate-400 font-serif italic"
          }`} title={subtext}>
            {subtext}
          </span>
        </div>
        <div className="flex flex-col items-end shrink-0 pl-3">
          {renderSparkline()}
        </div>
      </div>
    </div>
  );
}
