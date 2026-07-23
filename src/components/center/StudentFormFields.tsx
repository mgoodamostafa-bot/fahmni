import React from 'react';
import { Center, Group } from '../../hooks/useCenterData';

interface StudentFormFieldsProps {
  formData: {
    displayName: string;
    studentPhone: string;
    fatherPhone: string;
    motherPhone: string;
    schoolName: string;
    grade: string;
    centerId: string;
    groupId: string;
  };
  onChange: (field: string, value: string) => void;
  centers: Center[];
  groups: Group[];
  disabled?: boolean;
}

export const StudentFormFields: React.FC<StudentFormFieldsProps> = ({
  formData,
  onChange,
  centers,
  groups,
  disabled = false,
}) => {
  const filteredGroups = groups.filter((g) => g.centerId === formData.centerId);

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">اسم الطالب رباعي *</label>
        <input
          type="text"
          value={formData.displayName}
          onChange={(e) => onChange('displayName', e.target.value)}
          required
          disabled={disabled}
          placeholder="محمد احمد محمود علي..."
          className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-amber-500/30 text-xs text-white focus:outline-none transition-all font-bold disabled:opacity-50"
        />
      </div>

      {/* Grid for phones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">رقم هاتف الطالب</label>
          <input
            type="text"
            value={formData.studentPhone}
            onChange={(e) => onChange('studentPhone', e.target.value)}
            disabled={disabled}
            placeholder="01012345678"
            className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl focus:border-amber-500/30 text-xs text-white focus:outline-none transition-all font-bold disabled:opacity-50"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">رقم هاتف الأب *</label>
          <input
            type="text"
            value={formData.fatherPhone}
            onChange={(e) => onChange('fatherPhone', e.target.value)}
            required
            disabled={disabled}
            placeholder="01112345678"
            className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl focus:border-amber-500/30 text-xs text-white focus:outline-none transition-all font-bold disabled:opacity-50"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">رقم هاتف الأم</label>
          <input
            type="text"
            value={formData.motherPhone}
            onChange={(e) => onChange('motherPhone', e.target.value)}
            disabled={disabled}
            placeholder="01212345678"
            className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl focus:border-amber-500/30 text-xs text-white focus:outline-none transition-all font-bold disabled:opacity-50"
          />
        </div>
      </div>

      {/* Grid for School & Grade */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">اسم المدرسة</label>
          <input
            type="text"
            value={formData.schoolName}
            onChange={(e) => onChange('schoolName', e.target.value)}
            disabled={disabled}
            placeholder="مدرسة الفاروق..."
            className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl focus:border-amber-500/30 text-xs text-white focus:outline-none transition-all font-bold disabled:opacity-50"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">الصف الدراسي *</label>
          <select
            value={formData.grade}
            onChange={(e) => onChange('grade', e.target.value)}
            required
            disabled={disabled}
            className="w-full px-4 py-2.5 bg-[#0a0f1d] border border-white/10 rounded-xl focus:border-amber-500/30 text-xs text-white focus:outline-none transition-all cursor-pointer font-bold disabled:opacity-50"
          >
            <option value="" className="bg-[#0b0f19] text-gray-400">--- اختر الصف ---</option>
            <optgroup label="المرحلة الابتدائية" className="bg-[#0b0f19] text-gray-400 font-black">
              <option value="pri1" className="bg-[#0b0f19] text-white">الصف الأول الابتدائي</option>
              <option value="pri2" className="bg-[#0b0f19] text-white">الصف الثاني الابتدائي</option>
              <option value="pri3" className="bg-[#0b0f19] text-white">الصف الثالث الابتدائي</option>
              <option value="pri4" className="bg-[#0b0f19] text-white">الصف الرابع الابتدائي</option>
              <option value="pri5" className="bg-[#0b0f19] text-white">الصف الخامس الابتدائي</option>
              <option value="pri6" className="bg-[#0b0f19] text-white">الصف السادس الابتدائي</option>
            </optgroup>
            <optgroup label="المرحلة الإعدادية" className="bg-[#0b0f19] text-gray-400 font-black">
              <option value="prep1" className="bg-[#0b0f19] text-white">الصف الأول الإعدادي</option>
              <option value="prep2" className="bg-[#0b0f19] text-white">الصف الثاني الإعدادي</option>
              <option value="prep3" className="bg-[#0b0f19] text-white">الصف الثالث الإعدادي</option>
            </optgroup>
            <optgroup label="المرحلة الثانوية" className="bg-[#0b0f19] text-gray-400 font-black">
              <option value="sec1" className="bg-[#0b0f19] text-white">الصف الأول الثانوي</option>
              <option value="sec2" className="bg-[#0b0f19] text-white">الصف الثاني الثانوي</option>
              <option value="sec3" className="bg-[#0b0f19] text-white">الصف الثالث الثانوي</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* Grid for Center & Group Assignment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">السنتر (الفرع) *</label>
          <select
            value={formData.centerId}
            onChange={(e) => {
              onChange('centerId', e.target.value);
              onChange('groupId', ''); // Reset group on center change
            }}
            required
            disabled={disabled}
            className="w-full px-4 py-2.5 bg-[#0a0f1d] border border-white/10 rounded-xl focus:border-amber-500/30 text-xs text-white focus:outline-none transition-all cursor-pointer font-bold disabled:opacity-50"
          >
            <option value="" className="bg-[#0b0f19] text-gray-400">--- اختر السنتر ---</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#0b0f19] text-white">
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">المجموعة *</label>
          <select
            value={formData.groupId}
            onChange={(e) => onChange('groupId', e.target.value)}
            required
            disabled={disabled || !formData.centerId}
            className="w-full px-4 py-2.5 bg-[#0a0f1d] border border-white/10 rounded-xl focus:border-amber-500/30 text-xs text-white focus:outline-none transition-all cursor-pointer font-bold disabled:opacity-50"
          >
            <option value="" className="bg-[#0b0f19] text-gray-400">--- اختر المجموعة ---</option>
            {filteredGroups.map((g) => (
              <option key={g.id} value={g.id} className="bg-[#0b0f19] text-white">
                {g.name} ({g.day} - {g.time})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
