import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Platform, Ticket } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Tag, Store, Minus, Pencil, Trash2, AlertCircle } from 'lucide-react';
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

  // Edit & Delete state
  const [editPlatform, setEditPlatform] = useState<{id: string, name: string} | null>(null);
  const [editProductType, setEditProductType] = useState<{id: string, name: string} | null>(null);
  const [editTicketCost, setEditTicketCost] = useState<{id: string, cost_price: string} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'platform' | 'product_type' | 'ticket', id: string, name?: string} | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
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

  // ---- Add Handlers ----
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

  // ---- Sell Handler ----
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

  // ---- Edit Handlers ----
  async function handleEditPlatform(e: React.FormEvent) {
    e.preventDefault();
    if (!editPlatform) return;
    try {
      const { error } = await supabase.from('platforms').update({ name: editPlatform.name }).eq('id', editPlatform.id);
      if (error) throw error;
      toast.success('修改成功');
      setEditPlatform(null);
      fetchData();
    } catch (error: any) {
      toast.error('修改失败: ' + error.message);
    }
  }

  async function handleEditProductType(e: React.FormEvent) {
    e.preventDefault();
    if (!editProductType) return;
    try {
      const { error } = await supabase.from('product_types').update({ name: editProductType.name }).eq('id', editProductType.id);
      if (error) throw error;
      toast.success('修改成功');
      setEditProductType(null);
      fetchData();
    } catch (error: any) {
      toast.error('修改失败: ' + error.message);
    }
  }

  async function handleEditTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!editTicketCost) return;
    try {
      const { error } = await supabase.from('tickets').update({ cost_price: parseFloat(editTicketCost.cost_price) }).eq('id', editTicketCost.id);
      if (error) throw error;
      toast.success('成本价修改成功');
      setEditTicketCost(null);
      fetchData();
    } catch (error: any) {
      toast.error('修改失败: ' + error.message);
    }
  }

  // ---- Delete Handler ----
  async function handleDelete() {
    if (!deleteConfirm) return;
    try {
      let table = '';
      if (deleteConfirm.type === 'platform') table = 'platforms';
      else if (deleteConfirm.type === 'product_type') table = 'product_types';
      else if (deleteConfirm.type === 'ticket') table = 'tickets';

      const { error } = await supabase.from(table).delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      toast.success('删除成功');
      setDeleteConfirm(null);
      fetchData();
    } catch (error: any) {
      toast.error('删除失败: ' + error.message);
    }
  }

  // ---- Quick Adjust Handlers ----
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

  const getTotalQuantity = (tickets?: Ticket[]) => {
    if (!tickets) return 0;
    return tickets.reduce((sum, t) => sum + t.quantity, 0);
  };

  const getPlatformTotalQuantity = (platform: Platform) => {
    if (!platform.product_types) return 0;
    return platform.product_types.reduce((sum, pt) => sum + getTotalQuantity(pt.tickets), 0);
  };

  const getPlatformTheme = (index: number) => {
    const themes = [
      { icon: 'bg-gradient-to-br from-blue-500 to-indigo-600', card: 'bg-blue-50/40 border-blue-100/50' },
      { icon: 'bg-gradient-to-br from-emerald-400 to-teal-500', card: 'bg-emerald-50/40 border-emerald-100/50' },
      { icon: 'bg-gradient-to-br from-rose-400 to-red-500', card: 'bg-rose-50/40 border-rose-100/50' },
      { icon: 'bg-gradient-to-br from-amber-400 to-orange-500', card: 'bg-amber-50/40 border-amber-100/50' },
      { icon: 'bg-gradient-to-br from-purple-500 to-fuchsia-600', card: 'bg-purple-50/40 border-purple-100/50' },
    ];
    return themes[index % themes.length];
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">票据库存</h2>
        
        <Dialog open={isAddPlatformOpen} onOpenChange={setIsAddPlatformOpen}>
          <DialogTrigger
            render={
              <Button className="gap-2 rounded-full shadow-lg shadow-primary/20 px-5 font-semibold">
                <Plus className="w-4 h-4" />
                新增平台
              </Button>
            }
          />
          <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100">
            <DialogHeader>
              <DialogTitle className="text-gray-900">新增平台</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddPlatform} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">平台名称</label>
                <Input required placeholder="如：淘宝、美团" value={newPlatformName} onChange={e => setNewPlatformName(e.target.value)} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary" />
              </div>
              <Button type="submit" className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20">保存</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 font-medium">加载中...</div>
      ) : platforms.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] font-medium border border-white/50">暂无数据，请先新增平台。</div>
      ) : (
        <Accordion className="space-y-6" defaultValue={platforms.map(p => p.id)}>
          {platforms.map((platform, idx) => {
            const theme = getPlatformTheme(idx);
            const platformTotal = getPlatformTotalQuantity(platform);
            return (
            <AccordionItem value={platform.id} key={platform.id} className={`backdrop-blur-xl border rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden ${theme.card}`}>
              <AccordionTrigger className="hover:no-underline py-5 px-6">
                <div className="flex justify-between items-center w-full pr-2">
                  <div className="flex items-center gap-4 text-xl font-bold text-gray-900 tracking-tight">
                    <div className={`w-12 h-12 ${theme.icon} rounded-[1.25rem] flex items-center justify-center shadow-inner`}>
                      <Store className="w-6 h-6 text-white" />
                    </div>
                    {platform.name}
                  </div>
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <div className="text-sm font-medium text-gray-600 bg-white/60 shadow-sm px-3 py-1.5 rounded-full border border-white/80">
                      总计: <span className="font-bold text-gray-900">{platformTotal}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-gray-400 hover:text-primary hover:bg-primary/10" onClick={() => setEditPlatform({id: platform.id, name: platform.name})}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-gray-400 hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm({type: 'platform', id: platform.id, name: platform.name})}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 px-6 space-y-6 border-t border-gray-100/50 mt-2">
                
                <div className="flex justify-end">
                  <Dialog open={isAddProductTypeOpen && selectedPlatformId === platform.id} onOpenChange={(open) => {
                    setIsAddProductTypeOpen(open);
                    if (open) setSelectedPlatformId(platform.id);
                  }}>
                    <DialogTrigger
                      render={
                        <Button variant="secondary" size="sm" className="gap-2 rounded-full shadow-sm bg-gray-100 hover:bg-gray-200 text-gray-700">
                          <Plus className="w-4 h-4" />
                          新增商品类型
                        </Button>
                      }
                    />
                    <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100">
                      <DialogHeader>
                        <DialogTitle className="text-gray-900">新增商品类型 - {platform.name}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddProductType} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">商品名称</label>
                          <Input required placeholder="如：100元代金券" value={newProductTypeName} onChange={e => setNewProductTypeName(e.target.value)} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary" />
                        </div>
                        <Button type="submit" className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20">保存</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                {(!platform.product_types || platform.product_types.length === 0) ? (
                   <div className="text-center py-5 text-sm text-gray-400 bg-gray-50/50 rounded-2xl">该平台下暂无商品类型</div>
                ) : (
                  <Accordion className="space-y-3" defaultValue={platform.product_types.map(pt => pt.id)}>
                    {platform.product_types.map(pt => {
                      const totalQty = getTotalQuantity(pt.tickets);
                      return (
                        <AccordionItem value={pt.id} key={pt.id} className="bg-gray-50/80 backdrop-blur-md border border-white/60 rounded-2xl px-3 sm:px-4 overflow-hidden shadow-sm">
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex justify-between items-center w-full pr-1">
                              <div className="flex items-center gap-2 font-semibold text-gray-800 text-base">
                                <div className="p-1.5 bg-blue-100/50 text-blue-600 rounded-lg">
                                  <Tag className="w-3.5 h-3.5" />
                                </div>
                                <span className="truncate max-w-[120px] sm:max-w-[200px]">{pt.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <div className="text-xs font-medium text-gray-600 bg-white shadow-sm px-2 py-0.5 rounded-full border border-gray-100">
                                  总计: <span className="font-bold text-gray-900">{totalQty}</span>
                                </div>
                                <div className="flex items-center">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-gray-400 hover:text-primary hover:bg-primary/10" onClick={() => setEditProductType({id: pt.id, name: pt.name})}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-gray-400 hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm({type: 'product_type', id: pt.id, name: pt.name})}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-1 pb-4">
                            <div className="space-y-3">
                              
                              <div className="flex justify-end">
                                <Dialog open={isAddTicketOpen && selectedProductTypeId === pt.id} onOpenChange={(open) => {
                                  setIsAddTicketOpen(open);
                                  if (open) setSelectedProductTypeId(pt.id);
                                }}>
                                  <DialogTrigger
                                    render={
                                      <Button variant="outline" size="sm" className="gap-1 h-7 text-xs rounded-lg border-gray-200 bg-white shadow-sm font-medium px-3">
                                        <Plus className="w-3 h-3" />
                                        添加进货
                                      </Button>
                                    }
                                  />
                                  <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100">
                                    <DialogHeader>
                                      <DialogTitle className="text-gray-900">添加优惠券 - {pt.name}</DialogTitle>
                                    </DialogHeader>
                                    <form onSubmit={handleAddTicket} className="space-y-5 mt-2">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <label className="text-sm font-medium text-gray-700">成本价 (元)</label>
                                          <Input required type="number" step="0.01" min="0" value={newTicket.cost_price} onChange={e => setNewTicket({...newTicket, cost_price: e.target.value})} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary" />
                                        </div>
                                        <div className="space-y-2">
                                          <label className="text-sm font-medium text-gray-700">初始数量</label>
                                          <Input required type="number" min="1" value={newTicket.quantity} onChange={e => setNewTicket({...newTicket, quantity: e.target.value})} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary" />
                                        </div>
                                      </div>
                                      <Button type="submit" className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20">保存</Button>
                                    </form>
                                  </DialogContent>
                                </Dialog>
                              </div>

                              {(!pt.tickets || pt.tickets.length === 0) ? (
                                <div className="text-center py-3 text-xs text-gray-400">暂无具体优惠券记录</div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {pt.tickets.map(ticket => (
                                    <div key={ticket.id} className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100 flex flex-col gap-3">
                                      
                                      {/* Top: Price & Delete */}
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <div className="text-xs text-gray-400 font-medium mb-1">成本单价</div>
                                          <div className="flex items-center gap-1">
                                            <span className="text-2xl font-bold text-gray-900 tracking-tight">¥{ticket.cost_price.toFixed(2)}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-gray-400 hover:text-primary hover:bg-primary/10" onClick={() => setEditTicketCost({id: ticket.id, cost_price: ticket.cost_price.toString()})}>
                                              <Pencil className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-400 hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm({type: 'ticket', id: ticket.id})}>
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>

                                      {/* Bottom: Quantity & Sell */}
                                      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                                        
                                        {/* Quantity Control */}
                                        <div className="flex items-center gap-3">
                                          <span className="text-xs text-gray-500 font-medium">库存</span>
                                          <div className="flex items-center bg-gray-100/80 rounded-full p-1">
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-7 w-7 rounded-full bg-white shadow-sm text-gray-700 hover:text-destructive"
                                              onClick={() => handleQuickDecrease(ticket)}
                                              disabled={ticket.quantity <= 0}
                                            >
                                              <Minus className="w-3.5 h-3.5" />
                                            </Button>
                                            <span className="w-8 text-center font-bold text-gray-900 text-sm">{ticket.quantity}</span>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-7 w-7 rounded-full bg-white shadow-sm text-gray-700 hover:text-primary"
                                              onClick={() => handleQuickAdd(ticket)}
                                            >
                                              <Plus className="w-3.5 h-3.5" />
                                            </Button>
                                          </div>
                                        </div>

                                        {/* Sell Button */}
                                        <Dialog open={isSellOpen && selectedTicket?.id === ticket.id} onOpenChange={(open) => {
                                          setIsSellOpen(open);
                                          if (open) setSelectedTicket(ticket);
                                          else setSelectedTicket(null);
                                        }}>
                                          <DialogTrigger
                                            render={
                                              <Button variant="default" size="sm" className="h-9 px-5 rounded-xl font-bold shadow-md shadow-primary/20" disabled={ticket.quantity <= 0}>
                                                {ticket.quantity > 0 ? '售出' : '已售罄'}
                                              </Button>
                                            }
                                          />
                                          <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100">
                                            <DialogHeader>
                                              <DialogTitle className="text-gray-900">售出票据 - {pt.name} (成本: ¥{ticket.cost_price})</DialogTitle>
                                            </DialogHeader>
                                            <form onSubmit={handleSellTicket} className="space-y-4">
                                              <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                  <label className="text-sm font-medium">卖出单价 (元)</label>
                                                  <Input required type="number" step="0.01" value={sellData.sell_price} onChange={e => setSellData({...sellData, sell_price: e.target.value})} className="rounded-xl" />
                                                </div>
                                                <div className="space-y-2">
                                                  <label className="text-sm font-medium">售出数量 (最多 {ticket.quantity})</label>
                                                  <Input required type="number" min="1" max={ticket.quantity} value={sellData.quantity} onChange={e => setSellData({...sellData, quantity: e.target.value})} className="rounded-xl" />
                                                </div>
                                              </div>
                                              <div className="space-y-2">
                                                <label className="text-sm font-medium">售出日期</label>
                                                <Input required type="date" value={sellData.sold_at} onChange={e => setSellData({...sellData, sold_at: e.target.value})} className="rounded-xl" />
                                              </div>
                                              <Button type="submit" className="w-full rounded-full">确认售出</Button>
                                            </form>
                                          </DialogContent>
                                        </Dialog>

                                      </div>
                                    </div>
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
            );
          })}
        </Accordion>
      )}

      {/* Edit Platform Dialog */}
      <Dialog open={!!editPlatform} onOpenChange={(open) => !open && setEditPlatform(null)}>
        <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100">
          <DialogHeader><DialogTitle className="text-gray-900">修改平台名称</DialogTitle></DialogHeader>
          <form onSubmit={handleEditPlatform} className="space-y-4">
            <Input required value={editPlatform?.name || ''} onChange={e => setEditPlatform(prev => prev ? {...prev, name: e.target.value} : null)} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20" />
            <Button type="submit" className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20">保存</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Type Dialog */}
      <Dialog open={!!editProductType} onOpenChange={(open) => !open && setEditProductType(null)}>
        <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100">
          <DialogHeader><DialogTitle className="text-gray-900">修改商品名称</DialogTitle></DialogHeader>
          <form onSubmit={handleEditProductType} className="space-y-4">
            <Input required value={editProductType?.name || ''} onChange={e => setEditProductType(prev => prev ? {...prev, name: e.target.value} : null)} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20" />
            <Button type="submit" className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20">保存</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Ticket Cost Dialog */}
      <Dialog open={!!editTicketCost} onOpenChange={(open) => !open && setEditTicketCost(null)}>
        <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100">
          <DialogHeader><DialogTitle className="text-gray-900">修改成本价</DialogTitle></DialogHeader>
          <form onSubmit={handleEditTicket} className="space-y-4">
            <Input required type="number" step="0.01" min="0" value={editTicketCost?.cost_price || ''} onChange={e => setEditTicketCost(prev => prev ? {...prev, cost_price: e.target.value} : null)} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20" />
            <Button type="submit" className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20">保存</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-destructive/20">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              确认删除?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-gray-600 leading-relaxed">
            {deleteConfirm?.type === 'platform' && <p className="text-sm mt-3 bg-destructive/10 text-destructive p-4 rounded-2xl border border-destructive/20 font-medium">您即将删除平台 <strong>{deleteConfirm.name}</strong>。此操作将同时永久删除该平台下的所有商品、优惠券以及关联的售出明细记录！</p>}
            {deleteConfirm?.type === 'product_type' && <p className="text-sm mt-3 bg-destructive/10 text-destructive p-4 rounded-2xl border border-destructive/20 font-medium">您即将删除商品 <strong>{deleteConfirm.name}</strong>。此操作将同时永久删除该商品下的所有优惠券库存以及关联的售出明细记录！</p>}
            {deleteConfirm?.type === 'ticket' && <p className="text-sm mt-3 bg-destructive/10 text-destructive p-4 rounded-2xl border border-destructive/20 font-medium">您即将删除该条优惠券进货记录。此操作将同时永久删除关联的售出明细记录！</p>}
            <p className="mt-3 text-sm font-bold text-gray-900">此操作不可恢复，是否继续？</p>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-xl h-12 px-6 border-gray-200">取消</Button>
            <Button variant="destructive" onClick={handleDelete} className="rounded-xl h-12 px-6 font-bold shadow-lg shadow-destructive/20">确认删除</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}