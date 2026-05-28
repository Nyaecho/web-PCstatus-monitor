interface ArcGaugeProps {
  value: number;
  label: string;
  color: string;
  displayValue?: number;
  progressValue?: number;
  unit?: string;
  sizeClassName?: string;
}

export default function ArcGauge({ value, label, color, displayValue, progressValue, unit = "%", sizeClassName = "w-24 h-24" }: ArcGaugeProps) {
  const radius = 35;
  const circumference = 2 * Math.PI * radius; // 226.19
  const arcDegree = 240;
  const maxStroke = (arcDegree / 360) * circumference; // 150.8
  const strokeProgress = (Math.max(0, Math.min(100, progressValue ?? value)) / 100) * maxStroke;
  const shownValue = displayValue ?? value;

  return (
    <div className="flex flex-col items-center justify-center select-none p-1 relative">
      <div className={`relative ${sizeClassName} flex items-center justify-center`}>
        {/* SVG Container (standard clockwise drawing starting at 150deg bottom-right and ending at bottom-left, thus sweeping right-to-left) */}
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Track background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#bae6fd" /* Soft light-blue track */
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${maxStroke} ${circumference}`}
            transform="rotate(150 50 50)" /* Perfect symmetrical center gap pointing down */
            className="opacity-50"
          />

          {/* Glowing main circular progress bar */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="7.5"
            strokeLinecap="round"
            strokeDasharray={`${strokeProgress} ${circumference}`}
            transform="rotate(150 50 50)"
            className="transition-all duration-705 ease-out"
          />
        </svg>

        {/* Floating Core Indicator Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
          <span className="text-base font-bold font-mono tracking-tighter text-slate-800">
            {shownValue.toFixed(1)}
            <span className="text-[10px] font-sans font-normal text-slate-500 ml-0.5">{unit}</span>
          </span>
          <span className="text-[9px] uppercase font-bold text-sky-700 tracking-wider mt-0.5">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
