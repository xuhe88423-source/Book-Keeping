import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface SaleWithDetails {
  id: string;
  ticket_id: string;
  sell_price: number;
  quantity: number;
  profit: number;
  sold_at: string;
  created_at: string;
  tickets: {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-2xl font-bold">销售明细</h2>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium whitespace-nowrap">日期筛选:</label>
          <Input 
            type="date" 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)} 
            className="w-auto"
          />
          {dateFilter && (
            <button 
              onClick={() => setDateFilter('')}
              className="text-sm text-blue-600 hover:underline whitespace-nowrap"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">加载中...</div>
      ) : sales.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          {dateFilter ? '该日期暂无销售记录' : '暂无销售记录'}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile View: Cards */}
          <div className="grid grid-cols-1 md:hidden gap-4">
            {sales.map(sale => (
              <Card key={sale.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full mr-2">
                        {sale.tickets?.product_types?.platforms?.name}
                      </span>
                      <span className="font-bold">{sale.tickets?.product_types?.name}</span>
                    </div>
                    <span className="text-sm text-gray-500">{sale.sold_at}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                    <div>
                      <span className="text-gray-500">售出单价: </span>
                      ¥{sale.sell_price.toFixed(2)}
                    </div>
                    <div>
                      <span className="text-gray-500">数量: </span>
                      {sale.quantity}
                    </div>
                    <div>
                      <span className="text-gray-500">成本单价: </span>
                      ¥{sale.tickets?.cost_price.toFixed(2)}
                    </div>
                    <div>
                      <span className="text-gray-500">本单利润: </span>
                      <span className={sale.profit >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                        {sale.profit >= 0 ? '+' : ''}{sale.profit.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* PC View: Table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-4 font-medium text-gray-600">售出日期</th>
                  <th className="p-4 font-medium text-gray-600">平台 / 商品名称</th>
                  <th className="p-4 font-medium text-gray-600">成本单价</th>
                  <th className="p-4 font-medium text-gray-600">售出单价</th>
                  <th className="p-4 font-medium text-gray-600">数量</th>
                  <th className="p-4 font-medium text-gray-600 text-right">本单利润</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50/50">
                    <td className="p-4">{sale.sold_at}</td>
                    <td className="p-4">
                      <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full mr-2">
                        {sale.tickets?.product_types?.platforms?.name}
                      </span>
                      {sale.tickets?.product_types?.name}
                    </td>
                    <td className="p-4">¥{sale.tickets?.cost_price.toFixed(2)}</td>
                    <td className="p-4">¥{sale.sell_price.toFixed(2)}</td>
                    <td className="p-4">{sale.quantity}</td>
                    <td className="p-4 text-right">
                      <span className={sale.profit >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                        {sale.profit >= 0 ? '+' : ''}{sale.profit.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
