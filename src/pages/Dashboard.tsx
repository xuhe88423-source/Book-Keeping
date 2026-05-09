import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, Plus, Trash2, AlertCircle, CheckCircle2, Pencil } from 'lucide-react';
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
    created_at?: string;
  }[];
}

interface DashboardData {
  todayProfit: number;
  todaySoldQuantity: number;
  monthProfit: number;
  monthSoldQuantity: number;
  chartData: { date: string; profit: number }[];
  globalProducts: GlobalProduct[];
}

export function Dashboard() {
  const { showDbError } = useError();
  const [data, setData] = useState<DashboardData>({
    todayProfit: 0,
    todaySoldQuantity: 0,
    monthProfit: 0,
    monthSoldQuantity: 0,
    chartData: [],
    globalProducts: []
  });
  const [loading, setLoading] = useState(true);

  // Cross-platform sell states
  const [selectedProduct, setSelectedProduct] = useState<GlobalProduct | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSellOpen, setIsSellOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<{id: string, name: string} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<GlobalProduct | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [clearTodayConfirm, setClearTodayConfirm] = useState(false);
  const [batchSellData, setBatchSellData] = useState<{ total_price: string; selectedTickets: Record<string, boolean>; sold_at: string }>({
    total_price: '',
    selectedTickets: {},
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

  async function handleEditProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!editProduct) return;
    try {
      const { error } = await supabase.from('global_products').update({ name: editProduct.name }).eq('id', editProduct.id);
      if (error) throw error;
      toast.success('修改成功');
      
      if (selectedProduct && selectedProduct.id === editProduct.id) {
        setSelectedProduct({ ...selectedProduct, name: editProduct.name });
      }
      setEditProduct(null);
      fetchDashboardData();
    } catch (error: any) {
      toast.error('修改失败: ' + error.message);
    }
  }

  async function handleDeleteProduct() {
    if (!deleteConfirm) return;
    try {
      const { error } = await supabase.from('global_products').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      toast.success('删除成功');
      setDeleteConfirm(null);
      setIsDetailOpen(false);
      fetchDashboardData();
    } catch (error: any) {
      toast.error('删除失败: ' + error.message);
    }
  }

  async function handleWriteOff(ticketId: string) {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: 'used' })
        .eq('id', ticketId);

      if (error) throw error;
      toast.success('核销成功');
      
      // Update local state for immediate feedback
      if (selectedProduct) {
        setSelectedProduct(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            platformDetails: prev.platformDetails.map(p => ({
              ...p,
              tickets: p.tickets.map(t => t.id === ticketId ? { ...t, status: 'used' } : t)
            }))
          };
        });
      }
      fetchDashboardData();
    } catch (error: any) {
      toast.error('核销失败: ' + error.message);
    }
  }

  async function handleClearTodaySales() {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // 1. Get today's sales to find tickets to revert
      const { data: todaySales, error: fetchError } = await supabase
        .from('sales')
        .select('ticket_id')
        .eq('sold_at', today);

      if (fetchError) throw fetchError;

      if (todaySales && todaySales.length > 0) {
        const ticketIds = todaySales.map(s => s.ticket_id);
        
        // 2. Revert tickets back to 'for_sale'
        const { error: updateError } = await supabase
          .from('tickets')
          .update({ status: 'for_sale' })
          .in('id', ticketIds);
          
        if (updateError) throw updateError;
      }

      // 3. Delete today's sales records
      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .eq('sold_at', today);

      if (deleteError) throw deleteError;

      toast.success('今日销售数据已清空，商品已恢复待售');
      setClearTodayConfirm(false);
      fetchDashboardData();
    } catch (error: any) {
      toast.error('清空失败: ' + error.message);
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
            status,
            sort_order,
            created_at,
            platforms (
              id,
              name,
              created_at
            )
          )
        `);

      const globalProducts: GlobalProduct[] = [];

      if (globalProductsData) {
        globalProductsData.forEach((gp: any, index: number) => {
          let gpTotalQty = 0;
          const platformMap = new Map<string, { platformId: string; platformName: string; tickets: Ticket[]; created_at: string }>();

          if (gp.tickets) {
            gp.tickets.forEach((t: any) => {
              // 无论是全局总数量、单品总数量，还是全局总价值，都只计算处于 'for_sale'（待售）状态的库存
              if (t.status === 'for_sale') {
                gpTotalQty += 1;
              }

              if (t.platforms) {
                const pid = t.platforms.id;
                if (!platformMap.has(pid)) {
                  platformMap.set(pid, {
                    platformId: pid,
                    platformName: t.platforms.name,
                    tickets: [],
                    created_at: t.platforms.created_at
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
            platformDetails: Array.from(platformMap.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          });
        });
      }

      globalProducts.sort((a, b) => b.totalQuantity - a.totalQuantity);

      // 2. Fetch sales for profit stats (this month)
      const { data: sales } = await supabase
        .from('sales')
        .select('profit, sold_at, quantity')
        .gte('sold_at', firstDayOfMonth);

      let tProfit = 0;
      let mProfit = 0;
      let tQty = 0;
      let mQty = 0;
      
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
          mQty += Number(s.quantity || 1);
          if (s.sold_at === today) {
            tProfit += Number(s.profit);
            tQty += Number(s.quantity || 1);
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
        todaySoldQuantity: tQty,
        monthProfit: mProfit,
        monthSoldQuantity: mQty,
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

    const ticketsToSell = Object.entries(batchSellData.selectedTickets).filter(([_, selected]) => selected).map(([id]) => id);
    if (ticketsToSell.length === 0) {
      toast.error('请至少选择一张单据进行售出');
      return;
    }

    const totalQty = ticketsToSell.length;
    const avgSellPrice = totalSellPrice / totalQty;
    const totalFee = totalSellPrice * 0.006;
    const avgFee = totalFee / totalQty;
    const batchId = crypto.randomUUID();

    const saleRecords: any[] = [];
    const ticketUpdates: string[] = [];

    // Validate quantities and gather data
    for (const ticketId of ticketsToSell) {
      let foundTicket: Ticket | null = null;
      for (const pDetail of selectedProduct.platformDetails) {
        const t = pDetail.tickets.find(t => t.id === ticketId);
        if (t) {
          foundTicket = t;
          break;
        }
      }

      if (!foundTicket || foundTicket.status !== 'for_sale') continue;
      
      const profit = avgSellPrice - foundTicket.cost_price - avgFee;

      saleRecords.push({
        ticket_id: foundTicket.id,
        sell_price: avgSellPrice,
        quantity: 1,
        profit: profit,
        fee: avgFee,
        batch_id: batchId,
        sold_at: batchSellData.sold_at,
      });
      ticketUpdates.push(foundTicket.id);
    }

    if (saleRecords.length === 0) {
      toast.error('没有有效的待售单据可以售出');
      return;
    }

    try {
      // 1. Insert all sales records
      const { error: saleError } = await supabase.from('sales').insert(saleRecords);
      if (saleError) throw saleError;

      // 2. Update all ticket statuses
      const { error: ticketError } = await supabase
        .from('tickets')
        .update({ status: 'sold_pending' })
        .in('id', ticketUpdates);
      if (ticketError) throw ticketError;

      toast.success('组合售出成功');
      setIsSellOpen(false);
      setBatchSellData({ total_price: '', selectedTickets: {}, sold_at: new Date().toISOString().split('T')[0] });
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
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${theme.dot}`}></div>
                    <span className={`text-sm sm:text-base font-semibold truncate max-w-[120px] sm:max-w-[150px] ${theme.text}`}>{stat.name}</span>
                  </div>
                  <div 
                    role="button" 
                    className={`p-1.5 rounded-full hover:bg-black/5 transition-colors ${theme.text} opacity-60 hover:opacity-100`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditProduct({id: stat.id, name: stat.name});
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${theme.text}`}>
                  {stat.totalQuantity} <span className="text-xs sm:text-sm font-medium opacity-70 ml-0.5">张</span>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* 销售利润统计 */}
      <div className="pt-4 border-t border-gray-200/60">
        <h3 className="text-lg font-bold text-gray-800 mb-4">销售与利润</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          <Card className="border-white/40 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[1.5rem] overflow-hidden">
            <CardContent className="p-4 sm:p-5 flex items-center justify-start gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100/50 shadow-sm border border-white/50 shrink-0">
                <TrendingUp className="w-5 h-5 text-emerald-500 stroke-[2.5px]" />
              </div>
              <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <div className="text-xs sm:text-sm font-medium text-gray-500 truncate">今日利润</div>
                {data.todaySoldQuantity > 0 && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                    onClick={() => setClearTodayConfirm(true)}
                    title="清除今日销售数据"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                  <h3 className="text-base sm:text-xl font-extrabold text-gray-900 tracking-tight truncate">¥{data.todayProfit.toFixed(2)}</h3>
                  <span className="text-[10px] sm:text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/50 whitespace-nowrap mt-0.5">
                    售出 {data.todaySoldQuantity}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/40 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[1.5rem] overflow-hidden">
            <CardContent className="p-4 sm:p-5 flex items-center justify-start gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100/50 shadow-sm border border-white/50 shrink-0">
                <Wallet className="w-5 h-5 text-blue-500 stroke-[2.5px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="text-xs sm:text-sm font-medium text-gray-500 truncate">本月利润</div>
                </div>
                <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                  <h3 className="text-base sm:text-xl font-extrabold text-gray-900 tracking-tight truncate">¥{data.monthProfit.toFixed(2)}</h3>
                  <span className="text-[10px] sm:text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100/50 whitespace-nowrap mt-0.5">
                    售出 {data.monthSoldQuantity}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
              <span>全局总有效库存</span>
              <span className="font-bold text-gray-900 text-lg">{selectedProduct?.totalQuantity} 张</span>
            </div>
            
            <div className="space-y-3 mt-4">
              <label className="text-sm font-semibold text-gray-700">各平台单据分布</label>
              {selectedProduct?.platformDetails.map((p, idx) => {
                const availableTickets = p.tickets
                  .filter(t => t.status !== 'used')
                  .sort((a, b) => {
                    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                  });
                if (availableTickets.length === 0) return null;
                return (
                  <div key={idx} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold text-primary/80 text-sm">{p.platformName}</span>
                      <span className="text-xs font-medium text-gray-500">共 {availableTickets.length} 张</span>
                    </div>
                    <div className="space-y-2">
                      {availableTickets.map(t => (
                        <div key={t.id} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 font-medium">成本: ¥{t.cost_price.toFixed(2)}</span>
                            {t.status === 'for_sale' ? (
                              <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-bold">待售</span>
                            ) : t.status === 'sold_pending' ? (
                              <span className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded text-[10px] font-bold">已售待使用</span>
                            ) : null}
                          </div>
                          {t.status === 'sold_pending' && (
                            <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px] font-bold px-3 text-emerald-600 border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 hover:border-emerald-300 shadow-sm gap-1" onClick={() => handleWriteOff(t.id)}>
                              <CheckCircle2 className="w-3 h-3" />
                              核销
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 mt-6">
              {selectedProduct && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-12 w-12 rounded-xl text-gray-400 hover:text-destructive hover:bg-destructive/10 shrink-0 border border-gray-200" 
                  onClick={() => setDeleteConfirm(selectedProduct)}
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              )}
              <Button 
                className="flex-1 rounded-xl h-12 font-bold shadow-lg shadow-primary/20"
                onClick={() => {
                  setIsDetailOpen(false);
                  setIsSellOpen(true);
                  setBatchSellData({ total_price: '', selectedTickets: {}, sold_at: new Date().toISOString().split('T')[0] });
                }}
              >
                跨平台组合售出
              </Button>
            </div>
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
              <label className="text-sm font-medium text-gray-700">勾选要售出的单据</label>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {selectedProduct?.platformDetails.map((p, pIndex) => {
                  const availableTickets = p.tickets
                    .filter(t => t.status !== 'used')
                    .sort((a, b) => {
                      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
                      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    });
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
                        <label key={ticket.id} className={`flex items-center justify-between bg-white/80 rounded-lg p-2 cursor-pointer border ${ticket.status !== 'for_sale' ? 'opacity-60 grayscale' : 'hover:border-primary/30'} transition-all`}>
                          <div className="flex items-center gap-3">
                            <input 
                              type="checkbox" 
                              disabled={ticket.status !== 'for_sale'}
                              checked={!!batchSellData.selectedTickets[ticket.id]}
                              onChange={e => {
                                setBatchSellData(prev => ({
                                  ...prev,
                                  selectedTickets: { ...prev.selectedTickets, [ticket.id]: e.target.checked }
                                }))
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                            />
                            <div className="flex flex-col">
                              <span className="text-[10px] text-gray-500">成本价</span>
                              <span className="font-bold text-gray-900">¥{ticket.cost_price.toFixed(2)}</span>
                            </div>
                          </div>
                          {ticket.status === 'for_sale' ? (
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-bold border border-emerald-100">待售</span>
                          ) : ticket.status === 'sold_pending' ? (
                            <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded-full font-bold border border-orange-100">已售待使用</span>
                          ) : null}
                        </label>
                      ))}
                    </div>
                  </div>
                )})}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">总售价 (元)</label>
                <Input required type="number" step="0.01" min="0" value={batchSellData.total_price} onChange={e => setBatchSellData({...batchSellData, total_price: e.target.value})} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary font-bold text-lg" placeholder="输入总金额" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">售出日期</label>
                <Input required type="date" value={batchSellData.sold_at} onChange={e => setBatchSellData({...batchSellData, sold_at: e.target.value})} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary" />
              </div>
            </div>
            <div className="text-xs text-gray-400 text-center">注：售出将扣除 0.6% 的手续费计算最终利润</div>
            <Button type="submit" className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20">确认售出</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={!!editProduct} onOpenChange={(open) => !open && setEditProduct(null)}>
        <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100">
          <DialogHeader><DialogTitle className="text-gray-900">修改商品名称</DialogTitle></DialogHeader>
          <form onSubmit={handleEditProduct} className="space-y-4">
            <Input required value={editProduct?.name || ''} onChange={e => setEditProduct(prev => prev ? {...prev, name: e.target.value} : null)} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20" />
            <Button type="submit" className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20">保存</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除商品确认弹窗 */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-destructive/20">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              确认删除?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-gray-600 leading-relaxed">
            <div className="text-sm mt-3 bg-destructive/10 text-destructive p-4 rounded-2xl border border-destructive/20 font-medium">您即将删除商品 <strong>{deleteConfirm?.name}</strong>。此操作将同时永久删除该商品在所有平台下的单据记录，以及关联的所有售出明细记录！</div>
            <div className="mt-3 text-sm font-bold text-gray-900">此操作不可恢复，是否继续？</div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-xl h-12 px-6 border-gray-200">取消</Button>
            <Button variant="destructive" onClick={handleDeleteProduct} className="rounded-xl h-12 px-6 font-bold shadow-lg shadow-destructive/20">确认删除</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Today Sales Confirmation Dialog */}
      <Dialog open={clearTodayConfirm} onOpenChange={setClearTodayConfirm}>
        <DialogContent className="rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600 text-xl flex items-center gap-2">
              <AlertCircle className="w-6 h-6" />
              确认清空今日数据？
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-gray-600 leading-relaxed">
            <div className="text-sm mt-3 bg-red-50 text-red-700 p-4 rounded-2xl border border-red-100/50 font-medium">
              此操作将<strong>撤销今天（{format(new Date(), 'yyyy-MM-dd')}）产生的所有售出记录</strong>，相关的商品状态也会自动恢复为“待售”。
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setClearTodayConfirm(false)} className="rounded-2xl h-12 px-6 border-gray-200">取消</Button>
            <Button className="bg-red-500 hover:bg-red-600 text-white rounded-2xl h-12 px-6 shadow-lg shadow-red-500/20 font-bold" onClick={handleClearTodaySales}>确认撤销</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}