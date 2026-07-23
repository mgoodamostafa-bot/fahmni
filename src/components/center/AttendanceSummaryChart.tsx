import React from 'react';

interface AttendanceSummaryChartProps {
  presentCount: number;
  absentCount: number;
  excusedCount: number;
}

export const AttendanceSummaryChart: React.FC<AttendanceSummaryChartProps> = ({
  presentCount,
  absentCount,
  excusedCount,
}) => {
  const total = presentCount + absentCount + excusedCount;
  
  if (total === 0) {
    return (
      <div className="text-center text-xs text-gray-500 font-bold p-6">
        لا توجد بيانات حضور مسجلة لعرضها
      </div>
    );
  }

  // Calculate percentages
  const presentPct = (presentCount / total) * 100;
  const absentPct = (absentCount / total) * 100;
  const excusedPct = (excusedCount / total) * 100;

  // SVG parameters
  const size = 120;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius; // ~333

  // Calculate offsets
  const presentOffset = circumference - (presentPct / 100) * circumference;
  const absentOffset = circumference - (absentPct / 100) * circumference;
  const excusedOffset = circumference - (excusedPct / 100) * circumference;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 p-4">
      {/* Circle Chart */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Base circle background */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth={strokeWidth}
          />
          {/* Present segment */}
          {presentPct > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#10b981" // emerald-500
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={presentOffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          )}
          {/* Absent segment */}
          {absentPct > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#ef4444" // red-500
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={absentOffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{
                transform: `rotate(${(presentPct / 100) * 360}deg)`,
                transformOrigin: '50% 50%',
              }}
            />
          )}
          {/* Excused segment */}
          {excusedPct > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#f59e0b" // amber-500
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={excusedOffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{
                transform: `rotate(${((presentPct + absentPct) / 100) * 360}deg)`,
                transformOrigin: '50% 50%',
              }}
            />
          )}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-gray-500 font-bold uppercase">النسبة</span>
          <span className="text-sm font-black text-white">{presentPct.toFixed(0)}%</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-2 text-right w-full">
        <div className="flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block" />
            <span className="text-gray-400">حاضر</span>
          </div>
          <span className="text-white">{presentCount} طالب ({presentPct.toFixed(0)}%)</span>
        </div>
        
        <div className="flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 block" />
            <span className="text-gray-400">غائب</span>
          </div>
          <span className="text-white">{absentCount} طالب ({absentPct.toFixed(0)}%)</span>
        </div>

        <div className="flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block" />
            <span className="text-gray-400">مستثنى</span>
          </div>
          <span className="text-white">{excusedCount} طالب ({excusedPct.toFixed(0)}%)</span>
        </div>
      </div>
    </div>
  );
};
