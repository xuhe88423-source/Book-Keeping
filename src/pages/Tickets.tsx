import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Platform, Ticket } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Tag, Store, Minus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function Tickets() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Forms state
  const [isAddPlatformOpen, setIsAddPlatformOpen] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');

  const [isAddProductTypeOpen, setIsAddProductTypeOpen] = useState(false);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null);
  const [newProductTypeName, setNewProductTypeName] = useState('');

  const [isAddTicketOpen, setIsAddTicketOpen] = useState(false);
  const [selectedProductTypeId, setSelectedProductTypeId] = useState<string | null>(null);
  const [newTicket, setNewTicket] = useState({ cost_price: '', quantity: '' });

  const [isSellOpen, setIsSellOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [sellData, setSellData] = useState({ sell_price: '', quantity: '', sold_at: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      // Fetch nested data: platforms -> product_types -> tickets
      const { data, error } = await supabase
        .from('platforms')
        .select(`
          *,
          product_types (
            *,
            tickets (*)
          )
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Sort nested arrays
      if (data) {
        data.forEach(p => {
          if (p.product_types) {
            p.product_types.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            p.product_types.forEach((pt: any) => {
              if (pt.tickets) {
                pt.tickets.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              }
            });
          }
        });
      }
      
      setPlatforms(data || []);
    } catch (error: any) {
      toast.error('获取库存数据失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPlatform(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { error } = await supabase.from('platforms').insert([{ name: newPlatformName }]);
      if (error) throw error;
      toast.success('平台创建成功');
      setIsAddPlatformOpen(false);
      setNewPlatformName('');
      fetchData();
    } catch (error: any) {
      toast.error('创建失败: ' + error.message);
    }
  }

  async function handleAddProductType(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlatformId) return;
    try {
      const { error } = await supabase.from('product_types').insert([
        { platform_id: selectedPlatformId, name: newProductTypeName }
      ]);
      if (error) throw error;
      toast.success('商品类型创建成功');
      setIsAddProductTypeOpen(false);
      setNewProductTypeName('');
      fetchData();
    } catch (error: any) {
      toast.error('创建失败: ' + error.message);
    }
  }

  async function handleAddTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProductTypeId) return;
    try {
      const { error } = await supabase.from('tickets').insert([
        {
          product_type_id: selectedProductTypeId,
          cost_price: parseFloat(newTicket.cost_price),
          quantity: parseInt(newTicket.quantity),
        }
      ]);
      if (error) throw error;
      toast.success('优惠券添加成功');
      setIsAddTicketOpen(false);
      setNewTicket({ cost_price: '', quantity: '' });
      fetchData();
    } catch (error: any) {
      toast.error('添加失败: ' + error.message);
    }
  }

  async function handleSellTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTicket) return;

    const sellQty = parseInt(sellData.quantity);
    if (sellQty > selectedTicket.quantity) {
      toast.error('售出数量不能大于库存数量');
      return;
    }

    try {
      const sellPrice = parseFloat(sellData.sell_price);
      const profit = (sellPrice - selectedTicket.cost_price) * sellQty;

      const { error: saleError } = await supabase.from('sales').insert([
        {
          ticket_id: selectedTicket.id,
          sell_price: sellPrice,
          quantity: sellQty,
          profit: profit,
          sold_at: sellData.sold_at,
        },
      ]);
      if (saleError) throw saleError;

      const { error: ticketError } = await supabase
        .from('tickets')
        .update({ quantity: selectedTicket.quantity - sellQty })
        .eq('id', selectedTicket.id);
        
      if (ticketError) throw ticketError;

      toast.success('售出记录添加成功');
      setIsSellOpen(false);
      setSellData({ sell_price: '', quantity: '', sold_at: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch (error: any) {
      toast.error('售出失败: ' + error.message);
    }
  }

  async function handleQuickAdd(ticket: Ticket) {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ quantity: ticket.quantity + 1 })
        .eq('id', ticket.id);

      if (error) throw error;
      toast.success('已快速增加 1 张');
      fetchData();
    } catch (error: any) {
      toast.error('增加数量失败: ' + error.message);
    }
  }

  async function handleQuickDecrease(ticket: Ticket) {
    if (ticket.quantity <= 0) {
      toast.error('库存已为 0，无法减少');
      return;
    }
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ quantity: ticket.quantity - 1 })
        .eq('id', ticket.id);

      if (error) throw error;
      toast.success('已快速减少 1 张');
      fetchData();
    } catch (error: any) {
      toast.error('减少数量失败: ' + error.message);
    }
  }

  // Calculate total quantity for a product type
  const getTotalQuantity = (tickets?: Ticket[]) => {
    if (!tickets) return 0;
    return tickets.reduce((sum, t) => sum + t.quantity, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">票据库存</h2>
        
        <Dialog open={isAddPlatformOpen} onOpenChange={setIsAddPlatformOpen}>
          <DialogTrigger
            render={
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                新增平台
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新增平台</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddPlatform} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">平台名称</label>
                <Input required placeholder="如：淘宝、美团" value={newPlatformName} onChange={e => setNewPlatformName(e.target.value)} />
              </div>
              <Button type="submit" className="w-full">保存</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">加载中...</div>
      ) : platforms.length === 0 ? (
        <div className="text-center py-10 text-gray-500">暂无数据，请先新增平台。</div>
      ) : (
        <Accordion className="space-y-4" defaultValue={platforms.map(p => p.id)}>
          {platforms.map(platform => (
            <AccordionItem value={platform.id} key={platform.id} className="bg-white border rounded-lg px-4 shadow-sm">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-2 text-lg font-bold text-gray-800">
                  <Store className="w-5 h-5 text-primary" />
                  {platform.name}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-4">
                
                <div className="flex justify-end">
                  <Dialog open={isAddProductTypeOpen && selectedPlatformId === platform.id} onOpenChange={(open) => {
                    setIsAddProductTypeOpen(open);
                    if (open) setSelectedPlatformId(platform.id);
                  }}>
                    <DialogTrigger
                      render={
                        <Button variant="outline" size="sm" className="gap-2">
                          <Plus className="w-4 h-4" />
                          新增商品类型
                        </Button>
                      }
                    />
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>新增商品类型 - {platform.name}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddProductType} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">商品名称</label>
                          <Input required placeholder="如：100元代金券" value={newProductTypeName} onChange={e => setNewProductTypeName(e.target.value)} />
                        </div>
                        <Button type="submit" className="w-full">保存</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                {(!platform.product_types || platform.product_types.length === 0) ? (
                   <div className="text-center py-4 text-sm text-gray-500">该平台下暂无商品类型</div>
                ) : (
                  <Accordion className="space-y-3" defaultValue={platform.product_types.map(pt => pt.id)}>
                    {platform.product_types.map(pt => {
                      const totalQty = getTotalQuantity(pt.tickets);
                      return (
                        <AccordionItem value={pt.id} key={pt.id} className="bg-gray-50 border border-gray-100 rounded-md px-4">
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex justify-between items-center w-full pr-4">
                              <div className="flex items-center gap-2 font-semibold text-gray-700">
                                <Tag className="w-4 h-4 text-blue-500" />
                                {pt.name}
                              </div>
                              <div className="text-sm font-normal text-gray-500 bg-gray-200 px-2 py-1 rounded-md">
                                总库存: <span className="font-bold text-gray-800">{totalQty}</span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-2 pb-3">
                            <div className="space-y-3">
                              
                              <div className="flex justify-end">
                                <Dialog open={isAddTicketOpen && selectedProductTypeId === pt.id} onOpenChange={(open) => {
                                  setIsAddTicketOpen(open);
                                  if (open) setSelectedProductTypeId(pt.id);
                                }}>
                                  <DialogTrigger
                                    render={
                                      <Button variant="secondary" size="sm" className="gap-1 h-7 text-xs">
                                        <Plus className="w-3 h-3" />
                                        添加具体优惠券
                                      </Button>
                                    }
                                  />
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>添加优惠券 - {pt.name}</DialogTitle>
                                    </DialogHeader>
                                    <form onSubmit={handleAddTicket} className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <label className="text-sm font-medium">成本价 (元)</label>
                                          <Input required type="number" step="0.01" min="0" value={newTicket.cost_price} onChange={e => setNewTicket({...newTicket, cost_price: e.target.value})} />
                                        </div>
                                        <div className="space-y-2">
                                          <label className="text-sm font-medium">初始数量</label>
                                          <Input required type="number" min="1" value={newTicket.quantity} onChange={e => setNewTicket({...newTicket, quantity: e.target.value})} />
                                        </div>
                                      </div>
                                      <Button type="submit" className="w-full">保存</Button>
                                    </form>
                                  </DialogContent>
                                </Dialog>
                              </div>

                              {(!pt.tickets || pt.tickets.length === 0) ? (
                                <div className="text-center py-2 text-xs text-gray-400">暂无具体优惠券记录</div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {pt.tickets.map(ticket => (
                                    <Card key={ticket.id} className="shadow-sm border-gray-200">
                                      <CardContent className="p-3">
                                        <div className="flex justify-between items-center mb-3">
                                          <div className="text-sm font-medium text-gray-500">
                                            成本: <span className="text-gray-900 font-bold text-lg">¥{ticket.cost_price.toFixed(2)}</span>
                                          </div>
                                          <div className="text-sm flex items-center gap-1">
                                            剩余: 
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-6 w-6 rounded-full hover:bg-red-50 hover:text-red-600 ml-1"
                                              onClick={() => handleQuickDecrease(ticket)}
                                              title="快速减少1张"
                                              disabled={ticket.quantity <= 0}
                                            >
                                              <Minus className="w-3 h-3" />
                                            </Button>
                                            <span className="font-bold text-gray-900 min-w-[20px] text-center">{ticket.quantity}</span>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-6 w-6 rounded-full hover:bg-blue-50 hover:text-blue-600"
                                              onClick={() => handleQuickAdd(ticket)}
                                              title="快速增加1张"
                                            >
                                              <Plus className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        </div>
                                        
                                        <Dialog open={isSellOpen && selectedTicket?.id === ticket.id} onOpenChange={(open) => {
                                          setIsSellOpen(open);
                                          if (open) setSelectedTicket(ticket);
                                          else setSelectedTicket(null);
                                        }}>
                                          <DialogTrigger
                                            render={
                                              <Button variant="default" className="w-full" size="sm" disabled={ticket.quantity <= 0}>
                                                {ticket.quantity > 0 ? '售出' : '已售罄'}
                                              </Button>
                                            }
                                          />
                                          <DialogContent>
                                            <DialogHeader>
                                              <DialogTitle>售出票据 - {pt.name} (成本: ¥{ticket.cost_price})</DialogTitle>
                                            </DialogHeader>
                                            <form onSubmit={handleSellTicket} className="space-y-4">
                                              <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                  <label className="text-sm font-medium">卖出单价 (元)</label>
                                                  <Input required type="number" step="0.01" value={sellData.sell_price} onChange={e => setSellData({...sellData, sell_price: e.target.value})} />
                                                </div>
                                                <div className="space-y-2">
                                                  <label className="text-sm font-medium">售出数量 (最多 {ticket.quantity})</label>
                                                  <Input required type="number" min="1" max={ticket.quantity} value={sellData.quantity} onChange={e => setSellData({...sellData, quantity: e.target.value})} />
                                                </div>
                                              </div>
                                              <div className="space-y-2">
                                                <label className="text-sm font-medium">售出日期</label>
                                                <Input required type="date" value={sellData.sold_at} onChange={e => setSellData({...sellData, sold_at: e.target.value})} />
                                              </div>
                                              <Button type="submit" className="w-full">确认售出</Button>
                                            </form>
                                          </DialogContent>
                                        </Dialog>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
