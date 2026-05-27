import { Clock } from "lucide-react";

interface RotarySelectorProps {
  value: number;
  onChange: (value: number) => void;
}

export default function RotarySelector({ value, onChange }: RotarySelectorProps) {
  const options = [0.5, 1, 3];
  const displayValue = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);

  return (
    <div className="w-full flex flex-col gap-2 py-0.5 select-none">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-sky-800 font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={11} className="text-blue-500" />
          物理刷新间隔
        </span>
        <div className="flex items-baseline gap-0.5 font-mono">
          <span className="text-sm font-black text-blue-600">
            {displayValue}
          </span>
          <span className="text-[9px] text-slate-500 font-bold">
            秒
          </span>
        </div>
      </div>
      
      {/* Preset selectors */}
      <div className="grid grid-cols-3 gap-1">
        {options.map((option) => {
          const isActive = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option)}
              className={`py-1.5 rounded-lg border text-[10px] font-bold font-mono transition-all ${
                isActive
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white/80 border-sky-200 text-sky-700 hover:bg-sky-50"
              }`}
            >
              {(option % 1 === 0 ? option.toFixed(0) : option.toFixed(1))}s
            </button>
          );
        })}
      </div>
    </div>
  );
}
