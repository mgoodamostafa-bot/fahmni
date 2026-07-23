import React from 'react';
import { AlertCircle, CheckCircle, TrendingUp, HelpCircle } from 'lucide-react';

export interface AlertItem {
  id: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
}

interface SmartAlertsProps {
  alerts: AlertItem[];
}

export const SmartAlerts: React.FC<SmartAlertsProps> = ({ alerts }) => {
  if (alerts.length === 0) {
    return (
      <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-5 text-center text-xs text-gray-500 font-bold">
        لا توجد أي تنبيهات ذكية حالياً. كل شيء يعمل بشكل رائع! ✨
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">التنبيهات الذكية (موجّه بالذكاء الاصطناعي)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {alerts.map((alert) => {
          const colorClass =
            alert.type === 'danger'
              ? 'bg-red-500/10 border-red-500/20 text-red-500'
              : alert.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
              : alert.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-500';

          const icon =
            alert.type === 'danger' ? (
              <AlertCircle size={16} />
            ) : alert.type === 'warning' ? (
              <AlertCircle size={16} />
            ) : alert.type === 'success' ? (
              <CheckCircle size={16} />
            ) : (
              <HelpCircle size={16} />
            );

          return (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-md shadow-sm transition-all duration-300 hover:border-white/10 ${colorClass}`}
            >
              <div className="mt-0.5 shrink-0">{icon}</div>
              <div className="space-y-0.5 text-right">
                <h4 className="text-xs font-black text-white">{alert.title}</h4>
                <p className="text-[10px] text-gray-400 font-bold leading-normal">{alert.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
