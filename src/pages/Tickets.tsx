import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Platform, Ticket, GlobalProduct } from '@/types';
import { Button } from '@/components/ui/button';
import { Plus, Tag, Store, Pencil, Trash2, AlertCircle, GripVertical } from 'lucide-react';
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableTicketItem({ ticket, index, onClick }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  let baseClass = 'bg-white border-gray-100 hover:border-primary/30 shadow-sm';
  if (ticket.status === 'sold_pending') {
    baseClass = 'bg-gray-50/80 border-gray-200 opacity-90';
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className={`relative flex flex-col items-center justify-center rounded-xl p-1 cursor-pointer border-2 transition-all ${baseClass} h-[52px]`}
      onClick={() => onClick(ticket)}
    >
      {/* 序号 */}
      <div className="absolute top-0.5 left-1.5 text-[10px] font-bold text-gray-400 scale-90 origin-top-left">
        {index + 1}
      </div>

      {/* 状态角标 (待售 / 预约) */}
      {ticket.status === 'active' && (
        <div className="absolute -top-2.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-sm transform rotate-12 z-10">
          待售
        </div>
      )}
      {ticket.status === 'reserved' && (
        <div className="absolute -top-2.5 -right-1.5 bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-sm transform rotate-12 z-10">
          预约
        </div>
      )}

      {/* 价格显示 */}
      <div className={`flex items-center justify-center w-full ${ticket.status === 'sold_pending' ? 'mb-0.5' : ''}`}>
        <span className={`font-extrabold tracking-tight ${
          ticket.status === 'sold_pending' ? 'text-gray-500 text-[11px]' : 'text-gray-900 text-[13px]'
        }`}>
          {Math.floor(ticket.cost_price) === ticket.cost_price ? ticket.cost_price : ticket.cost_price.toFixed(2)}
        </span>
      </div>

      {ticket.status === 'sold_pending' && (
        <div className="absolute bottom-1 right-1 text-[9px] text-gray-400 font-bold scale-90 origin-bottom-right">
          待使用
        </div>
      )}
    </div>
  );
}

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
  const [newTicket, setNewTicket] = useState({ cost_price: '' });

  // Edit & Delete state
  const [editPlatform, setEditPlatform] = useState<{id: string, name: string} | null>(null);
  const [editTicketCost, setEditTicketCost] = useState<{id: string, cost_price: string} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'platform' | 'ticket', id: string, name?: string} | null>(null);
  const [selectedTicketAction, setSelectedTicketAction] = useState<Ticket | null>(null);

  // Accordion state
  const [expandedPlatforms, setExpandedPlatforms] = useState<string[] | null>(() => {
    const saved = localStorage.getItem('expandedPlatforms');
    return saved ? JSON.parse(saved) : null;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (expandedPlatforms !== null) {
      localStorage.setItem('expandedPlatforms', JSON.stringify(expandedPlatforms));
    }
  }, [expandedPlatforms]);

  useEffect(() => {
    fetchData(true);
  }, []);

  async function fetchData(showLoading = true) {
    try {
      if (showLoading) setLoading(true);
      const [platformsRes, productsRes, ticketsRes] = await Promise.all([
        supabase.from('platforms').select('*').order('created_at', { ascending: true }),
        supabase.from('global_products').select('*').order('created_at', { ascending: true }),
        supabase.from('tickets').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
      ]);

      if (platformsRes.error) throw platformsRes.error;
      if (productsRes.error) throw productsRes.error;
      if (ticketsRes.error) throw ticketsRes.error;
      
      setPlatforms(platformsRes.data || []);
      setGlobalProducts(productsRes.data || []);
      setTickets(ticketsRes.data || []);
      
      setExpandedPlatforms(prev => prev === null ? (platformsRes.data || []).map(p => p.id) : prev);
    } catch (error: any) {
      if (error?.message === 'Failed to fetch' || error?.code === 'PGRST301' || !navigator.onLine) {
        showDbError();
      } else {
        toast.error('获取库存数据失败: ' + error.message);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function handleAddPlatform(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('platforms').insert([{ name: newPlatformName }]);
      if (error) throw error;
      toast.success('平台创建成功');
      setIsAddPlatformOpen(false);
      setNewPlatformName('');
      fetchData(false);
    } catch (error: any) {
      toast.error('创建失败: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlatformId || !selectedProductId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const ptTickets = tickets.filter(t => t.platform_id === selectedPlatformId && t.global_product_id === selectedProductId);
      const minSortOrder = ptTickets.length > 0 ? Math.min(...ptTickets.map(t => t.sort_order || 0)) : 0;

      const { error } = await supabase.from('tickets').insert([
        {
          platform_id: selectedPlatformId,
          global_product_id: selectedProductId,
          cost_price: parseFloat(newTicket.cost_price),
          quantity: 1,
          status: 'for_sale',
          sort_order: minSortOrder - 1,
        }
      ]);
      if (error) throw error;
      toast.success('价格单添加成功');
      setIsAddTicketOpen(false);
      setNewTicket({ cost_price: '' });
      fetchData(false);
    } catch (error: any) {
      toast.error('添加失败: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditPlatform(e: React.FormEvent) {
    e.preventDefault();
    if (!editPlatform || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('platforms').update({ name: editPlatform.name }).eq('id', editPlatform.id);
      if (error) throw error;
      toast.success('修改成功');
      setEditPlatform(null);
      fetchData(false);
    } catch (error: any) {
      toast.error('修改失败: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!editTicketCost || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('tickets').update({ cost_price: parseFloat(editTicketCost.cost_price) }).eq('id', editTicketCost.id);
      if (error) throw error;
      toast.success('成本价修改成功');
      setEditTicketCost(null);
      fetchData(false);
    } catch (error: any) {
      toast.error('修改失败: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let table = '';
      if (deleteConfirm.type === 'platform') table = 'platforms';
      else if (deleteConfirm.type === 'ticket') table = 'tickets';

      const { error } = await supabase.from(table).delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      toast.success('删除成功');
      setDeleteConfirm(null);
      fetchData(false);
    } catch (error: any) {
      toast.error('删除失败: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeTicket = tickets.find(t => t.id === active.id);
    if (!activeTicket) return;

    const platformId = activeTicket.platform_id;
    const productId = activeTicket.global_product_id;

    const ptTickets = tickets
      .filter(t => t.platform_id === platformId && t.global_product_id === productId && t.status !== 'used')
      .sort((a, b) => a.sort_order - b.sort_order);

    const oldIndex = ptTickets.findIndex(item => item.id === active.id);
    const newIndex = ptTickets.findIndex(item => item.id === over.id);

    const newPtTickets = arrayMove(ptTickets, oldIndex, newIndex);

    const updates = newPtTickets.map((t, index) => ({
      id: t.id,
      sort_order: index
    }));

    setTickets(prev => prev.map(t => {
      const update = updates.find(u => u.id === t.id);
      if (update) {
        return { ...t, sort_order: update.sort_order };
      }
      return t;
    }));

    try {
      await Promise.all(updates.map(update => 
        supabase.from('tickets').update({ sort_order: update.sort_order }).eq('id', update.id)
      ));
    } catch(err) {
      console.error('Failed to update sort order', err);
    }
  }

  const getPlatformTotalQuantity = (platformId: string) => {
    // 只有未售出状态的才算作有效库存数量
    return tickets.filter(t => t.platform_id === platformId && ['for_sale', 'active', 'reserved'].includes(t.status)).length;
  };

  const getProductTicketsInPlatform = (platformId: string, productId: string) => {
    return tickets.filter(t => t.platform_id === platformId && t.global_product_id === productId && t.status !== 'used').sort((a, b) => a.sort_order - b.sort_order);
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
    <div className="space-y-8 pb-10" style={{ overflowAnchor: 'none' }}>
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
            <form onSubmit={handleAddPlatform} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">平台名称</label>
                  <Input required placeholder="如：美团、携程" value={newPlatformName} onChange={e => setNewPlatformName(e.target.value)} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20" />
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20">
                  {isSubmitting ? '保存中...' : '保存'}
                </Button>
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
                      <div role="button" className="h-9 w-9 rounded-full text-gray-400 hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors" onClick={() => setEditPlatform({id: platform.id, name: platform.name})}>
                        <Pencil className="w-4 h-4" />
                      </div>
                      <div role="button" className="h-9 w-9 rounded-full text-gray-400 hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors" onClick={() => setDeleteConfirm({type: 'platform', id: platform.id, name: platform.name})}>
                        <Trash2 className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 px-6 space-y-6 border-t border-gray-100/50 mt-2">

                {globalProducts.length === 0 ? (
                   <div className="text-center py-5 text-sm text-gray-400 bg-gray-50/50 rounded-2xl">暂无全局商品，请在数据看板中创建</div>
                ) : (
                  <div className="space-y-4">
                    {globalProducts.map(pt => {
                      const ptTickets = getProductTicketsInPlatform(platform.id, pt.id);
                      
                      return (
                        <div key={pt.id} className="bg-gray-50/80 backdrop-blur-md border border-white/60 rounded-2xl px-3 sm:px-4 py-3 overflow-hidden shadow-sm">
                          <div className="flex justify-between items-center w-full mb-3">
                            <div className="flex items-center gap-2 font-semibold text-gray-800 text-base">
                              <div className="p-1.5 bg-blue-100/50 text-blue-600 rounded-lg">
                                <Tag className="w-3.5 h-3.5" />
                              </div>
                              <span className="truncate max-w-[120px] sm:max-w-[200px]">{pt.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs font-medium text-gray-600 bg-white shadow-sm px-2 py-0.5 rounded-full border border-gray-100">
                                数量: <span className="font-bold text-gray-900">{ptTickets.length}</span>
                              </div>
                              <Dialog open={isAddTicketOpen && selectedPlatformId === platform.id && selectedProductId === pt.id} onOpenChange={(open) => {
                                setIsAddTicketOpen(open);
                                if (open) {
                                  setSelectedPlatformId(platform.id);
                                  setSelectedProductId(pt.id);
                                }
                              }}>
                                <DialogTrigger
                                  render={
                                    <Button variant="outline" size="sm" className="gap-1 h-7 text-xs rounded-lg border-gray-200 bg-white shadow-sm font-medium px-2">
                                      <Plus className="w-3 h-3" />
                                      创建单据
                                    </Button>
                                  }
                                />
                                <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100">
                                  <DialogHeader>
                                    <DialogTitle className="text-gray-900">创建单据 - {pt.name}</DialogTitle>
                                  </DialogHeader>
                                  <form onSubmit={handleAddTicket} className="space-y-5 mt-2">
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium text-gray-700">成本价 (元)</label>
                                      <Input required type="number" step="0.01" min="0" value={newTicket.cost_price} onChange={e => setNewTicket({...newTicket, cost_price: e.target.value})} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary" />
                                    </div>
                <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20">
                  {isSubmitting ? '保存中...' : '保存'}
                </Button>
              </form>
            </DialogContent>
                              </Dialog>
                            </div>
                          </div>

                          {ptTickets.length === 0 ? (
                            <div className="text-center py-3 text-xs text-gray-400">暂无具体单据记录</div>
                          ) : (
                            <DndContext 
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={handleDragEnd}
                            >
                              <SortableContext 
                                items={ptTickets.map(t => t.id)}
                                strategy={rectSortingStrategy}
                              >
                                <div className="grid grid-cols-4 gap-2">
                                  {ptTickets.map((ticket, tIndex) => (
                                    <SortableTicketItem 
                                      key={ticket.id} 
                                      ticket={ticket} 
                                      index={tIndex}
                                      onClick={(t: Ticket) => setSelectedTicketAction(t)}
                                    />
                                  ))}
                                </div>
                              </SortableContext>
                            </DndContext>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
            <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20">
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Ticket Cost Dialog */}
      <Dialog open={!!editTicketCost} onOpenChange={(open) => !open && setEditTicketCost(null)}>
        <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100">
          <DialogHeader><DialogTitle className="text-gray-900">修改成本价</DialogTitle></DialogHeader>
          <form onSubmit={handleEditTicket} className="space-y-4">
            <Input required type="number" step="0.01" min="0" value={editTicketCost?.cost_price || ''} onChange={e => setEditTicketCost(prev => prev ? {...prev, cost_price: e.target.value} : null)} className="rounded-xl h-12 bg-gray-50 border-transparent focus-visible:ring-primary/20" />
            <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20">
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ticket Action Dialog */}
      <Dialog open={!!selectedTicketAction} onOpenChange={(open) => !open && setSelectedTicketAction(null)}>
        <DialogContent className="rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-gray-900 text-center">单据操作</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl mb-2">
              <span className="text-sm font-medium text-gray-500">当前成本价</span>
              <span className="font-bold text-gray-900 text-lg">¥{selectedTicketAction?.cost_price}</span>
            </div>
            <Button 
              variant="outline" 
              className="w-full h-12 rounded-xl font-bold border-gray-200"
              onClick={() => {
                if (selectedTicketAction) {
                  setEditTicketCost({id: selectedTicketAction.id, cost_price: selectedTicketAction.cost_price.toString()});
                  setSelectedTicketAction(null);
                }
              }}
            >
              <Pencil className="w-4 h-4 mr-2" />
              修改成本价
            </Button>
            <Button 
              variant="destructive" 
              className="w-full h-12 rounded-xl font-bold shadow-lg shadow-destructive/20"
              onClick={() => {
                if (selectedTicketAction) {
                  setDeleteConfirm({type: 'ticket', id: selectedTicketAction.id});
                  setSelectedTicketAction(null);
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              删除单据
            </Button>
          </div>
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
            {deleteConfirm?.type === 'platform' && <div className="text-sm mt-3 bg-destructive/10 text-destructive p-4 rounded-2xl border border-destructive/20 font-medium">您即将删除平台 <strong>{deleteConfirm.name}</strong>。此操作将同时永久删除该平台下的所有商品、优惠券以及关联的售出明细记录！</div>}
            {deleteConfirm?.type === 'ticket' && <div className="text-sm mt-3 bg-destructive/10 text-destructive p-4 rounded-2xl border border-destructive/20 font-medium">您即将删除该条优惠券进货记录。此操作将同时永久删除关联的售出明细记录！</div>}
            <div className="mt-3 text-sm font-bold text-gray-900">此操作不可恢复，是否继续？</div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-xl h-12 px-6 border-gray-200" disabled={isSubmitting}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} className="rounded-xl h-12 px-6 font-bold shadow-lg shadow-destructive/20" disabled={isSubmitting}>
              {isSubmitting ? '删除中...' : '确认删除'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}