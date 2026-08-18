import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchApi } from '../../config/api';

const formatPKR = (value) => `PKR ${(Number(value || 0) / 1000).toFixed(0)}k`;

export default function RevenueChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchApi('/financials/monthly')
      .then(rows => setData(Array.isArray(rows) ? rows.slice(-6) : []))
      .catch(() => setData([]));
  }, []);

  const chartData = data.length ? data : [{ month: 'No revenue', total: 0 }];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Revenue Overview</h3>
          <p className="mt-0.5 text-xs text-gray-400">Payments grouped by the date received</p>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0f766e" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatPKR} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value) => [`PKR ${Number(value || 0).toLocaleString()}`, 'Revenue']} />
            <Area type="monotone" dataKey="total" stroke="#0f766e" strokeWidth={2.5} fill="url(#totalGrad)" dot={false} activeDot={{ r: 4, fill: '#0f766e' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
