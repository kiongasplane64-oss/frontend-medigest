import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
  color?: string;
  description?: string;
}

export const StatCard = ({ title, value, icon, trend, color = "bg-blue-500" }: StatCardProps) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold mt-2 text-slate-800">{value}</h3>
        {trend && <p className="text-xs font-bold text-green-500 mt-2">{trend} ↑ <span className="text-slate-400 font-normal">vs hier</span></p>}
      </div>
      <div className={`p-3 rounded-xl text-white ${color}`}>
        {icon}
      </div>
    </div>
  </div>
);