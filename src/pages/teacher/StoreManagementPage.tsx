import React from 'react';
import { StoreManagementTab } from '../admin/center/StoreManagementTab';
import { Gift } from 'lucide-react';

export const StoreManagementPage: React.FC = () => {
  return (
    <div className="space-y-6 p-6 bg-[#060913] text-white min-h-screen font-cairo">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <h1 className="text-lg font-black bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent flex items-center gap-2">
            <Gift className="text-orange-400" size={20} />
            إدارة متجر الجوائز والتحفيز (Store Management)
          </h1>
          <p className="text-[10px] text-gray-500 font-bold">إضافة الهدايا والكروت وتأكيد طلبات الاستبدال للطلاب.</p>
        </div>
      </div>

      {/* Render Main store management tab content */}
      <StoreManagementTab />
    </div>
  );
};
export default StoreManagementPage;
