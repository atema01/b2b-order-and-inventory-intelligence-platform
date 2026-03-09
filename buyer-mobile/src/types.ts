export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  UNDELIVERED = 'UNDELIVERED',
  CANCELLED = 'CANCELLED',
  DELETED = 'DELETED',
}

export interface OrderItem {
  productId: string;
  quantity: number;
  priceAtOrder: number;
}

export interface Order {
  id: string;
  buyerId: string;
  date: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  paymentStatus: 'Unpaid' | 'Partially Paid' | 'Paid';
  paymentTerms?: string;
  history: {
    status: string;
    date: string;
    note: string;
  }[];
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  description: string;
  price: number;
  image: string;
  stock: {
    mainWarehouse: number;
    backRoom: number;
    showRoom: number;
  };
  reorderPoint: number;
  status: 'In Stock' | 'Low' | 'Empty' | 'Discontinued';
}

export interface Buyer {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  creditLimit: number;
  availableCredit: number;
  outstandingBalance: number;
  paymentTerms: string;
  totalSpend: number;
  totalOrders: number;
  status: 'Active' | 'Inactive';
  tier: string;
  discountRate: number;
  joinDate: string;
}

export interface Notification {
  id: string;
  type: 'Stock' | 'Order' | 'Payment' | 'System';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  severity: 'low' | 'medium' | 'high';
  recipientId: string;
  relatedId?: string;
}
