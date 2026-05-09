import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('sales').select('ticket_id');
  const salesTicketIds = new Set(data.map(s => s.ticket_id));
  
  const { data: tickets } = await supabase.from('tickets').select('id, quantity, status');
  
  for (let t of tickets) {
    if (t.quantity === 0) {
      console.log(`Ticket ${t.id} has quantity 0, is it in sales? ${salesTicketIds.has(t.id)}`);
    }
  }
}
check();
