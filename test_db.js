import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('tickets').select('status, quantity');
  let for_sale = 0;
  let sold_pending = 0;
  let used = 0;
  let total_quantity = 0;
  data.forEach(t => {
    if (t.status === 'for_sale') for_sale++;
    if (t.status === 'sold_pending') sold_pending++;
    if (t.status === 'used') used++;
    total_quantity += t.quantity;
  });
  console.log({ for_sale, sold_pending, used, total_quantity, total_rows: data.length });
}
check();
