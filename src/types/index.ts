export interface Platform {
  id: string;
  name: string;
  created_at: string;
  product_types?: ProductType[];
}

export interface ProductType {
  id: string;
  platform_id: string;
  name: string;
  created_at: string;
  tickets?: Ticket[];
}

export interface Ticket {
  id: string;
  product_type_id: string;
  cost_price: number;
  quantity: number;
  created_at: string;
}

export interface Sale {
  id: string;
  ticket_id: string;
  sell_price: number;
  quantity: number;
  profit: number;
  sold_at: string;
  created_at: string;
}
