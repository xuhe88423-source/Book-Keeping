import { supabase } from './supabase';

export async function autoWriteOffTickets() {
  try {
    // 1. 获取所有当前状态为 sold_pending 的票据
    const { data: pendingTickets, error: fetchError } = await supabase
      .from('tickets')
      .select('id')
      .eq('status', 'sold_pending');

    if (fetchError) {
      console.error('Error fetching pending tickets for auto write-off:', fetchError);
      return;
    }

    if (!pendingTickets || pendingTickets.length === 0) return;

    const ticketIds = pendingTickets.map(t => t.id);
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }); // YYYY-MM-DD

    // 2. 在 sales 表中查找这些票据中，sold_at 小于今天的记录
    const { data: oldSales, error: salesError } = await supabase
      .from('sales')
      .select('ticket_id')
      .in('ticket_id', ticketIds)
      .lt('sold_at', todayStr);

    if (salesError) {
      console.error('Error fetching old sales for auto write-off:', salesError);
      return;
    }

    if (!oldSales || oldSales.length === 0) return;

    const idsToUpdate = oldSales.map(s => s.ticket_id);

    // 3. 将这些票据的状态更新为 used
    const { error: updateError } = await supabase
      .from('tickets')
      .update({ status: 'used' })
      .in('id', idsToUpdate);

    if (updateError) {
      console.error('Error updating tickets to used in auto write-off:', updateError);
    } else {
      console.log(`Auto write-off successfully completed for ${idsToUpdate.length} tickets.`);
    }

  } catch (err) {
    console.error('Unexpected error in autoWriteOffTickets:', err);
  }
}
