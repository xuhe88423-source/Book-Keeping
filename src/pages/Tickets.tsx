import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Platform, Ticket, GlobalProduct } from '@/types';
import { Button } from '@/components/ui/button';
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
import { useError } from '@/contexts/ErrorContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function Tickets() {
  const { showDbError } = useError();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [globalProducts, setGlobalProducts] = useState<GlobalProduct[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Forms state
  const [isAddPlatformOpen, setIsAddPlatformOpen] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');

  const [isAddTicketOpen, setIsAddTicketOpen] = useState(false);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [newTicket, setNewTicket] = useState({ cost_price: '', quantity: '' });

  // Edit & Delete state
  const [editPlatform, setEditPlatform] = useState<{id: string, name: string} | null>(null);
  const [editTicketCost, setEditTicketCost] = useState<{id: string, cost_price: string} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'platform' | 'ticket', id: string, name?: string} | null>(null);

  // Accordion state
  const [expandedPlatforms, setExpandedPlatforms] = useState<string[] | null>(() => {
    const saved = localStorage.getItem('expandedPlatforms');
    return saved ? JSON.parse(saved) : null;
  });
  const [expandedProducts, setExpandedProducts] = useState<string[] | null>(() => {
    const saved = localStorage.getItem('expandedProducts');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (expandedPlatforms !== null) {
      localStorage.setItem('expandedPlatforms', JSON.stringify(expandedPlatforms));
    }
  }, [expandedPlatforms]);

  useEffect(() => {
    if (expandedProducts !== null) {
      localStorage.setItem('expandedProducts', JSON.stringify(expandedProducts));
    }
  }, [expandedProducts]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [platformsRes, productsRes, ticketsRes] = await Promise.all([
        supabase.from('platforms').select('*').order('created_at', { ascending: true }),
        supabase.from('global_products').select('*').order('created_at', { ascending: true }),
        supabase.from('tickets').select('*').order('created_at', { ascending: true })
      ]);

      if (platformsRes.error) throw platformsRes.error;
      if (productsRes.error) throw productsRes.error;
      if (ticketsRes.error) throw ticketsRes.error;
      
      setPlatforms(platformsRes.data || []);
      setGlobalProducts(productsRes.data || []);
      setTickets(ticketsRes.data || []);
      
      // Default expand all if not set in local storage yet
      setExpandedPlatforms(prev => prev === null ? (platformsRes.data || []).map(p => p.id) : prev);
      setExpandedProducts(prev => prev === null ? (productsRes.data || []).map(pt => pt.id) : prev);
    } catch (error: any) {
      if (error?.message === 'Failed to fetch' || error?.code === 'PGRST301' || !navigator.onLine) {
        showDbError();
      } else {
        toast.error('获取库存数据失败: ' + error.message);
      }
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

  async function handleAddTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlatformId || !selectedProductId) return;
    try {
      const { error } = await supabase.from('tickets').insert([
        {
          platform_id: selectedPlatformId,
          global_product_id: selectedProductId,
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
      toast.error('库存已为 0');
      return;
    }
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ quantity: ticket.quantity - 1 })
        .eq('id', ticket.id);

      if (error) throw error;
      
      if (ticket.quantity - 1 === 0) {
        toast.success('票据数量为0，已自动隐藏');
      } else {
        toast.success('已快速减少 1 张');
      }
      fetchData();
    } catch (error: any) {
      toast.error('减少数量失败: ' + error.message);
    }
  }

  const getPlatformTotalQuantity = (platformId: string) => {
    return tickets.filter(t => t.platform_id === platformId).reduce((sum, t) => sum + t.quantity, 0);
  };

  const getProductTicketsInPlatform = (platformId: string, productId: string) => {
    return tickets.filter(t => t.platform_id === platformId && t.global_product_id === productId);
  };

  const getPlatformTheme = (index: number) => {
    const themes = [
      { icon: 'bg-gradient-to-br from-blue-500 to-indigo-600', card: 'bg-blue-100/90 border-blue-200/80', dot: 'bg-blue-500', text: 'text-blue-900', countBg: 'bg-blue-200/50' },
      { icon: 'bg-gradient-to-br from-emerald-400 to-teal-500', card: 'bg-emerald-100/90 border-emerald-200/80', dot: 'bg-emerald-500', text: 'text-emerald-900', countBg: 'bg-emerald-200/50' },
      { icon: 'bg-gradient-to-br from-rose-400 to-red-500', card: 'bg-rose-100/90 border-rose-200/80', dot: 'bg-rose-500', text: 'text-rose-900', countBg: 'bg-rose-200/50' },
      { icon: 'bg-gradient-to-br from-amber-400 to-orange-500', card: 'bg-amber-100/90 border-amber-200/80', dot: 'bg-amber-500', text: 'text-amber-900', countBg: 'bg-amber-200/50' },
      { icon: 'bg-gradient-to-br from-purple-500 to-fuchsia-600', card: 'bg-purple-100/90 border-purple-200/80', dot: 'bg-purple-500', text: 'text-purple-900', countBg: 'bg-purple-200/50' },
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
        <Accordion multiple className="space-y-6" value={expandedPlatforms || []} onValueChange={setExpandedPlatforms}>
          {platforms.map((platform, idx) => {
            const theme = getPlatformTheme(idx);
            const platformTotal = getPlatformTotalQuantity(platform.id);
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

                {globalProducts.length === 0 ? (
                   <div className="text-center py-5 text-sm text-gray-400 bg-gray-50/50 rounded-2xl">暂无全局商品，请在数据看板中创建</div>
                ) : (
                  <Accordion multiple className="space-y-3" value={expandedProducts || []} onValueChange={setExpandedProducts}>
                    {globalProducts.map(pt => {
                      const ptTickets = getProductTicketsInPlatform(platform.id, pt.id);
                      const totalQty = ptTickets.reduce((sum, t) => sum + t.quantity, 0);
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
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-1 pb-4">
                            <div className="space-y-3">
                              
                              <div className="flex justify-end gap-2">
                                <Dialog open={isAddTicketOpen && selectedPlatformId === platform.id && selectedProductId === pt.id} onOpenChange={(open) => {
                                  setIsAddTicketOpen(open);
                                  if (open) {
                                    setSelectedPlatformId(platform.id);
                                    setSelectedProductId(pt.id);
                                  }
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

                              {ptTickets.filter(t => t.quantity > 0).length === 0 ? (
                                <div className="text-center py-3 text-xs text-gray-400">暂无具体优惠券记录</div>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  {ptTickets.filter(t => t.quantity > 0).map(ticket => (
                                    <div key={ticket.id} className="shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100/80 rounded-xl bg-white overflow-hidden p-2.5 sm:p-3 flex items-center justify-between gap-3">
                                        
                                        {/* Left: Price */}
                                        <div className="flex flex-col shrink-0 min-w-[70px]">
                                          <span className="text-[10px] font-medium text-gray-400 leading-none mb-1">成本价</span>
                                          <div className="flex items-center gap-0.5">
                                            <span className="text-gray-900 font-bold text-base tracking-tight leading-none">¥{ticket.cost_price.toFixed(2)}</span>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 rounded-md text-gray-400 hover:text-primary hover:bg-primary/10 shrink-0" onClick={() => setEditTicketCost({id: ticket.id, cost_price: ticket.cost_price.toString()})}>
                                              <Pencil className="w-2.5 h-2.5" />
                                            </Button>
                                          </div>
                                        </div>
                                        
                                        {/* Middle: Quantity Control */}
                                        <div className="flex items-center justify-between bg-gray-50/80 p-0.5 rounded-full w-[95px] shrink-0 ml-auto">
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-gray-700 hover:text-destructive shrink-0"
                                            onClick={() => handleQuickDecrease(ticket)}
                                            disabled={ticket.quantity <= 0}
                                          >
                                            <Minus className="w-3.5 h-3.5" />
                                          </Button>
                                          <span className="font-bold text-gray-900 text-center text-sm flex-1">{ticket.quantity}</span>
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-gray-700 hover:text-primary shrink-0"
                                            onClick={() => handleQuickAdd(ticket)}
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>
                                          
                                        {/* Right: Sell & Delete */}
                                        <div className="flex items-center gap-1 flex-1 justify-end min-w-0">
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