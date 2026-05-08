import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Undo2 } from 'lucide-react';
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
  sold_at: string;
  created_at: string;
  tickets: {
    quantity: number;
    cost_price: number;
    product_types: {
      name: string;
      platforms: {
        name: string;
      };
    };
  };
}

export function Sales() {
  const [sales, setSales] = useState<SaleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  
  const [undoConfirm, setUndoConfirm] = useState<SaleWithDetails | null>(null);

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
            quantity,
            cost_price,
            product_types (
              name,
              platforms (
                name
              )
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
      setSales(data as any);
    } catch (error: any) {
      toast.error('获取销售记录失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUndoSale() {
    if (!undoConfirm) return;
    try {
      // 1. Add quantity back to tickets
      const currentTicketQty = undoConfirm.tickets?.quantity || 0;
      const { error: ticketError } = await supabase
        .from('tickets')
        .update({ quantity: currentTicketQty + undoConfirm.quantity })
        .eq('id', undoConfirm.ticket_id);
        
      if (ticketError) throw ticketError;

      // 2. Delete the sale record
      const { error: saleError } = await supabase
        .from('sales')
        .delete()
        .eq('id', undoConfirm.id);

      if (saleError) throw saleError;

      toast.success('撤销售出成功，库存已恢复');
      setUndoConfirm(null);
      fetchSales();
    } catch (error: any) {
      toast.error('撤销失败: ' + error.message);
    }
  }

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
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 font-medium">加载中...</div>
      ) : sales.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] font-medium border border-white/50">
          {dateFilter ? '该日期暂无销售记录' : '暂无销售记录'}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile View: Cards */}
          <div className="grid grid-cols-1 md:hidden gap-4">
            {sales.map(sale => (
              <Card key={sale.id} className="shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50 rounded-[2rem] bg-white/80 backdrop-blur-md overflow-hidden">
                <CardContent className="p-6 space-y-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="bg-primary/10 text-primary text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                          {sale.tickets?.product_types?.platforms?.name}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">{sale.sold_at}</span>
                      </div>
                      <span className="font-extrabold text-xl text-gray-900 tracking-tight">{sale.tickets?.product_types?.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-gray-400 hover:text-orange-500 hover:bg-orange-50 -mr-2 shadow-sm border border-gray-100 bg-white" onClick={() => setUndoConfirm(sale)}>
                      <Undo2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="bg-gray-50/80 rounded-[1.5rem] p-5 grid grid-cols-2 gap-4 text-sm border border-gray-100">
                    <div>
                      <div className="text-gray-400 mb-1 text-[11px] font-bold uppercase tracking-wider">售出单价</div>
                      <div className="font-bold text-gray-900 text-base">¥{sale.sell_price.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 mb-1 text-[11px] font-bold uppercase tracking-wider">数量</div>
                      <div className="font-bold text-gray-900 text-base">{sale.quantity} 张</div>
                    </div>
                    <div>
                      <div className="text-gray-400 mb-1 text-[11px] font-bold uppercase tracking-wider">成本单价</div>
                      <div className="font-semibold text-gray-500 text-base">¥{sale.tickets?.cost_price.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 mb-1 text-[11px] font-bold uppercase tracking-wider">本单利润</div>
                      <div className={sale.profit >= 0 ? 'text-emerald-500 font-extrabold text-lg' : 'text-red-500 font-extrabold text-lg'}>
                        {sale.profit >= 0 ? '+' : ''}{sale.profit.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* PC View: Table */}
          <div className="hidden md:block bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 border-b border-gray-100/80">
                <tr>
                  <th className="p-6 font-bold text-gray-500 text-xs uppercase tracking-wider">售出日期</th>
                  <th className="p-6 font-bold text-gray-500 text-xs uppercase tracking-wider">平台 / 商品名称</th>
                  <th className="p-6 font-bold text-gray-500 text-xs uppercase tracking-wider">成本单价</th>
                  <th className="p-6 font-bold text-gray-500 text-xs uppercase tracking-wider">售出单价</th>
                  <th className="p-6 font-bold text-gray-500 text-xs uppercase tracking-wider">数量</th>
                  <th className="p-6 font-bold text-gray-500 text-xs uppercase tracking-wider">本单利润</th>
                  <th className="p-6 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/50">
                {sales.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-6 text-gray-500 font-medium">{sale.sold_at}</td>
                    <td className="p-6">
                      <div className="flex items-center gap-2.5">
                        <span className="bg-primary/10 text-primary text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                          {sale.tickets?.product_types?.platforms?.name}
                        </span>
                        <span className="font-extrabold text-gray-900 text-base">{sale.tickets?.product_types?.name}</span>
                      </div>
                    </td>
                    <td className="p-6 text-gray-500 font-medium">¥{sale.tickets?.cost_price.toFixed(2)}</td>
                    <td className="p-6 font-bold text-gray-900">¥{sale.sell_price.toFixed(2)}</td>
                    <td className="p-6 font-bold text-gray-900">{sale.quantity}</td>
                    <td className="p-6">
                      <span className={sale.profit >= 0 ? 'text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl' : 'text-red-600 font-bold bg-red-50 px-3 py-1.5 rounded-xl'}>
                        {sale.profit >= 0 ? '+' : ''}{sale.profit.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <Button variant="ghost" size="sm" className="text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded-full font-medium shadow-sm border border-transparent hover:border-orange-100" onClick={() => setUndoConfirm(sale)}>
                        <Undo2 className="w-4 h-4 mr-1.5" />
                        撤销
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Undo Confirmation Dialog */}
      <Dialog open={!!undoConfirm} onOpenChange={(open) => !open && setUndoConfirm(null)}>
        <DialogContent className="rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-orange-600 text-xl">确认撤销该笔售出?</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-gray-600 leading-relaxed">
            <p>您即将撤销售出 <strong className="text-gray-900">{undoConfirm?.tickets?.product_types?.name}</strong> 共 <strong className="text-gray-900">{undoConfirm?.quantity}</strong> 张。</p>
            <p className="mt-3 text-sm bg-orange-50 text-orange-700 p-4 rounded-2xl border border-orange-100/50">撤销后，该笔记录将被删除，对应的利润会扣除，且 {undoConfirm?.quantity} 张库存将自动退回。</p>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setUndoConfirm(null)} className="rounded-2xl h-12 px-6 border-gray-200">取消</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white rounded-2xl h-12 px-6 shadow-lg shadow-orange-500/20 font-bold" onClick={handleUndoSale}>确认撤销</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}