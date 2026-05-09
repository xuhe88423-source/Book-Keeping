export interface Platform {
  id: string;
  name: string;
  created_at: string;
}

export interface GlobalProduct {
  id: string;
  name: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  global_product_id: string;
  platform_id: string;
  cost_price: number;
  quantity: number;
  status: 'for_sale' | 'active' | 'reserved' | 'sold_pending' | 'used';
  sort_order: number;
  created_at: string;
}

export interface Sale {
  id: string;
  ticket_id: string;
  sell_price: number;
  quantity: number;
  profit: number;
  batch_id: string;
  fee: number;
  sold_at: string;
  created_at: string;
}
