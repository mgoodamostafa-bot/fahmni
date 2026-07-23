import React from 'react';
import { Calendar, Building, Users, Play } from 'lucide-react';
import { Center, Group } from '../../hooks/useCenterData';

interface CenterFilterBarProps {
  centers: Center[];
  groups: Group[];
  selectedCenterId: string;
  selectedGroupId: string;
  selectedDate?: string;
  onCenterChange: (id: string) => void;
  onGroupChange: (id: string) => void;
  onDateChange?: (date: string) => void;
  onLoadData: () => void;
  loading?: boolean;
  accentColor?: string; // e.g., 'emerald-500', 'purple-500', 'pink-500'
}

export const CenterFilterBar: React.FC<CenterFilterBarProps> = ({
  centers,
  groups,
  selectedCenterId,
  selectedGroupId,
  selectedDate,
  onCenterChange,
  onGroupChange,
  onDateChange,
  onLoadData,
  loading = false,
  accentColor = 'emerald-500',
}) => {
  const filteredGroups = groups.filter((g) => g.centerId === selectedCenterId);

  return (
    <div className="bg-white/[0.02] border border-white/5 p-5 rounded-3xl backdrop-blur-md shadow-xl flex flex-col md:flex-row gap-4 items-end">
      {/* Center Select */}
      <div className="w-full space-y-2">
        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
          <Building size={12} className={`text-${accentColor}`} />
          <span>اختر الفرع (السنتر)</span>
        </label>
        <select
          value={selectedCenterId}
          onChange={(e) => {
            onCenterChange(e.target.value);
            onGroupChange(''); // Reset group
          }}
          className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl focus:border-white/20 text-xs text-white focus:outline-none transition-all cursor-pointer font-bold"
        >
          <option value="" className="bg-[#0b0f19] text-gray-400">--- اختر السنتر ---</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id} className="bg-[#0b0f19] text-white">
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Group Select */}
      <div className="w-full space-y-2">
        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
          <Users size={12} className={`text-${accentColor}`} />
          <span>اختر مجموعة العمل</span>
        </label>
        <select
          value={selectedGroupId}
          onChange={(e) => onGroupChange(e.target.value)}
          disabled={!selectedCenterId}
          className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl focus:border-white/20 text-xs text-white focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-bold"
        >
          <option value="" className="bg-[#0b0f19] text-gray-400">--- اختر المجموعة ---</option>
          {filteredGroups.map((g) => (
            <option key={g.id} value={g.id} className="bg-[#0b0f19] text-white">
              {g.name} ({g.day} - {g.time})
            </option>
          ))}
        </select>
      </div>

      {/* Optional Date Selection */}
      {onDateChange !== undefined && selectedDate !== undefined && (
        <div className="w-full space-y-2">
          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Calendar size={12} className={`text-${accentColor}`} />
            <span>تاريخ الحصة</span>
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-white/20 text-xs text-white focus:outline-none transition-all cursor-pointer font-bold"
          />
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={onLoadData}
        disabled={!selectedCenterId || !selectedGroupId || loading}
        className={`px-6 py-2.5 rounded-xl bg-gradient-to-r from-${accentColor} to-white/10 text-slate-950 hover:opacity-90 font-black text-xs transition-all flex items-center justify-center gap-2 w-full md:w-auto shrink-0 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Play size={14} className="fill-current" />
        )}
        <span>عرض السجل</span>
      </button>
    </div>
  );
};
