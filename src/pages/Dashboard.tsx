import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, Package, CircleDollarSign, Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { startOfMonth, format, subDays } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useError } from '@/contexts/ErrorContext';
import type { Ticket } from '@/types';

export interface GlobalProduct {
  id: string;
  name: string;
  totalQuantity: number;
  originalIndex: number;
  platformDetails: {
    platformId: string;
    platformName: string;
    tickets: Ticket[];
  }[];
}

interface DashboardData {
  todayProfit: number;
  monthProfit: number;
  inventoryValue: number;
  totalTickets: number;
  chartData: { date: string; profit: number }[];
  globalProducts: GlobalProduct[];
}

export function Dashboard() {
  const { showDbError } = useError();
  const [data, setData] = useState<DashboardData>({
    todayProfit: 0,
    monthProfit: 0,
    inventoryValue: 0,
    totalTickets: 0,
    chartData: [],
    globalProducts: []
  });
  const [loading, setLoading] = useState(true);

  // Cross-platform sell states
  const [selectedProduct, setSelectedProduct] = useState<GlobalProduct | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSellOpen, setIsSellOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [batchSellData, setBatchSellData] = useState<{ total_price: string; quantities: Record<string, number>; sold_at: string }>({
    total_price: '',
    quantities: {},
    sold_at: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { error } = await supabase.from('global_products').insert([{ name: newProductName }]);
      if (error) throw error;
      toast.success('商品创建成功');
      setIsAddProductOpen(false);
      setNewProductName('');
      fetchDashboardData();
    } catch (error: any) {
      toast.error('创建失败: ' + error.message);
    }
  }

  async function fetchDashboardData() {
    try {
      setLoading(true);
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const firstDayOfMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd');

      // 1. Fetch global products and their tickets
      const { data: globalProductsData } = await supabase
        .from('global_products')
        .select(`
          id,
          name,
          tickets (
            id,
            cost_price,
            quantity,
            created_at,
            platforms (
              id,
              name
            )
          )
        `);

      let invValue = 0;
      let totalQty = 0;
      const globalProducts: GlobalProduct[] = [];

      if (globalProductsData) {
        globalProductsData.forEach((gp: any, index: number) => {
          let gpTotalQty = 0;
          const platformMap = new Map<string, { platformId: string; platformName: string; tickets: Ticket[] }>();

          if (gp.tickets) {
            gp.tickets.forEach((t: any) => {
              invValue += t.quantity * t.cost_price;
              totalQty += t.quantity;
              gpTotalQty += t.quantity;

              if (t.platforms) {
                const pid = t.platforms.id;
                if (!platformMap.has(pid)) {
                  platformMap.set(pid, {
                    platformId: pid,
                    platformName: t.platforms.name,
                    tickets: []
                  });
                }
                platformMap.get(pid)!.tickets.push(t);
              }
            });
          }

          globalProducts.push({
            id: gp.id,
            name: gp.name,
            totalQuantity: gpTotalQty,
            originalIndex: index,
            platformDetails: Array.from(platformMap.values())
          });
        });
      }

      globalProducts.sort((a, b) => b.totalQuantity - a.totalQuantity);

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
        globalProducts: globalProducts
      });

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      if (error?.message === 'Failed to fetch' || error?.code === 'PGRST301' || !navigator.onLine) {
        showDbError();
      } else {
        toast.error('加载数据失败: ' + error.message);
      }
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

  const getPlatformTheme = (index: number) => {
    const themes = [
      { card: 'bg-blue-100/90 border-blue-200/80', dot: 'bg-blue-500', text: 'text-blue-900', countBg: 'bg-blue-200/50' },
      { card: 'bg-emerald-100/90 border-emerald-200/80', dot: 'bg-emerald-500', text: 'text-emerald-900', countBg: 'bg-emerald-200/50' },
      { card: 'bg-rose-100/90 border-rose-200/80', dot: 'bg-rose-500', text: 'text-rose-900', countBg: 'bg-rose-200/50' },
      { card: 'bg-amber-100/90 border-amber-200/80', dot: 'bg-amber-500', text: 'text-amber-900', countBg: 'bg-amber-200/50' },
      { card: 'bg-purple-100/90 border-purple-200/80', dot: 'bg-purple-500', text: 'text-purple-900', countBg: 'bg-purple-200/50' },
    ];
    return themes[index % themes.length];
  };

  async function handleSellTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;

    const totalSellPrice = parseFloat(batchSellData.total_price);
    if (isNaN(totalSellPrice) || totalSellPrice < 0) {
      toast.error('请输入有效的总售价');
      return;
    }

    const ticketsToSell = Object.entries(batchSellData.quantities).filter(([_, qty]) => qty > 0);
    if (ticketsToSell.length === 0) {
      toast.error('请至少选择一张优惠券进行售出');
      return;
    }

    let totalQty = 0;
    const saleRecords: any[] = [];
    const ticketUpdates: { id: string; currentQty: number; sellQty: number; cost_price: number }[] = [];

    // Validate quantities and gather data
    for (const [ticketId, sellQty] of ticketsToSell) {
      let foundTicket: Ticket | null = null;
      let platformName = '';
      for (const pDetail of selectedProduct.platformDetails) {
        const t = pDetail.tickets.find(t => t.id === ticketId);
        if (t) {
          foundTicket = t;
          platformName = pDetail.platformName;
          break;
        }
      }

      if (!foundTicket) continue;
      
      if (sellQty > foundTicket.quantity) {
        toast.error(`售出数量不能大于库存数量 (平台 ${platformName}, 成本 ¥${foundTicket.cost_price})`);
        return;
      }
      
      totalQty += sellQty;
      ticketUpdates.push({ id: foundTicket.id, currentQty: foundTicket.quantity, sellQty, cost_price: foundTicket.cost_price });
    }

    const avgSellPrice = totalSellPrice / totalQty;

    try {
      for (const update of ticketUpdates) {
        const profit = (avgSellPrice - update.cost_price) * update.sellQty;

        saleRecords.push({
          ticket_id: update.id,
          sell_price: avgSellPrice,
          quantity: update.sellQty,
          profit: profit,
          sold_at: batchSellData.sold_at,
        });
      }

      // 1. Insert all sales records
      const { error: saleError } = await supabase.from('sales').insert(saleRecords);
      if (saleError) throw saleError;

      // 2. Update all ticket quantities
      for (const update of ticketUpdates) {
        const { error: ticketError } = await supabase
          .from('tickets')
          .update({ quantity: update.currentQty - update.sellQty })
          .eq('id', update.id);
        if (ticketError) throw ticketError;
      }

      toast.success('组合售出成功');
      setIsSellOpen(false);
      setBatchSellData({ total_price: '', quantities: {}, sold_at: new Date().toISOString().split('T')[0] });
      fetchDashboardData();
    } catch (error: any) {
      toast.error('售出失败: ' + error.message);
    }
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold tracking-tight text-gray-900">数据看板</h2>

      {/* 商品全局聚合分布（顶置） */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-800">商品全局聚合</h3>
          <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
            <DialogTrigger
              render={
                <Button variant="secondary" size="sm" className="gap-1.5 rounded-full shadow-sm bg-primary/10 hover:bg-primary/20 text-primary font-bold">
                  <Plus className="w-4 h-4" />
                  新增商品
                </Button>
              }
            />
            <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100">
              <DialogHeader>
                <DialogTitle className="text-gray-900">新增全局商品</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddProduct} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">商品名称</label>
                  <Input required placeholder="如：100元代金券" value={newProductName} onChange={e => setNewProductName(e.target.value)} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary" />
                </div>
                <Button type="submit" className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20">保存</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {data.globalProducts.length === 0 ? (
          <div className="text-sm text-gray-400">暂无商品数据</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {data.globalProducts.map((stat, i) => {
              const theme = getPlatformTheme(stat.originalIndex);
              return (
              <div 
                key={i} 
                onClick={() => {
                  setSelectedProduct(stat);
                  setIsDetailOpen(true);
                }}
                className={`backdrop-blur-xl border shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 rounded-[1.5rem] p-4 sm:p-5 cursor-pointer flex flex-col items-start gap-2 sm:gap-3 ${theme.card}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${theme.dot}`}></div>
                  <span className={`text-sm sm:text-base font-semibold truncate ${theme.text}`}>{stat.name}</span>
                </div>
                <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${theme.text}`}>
                  {stat.totalQuantity} <span className="text-xs sm:text-sm font-medium opacity-70 ml-0.5">张</span>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

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

      <div className="grid grid-cols-1 gap-5">
        <Card className="border-white/40 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem]">
          <CardHeader className="pb-2 px-6 pt-6 sm:px-8 sm:pt-8">
            <CardTitle className="text-lg font-bold text-gray-800">近 7 日利润趋势</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
            <div className="h-[200px] w-full mt-4" style={{ touchAction: 'pan-y' }}>
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
      </div>

      {/* 商品详情弹窗 */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900 text-xl font-bold">{selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>全局总库存</span>
              <span className="font-bold text-gray-900 text-lg">{selectedProduct?.totalQuantity} 张</span>
            </div>
            
            <div className="space-y-3 mt-4">
              <label className="text-sm font-semibold text-gray-700">各平台分布</label>
              {selectedProduct?.platformDetails.map((p, idx) => {
                const pTotal = p.tickets.reduce((sum, t) => sum + t.quantity, 0);
                if (pTotal === 0 && p.tickets.length === 0) return null;
                return (
                  <div key={idx} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-primary/80 text-sm">{p.platformName}</span>
                      <span className="text-xs font-medium text-gray-500">共 {pTotal} 张</span>
                    </div>
                    <div className="space-y-1.5">
                      {p.tickets.filter(t => t.quantity > 0).map(t => (
                        <div key={t.id} className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">成本: ¥{t.cost_price.toFixed(2)}</span>
                          <span className="text-gray-700 font-medium">{t.quantity} 张</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button 
              className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20 mt-6"
              onClick={() => {
                setIsDetailOpen(false);
                setIsSellOpen(true);
                setBatchSellData({ total_price: '', quantities: {}, sold_at: new Date().toISOString().split('T')[0] });
              }}
            >
              跨平台组合售出
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 组合售出弹窗 */}
      <Dialog open={isSellOpen} onOpenChange={setIsSellOpen}>
        <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">组合售出 - {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSellTicket} className="space-y-5 mt-2">
            
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">选择要售出的票据</label>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {selectedProduct?.platformDetails.map((p, pIndex) => {
                  const availableTickets = p.tickets.filter(t => t.quantity > 0);
                  if (availableTickets.length === 0) return null;
                  
                  // Use the same theme logic as the Dashboard cards
                  const theme = getPlatformTheme(pIndex);
                  
                  return (
                  <div key={p.platformId} className={`rounded-xl border p-3 ${theme.card}`}>
                    <div className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme.text}`}>
                      <div className={`w-2 h-2 rounded-full ${theme.dot}`}></div>
                      {p.platformName}
                    </div>
                    <div className="space-y-2">
                      {availableTickets.map(ticket => (
                        <div key={ticket.id} className="flex items-center justify-between bg-white/60 rounded-lg p-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500">成本价</span>
                            <span className="font-bold text-gray-900">¥{ticket.cost_price.toFixed(2)}</span>
                            <span className="text-[10px] text-gray-500 mt-0.5">库存: {ticket.quantity}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-gray-500">售出</label>
                            <Input 
                              type="number" 
                              min="0" 
                              max={ticket.quantity} 
                              value={batchSellData.quantities[ticket.id] || ''} 
                              onChange={e => {
                                const val = parseInt(e.target.value) || 0;
                                setBatchSellData(prev => ({
                                  ...prev,
                                  quantities: { ...prev.quantities, [ticket.id]: val }
                                }));
                              }} 
                              className="w-20 rounded-md h-8 bg-white text-center border-white/50" 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )})}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">总售价 (元)</label>
                <Input required type="number" step="0.01" min="0" value={batchSellData.total_price} onChange={e => setBatchSellData({...batchSellData, total_price: e.target.value})} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary font-bold text-lg" placeholder="输入这批总价" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">售出日期</label>
                <Input required type="date" value={batchSellData.sold_at} onChange={e => setBatchSellData({...batchSellData, sold_at: e.target.value})} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary" />
              </div>
            </div>
            <Button type="submit" className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20">确认售出</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}