import React from 'react';

interface GradeRecord {
  score: number;
  total: number;
  date: string;
}

interface GradeSparklineProps {
  grades: GradeRecord[];
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
}

export const GradeSparkline: React.FC<GradeSparklineProps> = ({
  grades,
  width = 240,
  height = 60,
  strokeColor = '#a855f7', // purple-500
  fillColor = 'url(#purple-gradient)',
}) => {
  if (grades.length < 2) {
    return (
      <div className="text-[10px] text-gray-500 font-bold py-2">
        يحتاج على الأقل درجتين لعرض المنحنى البياني
      </div>
    );
  }

  // Convert grades to percentage values
  const points = grades.map((g) => (g.score / (g.total || 10)) * 100);

  const padding = 5;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Find Min & Max for scaling
  const maxVal = 100;
  const minVal = 0;
  const valRange = maxVal - minVal;

  // Map to X, Y coordinates
  const coordinates = points.map((val, idx) => {
    const x = padding + (idx / (points.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((val - minVal) / valRange) * chartHeight;
    return { x, y };
  });

  // Build the SVG path string for the line
  const linePath = coordinates.reduce((path, p, idx) => {
    return path + `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }, '');

  // Build the closed path string for the filled area underneath
  const areaPath =
    linePath +
    ` L ${coordinates[coordinates.length - 1].x.toFixed(1)} ${(height - padding).toFixed(
      1
    )} L ${coordinates[0].x.toFixed(1)} ${(height - padding).toFixed(1)} Z`;

  return (
    <div className="flex flex-col gap-2">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id="purple-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid guide lines */}
        <line x1={0} y1={padding} x2={width} y2={padding} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
        <line
          x1={0}
          y1={padding + chartHeight / 2}
          x2={width}
          y2={padding + chartHeight / 2}
          stroke="rgba(255,255,255,0.03)"
          strokeWidth={1}
        />
        <line
          x1={0}
          y1={padding + chartHeight}
          x2={width}
          y2={padding + chartHeight}
          stroke="rgba(255,255,255,0.03)"
          strokeWidth={1}
        />

        {/* Filled area gradient */}
        <path d={areaPath} fill={fillColor} />

        {/* Line chart path */}
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Interactive dots */}
        {coordinates.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={3}
            className="fill-slate-950 hover:r-4 transition-all cursor-pointer"
            stroke={strokeColor}
            strokeWidth={1.5}
          />
        ))}
      </svg>
      
      {/* Mini Stats footer */}
      <div className="flex justify-between text-[9px] text-gray-500 font-bold" style={{ width }}>
        <span>البداية: {points[0].toFixed(0)}%</span>
        <span>الأحدث: {points[points.length - 1].toFixed(0)}%</span>
      </div>
    </div>
  );
};
