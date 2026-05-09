import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useError } from '@/contexts/ErrorContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Undo2, ChevronDown, ChevronUp, Trash2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SaleWithDetails {
  id: string;
  ticket_id: string;
  sell_price: number;
  quantity: number;
  profit: number;
  fee: number;
  batch_id: string;
  sold_at: string;
  created_at: string;
  tickets: {
    id: string;
    quantity: number;
    cost_price: number;
    status: 'for_sale' | 'sold_pending' | 'used';
    global_products: {
      name: string;
    };
    platforms: {
      name: string;
    };
  };
}

interface GroupedSale {
  batch_id: string;
  sold_at: string;
  product_name: string;
  total_quantity: number;
  total_sell_price: number;
  total_cost_price: number;
  total_fee: number;
  total_profit: number;
  platforms: string[];
  items: SaleWithDetails[];
}

export function Sales() {
  const { showDbError } = useError();
  const [groupedSales, setGroupedSales] = useState<GroupedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [undoConfirm, setUndoConfirm] = useState<GroupedSale | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    fetchSales();
  }, [dateFilter]);

  async function fetchSales() {
    try {
      setLoading(true);
      let query = supabase
        .from('sales')
        .select(`
          *,
          tickets (
            id,
            quantity,
            cost_price,
            status,
            global_products (
              name
            ),
            platforms (
              name
            )
          )
        `)
        .order('sold_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (dateFilter) {
        query = query.eq('sold_at', dateFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const groupedData: Record<string, GroupedSale> = {};
      
      (data as SaleWithDetails[]).forEach(sale => {
        const batchId = sale.batch_id || sale.id;
        
        if (!groupedData[batchId]) {
          groupedData[batchId] = {
            batch_id: batchId,
            sold_at: sale.sold_at,
            product_name: sale.tickets?.global_products?.name || '未知商品',
            total_quantity: 0,
            total_sell_price: 0,
            total_cost_price: 0,
            total_fee: 0,
            total_profit: 0,
            platforms: [],
            items: [],
          };
        }
        
        const group = groupedData[batchId];
        group.items.push(sale);
        group.total_quantity += Number(sale.quantity);
        // 为了避免 %s 在 HTML 渲染时引起混淆或者被某些工具当作转义符，我们在显示时进行安全的格式化
        group.total_sell_price += Number(sale.sell_price) * Number(sale.quantity);
        group.total_cost_price += Number(sale.tickets?.cost_price || 0) * Number(sale.quantity);
        group.total_fee += Number(sale.fee || 0) * Number(sale.quantity);
        // 历史数据中 profit 已经是总利润，新数据中每条记录是单件利润，因此直接累加即可，不能再乘以 quantity
        group.total_profit += Number(sale.profit);
        
        const platformName = sale.tickets?.platforms?.name;
        if (platformName && !group.platforms.includes(platformName)) {
          group.platforms.push(platformName);
        }
      });

      const groupedArray = Object.values(groupedData).sort((a, b) => {
        if (a.sold_at !== b.sold_at) {
          return new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime();
        }
        const dateA = a.items[0]?.created_at ? new Date(a.items[0].created_at).getTime() : 0;
        const dateB = b.items[0]?.created_at ? new Date(b.items[0].created_at).getTime() : 0;
        return dateB - dateA;
      });

      setGroupedSales(groupedArray);
    } catch (error: any) {
      if (error?.message === 'Failed to fetch' || error?.code === 'PGRST301' || !navigator.onLine) {
        showDbError();
      } else {
        toast.error('获取销售记录失败: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUndoSale() {
    if (!undoConfirm) return;
    try {
      const ticketIds = undoConfirm.items.map(item => item.ticket_id);
      
      if (ticketIds.length > 0) {
        const { error: ticketError } = await supabase
          .from('tickets')
          .update({ status: 'for_sale' })
          .in('id', ticketIds);
          
        if (ticketError) throw ticketError;
      }

      const saleIds = undoConfirm.items.map(item => item.id);
      if (saleIds.length > 0) {
        const { error: saleError } = await supabase
          .from('sales')
          .delete()
          .in('id', saleIds);

        if (saleError) throw saleError;
      }

      toast.success('撤销批次售出成功，相关单据已恢复为待售状态');
      setUndoConfirm(null);
      fetchSales();
    } catch (error: any) {
      toast.error('撤销失败: ' + error.message);
    }
  }

  async function handleClearAllSales() {
    try {
      const { error } = await supabase.from('sales').delete().not('id', 'is', null);
      if (error) throw error;
      toast.success('所有销售历史记录已清空');
      setClearConfirm(false);
      fetchSales();
    } catch (error: any) {
      toast.error('清空失败: ' + error.message);
    }
  }

  const toggleExpand = (batchId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [batchId]: !prev[batchId]
    }));
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">销售明细</h2>
        
        <div className="flex items-center gap-3 bg-white/70 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.03)] border border-white/50">
          <label className="text-sm font-semibold text-gray-500 whitespace-nowrap">日期筛选</label>
          <Input 
            type="date" 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)} 
            className="w-auto border-none shadow-none h-8 px-2 text-sm focus-visible:ring-0 bg-transparent font-medium"
          />
          {dateFilter && (
            <button 
              onClick={() => setDateFilter('')}
              className="text-sm text-primary hover:text-primary/80 font-bold whitespace-nowrap bg-primary/10 px-3 py-1 rounded-full"
            >
              清除
            </button>
          )}
          <div className="w-px h-5 bg-gray-200 mx-1"></div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-500 hover:text-red-600 hover:bg-red-50 font-bold px-3 h-8 rounded-xl"
            onClick={() => setClearConfirm(true)}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            清空记录
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 font-medium">加载中...</div>
      ) : groupedSales.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] font-medium border border-white/50">
          {dateFilter ? '该日期暂无销售记录' : '暂无销售记录'}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {groupedSales.map(group => {
              const isExpanded = !!expandedCards[group.batch_id];
              return (
                <Card key={group.batch_id} className="shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50 rounded-[2rem] bg-white/80 backdrop-blur-md overflow-hidden transition-all duration-300">
                  <div 
                    className="p-6 cursor-pointer hover:bg-white/50 transition-colors"
                    onClick={() => toggleExpand(group.batch_id)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          {group.platforms.map((platform, idx) => (
                            <span key={idx} className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              {platform || '未知'}
                            </span>
                          ))}
                          <span className="text-xs text-gray-400 font-medium">{group.sold_at}</span>
                        </div>
                        <div className="font-extrabold text-xl text-gray-900 tracking-tight">{group.product_name}</div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <div className="text-xs text-gray-400 font-medium mb-1">总价 / 数量</div>
                          <div className="font-bold text-lg text-gray-900">¥{group.total_sell_price.toFixed(2)} <span className="text-sm text-gray-500 font-medium ml-1">/ {group.total_quantity}张</span></div>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-full">
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 border-t border-gray-50 bg-gray-50/30 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="space-y-3 mb-6 mt-4">
                        <div className="text-sm font-bold text-gray-700 px-2">包含单据明细</div>
                        {group.items.map(item => (
                          <div key={item.id} className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100 flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-3 sm:gap-4">
                              <span className="bg-primary/10 text-primary text-[10px] sm:text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider min-w-[60px] text-center">
                                {item.tickets?.platforms?.name || '未知平台'}
                              </span>
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-0.5">成本: ¥{item.tickets?.cost_price?.toFixed(2)}</span>
                                <span className="text-sm font-bold text-gray-900">售出: ¥{item.sell_price?.toFixed(2)}</span>
                              </div>
                            </div>
                            <div>
                              {item.tickets?.status === 'used' ? (
                                <span className="text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg text-xs font-bold">已核销</span>
                              ) : item.tickets?.status === 'sold_pending' ? (
                                <span className="text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg text-xs font-bold border border-orange-100">待使用</span>
                              ) : (
                                <span className="text-gray-400 text-xs">未知</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div>
                            <div className="text-gray-400 mb-1 text-[11px] font-bold uppercase tracking-wider">总成本</div>
                            <div className="font-semibold text-gray-600 text-base">¥{group.total_cost_price.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 mb-1 text-[11px] font-bold uppercase tracking-wider">扣除手续费 (0.6%)</div>
                            <div className="font-semibold text-orange-500 text-base">¥{group.total_fee.toFixed(2)}</div>
                          </div>
                          <div className="col-span-2 pt-4 border-t border-gray-50 flex justify-between items-end">
                            <div>
                              <div className="text-gray-400 mb-1 text-[11px] font-bold uppercase tracking-wider">本单净利润</div>
                              <div className={group.total_profit >= 0 ? 'text-emerald-500 font-extrabold text-2xl sm:text-3xl tracking-tight' : 'text-red-500 font-extrabold text-2xl sm:text-3xl tracking-tight'}>
                                {group.total_profit >= 0 ? '+' : ''}{group.total_profit.toFixed(2)}
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl font-medium shadow-sm border border-transparent hover:border-red-100 h-10 px-4" 
                              onClick={(e) => { e.stopPropagation(); setUndoConfirm(group); }}
                            >
                              <Undo2 className="w-4 h-4 mr-1.5" />
                              撤销整单
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Undo Confirmation Dialog */}
      <Dialog open={!!undoConfirm} onOpenChange={(open) => !open && setUndoConfirm(null)}>
        <DialogContent className="rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-orange-600 text-xl">确认撤销该批次售出?</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-gray-600 leading-relaxed">
            <div>您即将撤销售出 <strong className="text-gray-900">{undoConfirm?.product_name}</strong> 共 <strong className="text-gray-900">{undoConfirm?.total_quantity}</strong> 张单据。</div>
            <div className="mt-3 text-sm bg-orange-50 text-orange-700 p-4 rounded-2xl border border-orange-100/50">
              撤销后，该批次的 {undoConfirm?.items.length} 条销售记录将被删除，对应的 {undoConfirm?.total_quantity} 张单据将自动恢复为“待售”状态。
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setUndoConfirm(null)} className="rounded-2xl h-12 px-6 border-gray-200">取消</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white rounded-2xl h-12 px-6 shadow-lg shadow-orange-500/20 font-bold" onClick={handleUndoSale}>确认撤销</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation Dialog */}
      <Dialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <DialogContent className="rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600 text-xl flex items-center gap-2">
              <AlertCircle className="w-6 h-6" />
              确认清空所有销售记录？
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-gray-600 leading-relaxed">
            <div className="text-sm mt-3 bg-red-50 text-red-700 p-4 rounded-2xl border border-red-100/50 font-medium">
              警告：您即将删除<strong>所有的销售历史明细</strong>。
              <br /><br />
              此操作仅会清空当前的销售报表与历史利润数据，<strong>不会影响</strong>商品在库存中的实际状态。此操作不可恢复，是否继续？
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setClearConfirm(false)} className="rounded-2xl h-12 px-6 border-gray-200">取消</Button>
            <Button className="bg-red-500 hover:bg-red-600 text-white rounded-2xl h-12 px-6 shadow-lg shadow-red-500/20 font-bold" onClick={handleClearAllSales}>确认清空</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
