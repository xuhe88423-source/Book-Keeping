import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, Package, CircleDollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { startOfMonth, format, subDays } from 'date-fns';

interface DashboardData {
  todayProfit: number;
  monthProfit: number;
  inventoryValue: number;
  totalTickets: number;
  chartData: { date: string; profit: number }[];
  platformStats: { name: string; count: number }[];
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData>({
    todayProfit: 0,
    monthProfit: 0,
    inventoryValue: 0,
    totalTickets: 0,
    chartData: [],
    platformStats: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const firstDayOfMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd');

      // 1. Fetch platforms with tickets for inventory stats
      const { data: platformsData } = await supabase
        .from('platforms')
        .select(`
          name,
          product_types (
            tickets (
              quantity,
              cost_price
            )
          )
        `);

      let invValue = 0;
      let totalQty = 0;
      const platformStats: { name: string; count: number }[] = [];

      if (platformsData) {
        platformsData.forEach((platform: any) => {
          let platformTotal = 0;
          if (platform.product_types) {
            platform.product_types.forEach((pt: any) => {
              if (pt.tickets) {
                pt.tickets.forEach((t: any) => {
                  invValue += t.quantity * t.cost_price;
                  totalQty += t.quantity;
                  platformTotal += t.quantity;
                });
              }
            });
          }
          platformStats.push({ name: platform.name, count: platformTotal });
        });
      }

      // Sort platform stats by count descending
      platformStats.sort((a, b) => b.count - a.count);

      // 2. Fetch sales for profit stats (this month)
      const { data: sales } = await supabase
        .from('sales')
        .select('profit, sold_at')
        .gte('sold_at', firstDayOfMonth);

      let tProfit = 0;
      let mProfit = 0;
      
      // For chart: last 7 days
      const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const d = subDays(new Date(), 6 - i);
        return {
          date: format(d, 'MM-dd'),
          fullDate: format(d, 'yyyy-MM-dd'),
          profit: 0
        };
      });

      if (sales) {
        sales.forEach(s => {
          mProfit += Number(s.profit);
          if (s.sold_at === today) {
            tProfit += Number(s.profit);
          }
          
          // Add to chart data
          const chartItem = last7Days.find(item => item.fullDate === s.sold_at);
          if (chartItem) {
            chartItem.profit += Number(s.profit);
          }
        });
      }

      // Fetch missing days for chart if the month boundary cuts them off
      const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');
      if (sevenDaysAgo < firstDayOfMonth) {
        const { data: olderSales } = await supabase
          .from('sales')
          .select('profit, sold_at')
          .gte('sold_at', sevenDaysAgo)
          .lt('sold_at', firstDayOfMonth);
          
        if (olderSales) {
          olderSales.forEach(s => {
            const chartItem = last7Days.find(item => item.fullDate === s.sold_at);
            if (chartItem) {
              chartItem.profit += Number(s.profit);
            }
          });
        }
      }

      setData({
        todayProfit: tProfit,
        monthProfit: mProfit,
        inventoryValue: invValue,
        totalTickets: totalQty,
        chartData: last7Days,
        platformStats: platformStats
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      title: '今日利润',
      value: `¥${data.todayProfit.toFixed(2)}`,
      icon: TrendingUp,
      iconColor: 'text-emerald-500',
      gradient: 'bg-gradient-to-br from-emerald-50 to-teal-100/50',
    },
    {
      title: '本月利润',
      value: `¥${data.monthProfit.toFixed(2)}`,
      icon: Wallet,
      iconColor: 'text-blue-500',
      gradient: 'bg-gradient-to-br from-blue-50 to-indigo-100/50',
    },
    {
      title: '库存总价值',
      value: `¥${data.inventoryValue.toFixed(2)}`,
      icon: CircleDollarSign,
      iconColor: 'text-purple-500',
      gradient: 'bg-gradient-to-br from-purple-50 to-fuchsia-100/50',
    },
    {
      title: '库存余量',
      value: `${data.totalTickets} 张`,
      icon: Package,
      iconColor: 'text-amber-500',
      gradient: 'bg-gradient-to-br from-amber-50 to-orange-100/50',
    },
  ];

  if (loading) {
    return <div className="text-center py-10 text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold tracking-tight text-gray-900">数据看板</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {statCards.map((stat, i) => (
          <Card key={i} className="border-white/40 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[1.5rem] overflow-hidden">
            <CardContent className="p-4 sm:p-5 flex items-center justify-start gap-3 sm:gap-4">
              <div className={`p-2.5 sm:p-3 rounded-xl ${stat.gradient} shadow-sm border border-white/50 shrink-0`}>
                <stat.icon className={`w-5 h-5 ${stat.iconColor} stroke-[2.5px]`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-500 mb-0.5 truncate">{stat.title}</p>
                <h3 className="text-base sm:text-xl font-extrabold text-gray-900 tracking-tight truncate">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 border-white/40 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem]">
          <CardHeader className="pb-2 px-6 pt-6 sm:px-8 sm:pt-8">
            <CardTitle className="text-lg font-bold text-gray-800">近 7 日利润趋势</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} dy={10} fontWeight={500} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `¥${value}`} dx={-10} fontWeight={500} />
                  <Tooltip 
                    formatter={(value: any) => [`¥${Number(value).toFixed(2)}`, '利润']}
                    cursor={{fill: 'rgba(0,0,0,0.02)', radius: 8}}
                    contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)' }}
                    itemStyle={{ color: '#111827', fontWeight: 600 }}
                  />
                  <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[8, 8, 8, 8]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/40 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] flex flex-col">
          <CardHeader className="pb-2 px-6 pt-6 sm:px-8 sm:pt-8">
            <CardTitle className="text-lg font-bold text-gray-800">平台库存分布</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8 flex-1 flex flex-col">
            {data.platformStats.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
                暂无平台数据
              </div>
            ) : (
              <div className="space-y-4 mt-2">
                {data.platformStats.map((stat, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary/80"></div>
                      <span className="text-sm font-medium text-gray-700">{stat.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 bg-gray-100/80 px-2.5 py-0.5 rounded-md">{stat.count} 张</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}