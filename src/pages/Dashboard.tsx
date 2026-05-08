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
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData>({
    todayProfit: 0,
    monthProfit: 0,
    inventoryValue: 0,
    totalTickets: 0,
    chartData: []
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

      // 1. Fetch tickets for inventory stats
      const { data: tickets } = await supabase.from('tickets').select('quantity, cost_price');
      let invValue = 0;
      let totalQty = 0;
      if (tickets) {
        tickets.forEach(t => {
          invValue += t.quantity * t.cost_price;
          totalQty += t.quantity;
        });
      }

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
        chartData: last7Days
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
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: '本月利润',
      value: `¥${data.monthProfit.toFixed(2)}`,
      icon: Wallet,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: '库存总价值',
      value: `¥${data.inventoryValue.toFixed(2)}`,
      icon: CircleDollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: '库存余量',
      value: `${data.totalTickets} 张`,
      icon: Package,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  if (loading) {
    return <div className="text-center py-10 text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">数据看板</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
              <div className={`p-3 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <p className="text-sm font-medium text-gray-500">{stat.title}</p>
              <h3 className="text-2xl font-bold">{stat.value}</h3>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>近7日利润趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chartData}>
                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `¥${value}`} />
                <Tooltip 
                  formatter={(value: any) => [`¥${Number(value).toFixed(2)}`, '利润']}
                  cursor={{fill: '#f3f4f6'}}
                />
                <Bar dataKey="profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
