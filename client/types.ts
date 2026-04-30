
// types.ts
export enum OrderStatus {
  DRAFT = 'DRAFT',
  ON_REVIEW = 'ON_REVIEW',
  PENDING = 'PENDING', 
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  UNDELIVERED = 'UNDELIVERED',
  CANCELLED = 'CANCELLED',
  DELETED = 'DELETED'
}

export enum PaymentStatus {
  PENDING = 'Pending Review',
  APPROVED = 'Approved',
  MISMATCHED = 'Mismatched',
  REJECTED = 'Rejected'
}

export type BuyerTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | string;

export interface Category {
  id: string;
  name: string;
}

export type StorageLocationId = 'mainWarehouse' | 'backRoom' | 'showRoom';

export interface StorageLocation {
  id: StorageLocationId;
  name: string;
  capacityUnits: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  description: string;
  price: number;
  costPrice?: number;
  image: string;
  stock: {
    mainWarehouse: number;
    backRoom: number;
    showRoom: number;
  };
  reorderPoint: number;
  status: 'In Stock' | 'Low' | 'Empty' | 'Discontinued';
  supplierName?: string;
  supplierPhone?: string;
  createdAt?: string;
  updatedAt?: string;
  recommended?: boolean;
  recommendationScore?: number;
  recommendationReasons?: string[];
  nextExpiryDate?: string | null;
  batches?: ProductBatch[];
}

export interface ProductBatch {
  id: string | number;
  batchNumber: string;
  location: StorageLocationId;
  quantity: number;
  initialQuantity: number;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ReturnLog {
  id: string;
  productId: string;
  orderId?: string;
  buyerId?: string;
  productName: string;
  brand: string;
  type: 'Return' | 'Damage';
  quantity: number;
  reason: 'Damaged in Transit' | 'Expired' | 'Faulty Packaging' | 'Customer Return' | 'Wrong Item';
  action: 'Restocked' | 'Disposed' | 'Returned to Supplier';
  date: string;
  note: string;
  lossValue: number;
  supplierName?: string;
  stockLocation?: 'mainWarehouse' | 'backRoom' | 'showRoom';
}

export interface CreditRequest {
  id: string;
  buyerId: string;
  orderId?: string;
  amount: number;
  approvedAmount?: number;
  repaidAmount?: number;
  outstandingAmount?: number;
  reason: 'Damaged Goods' | 'Pricing Error' | 'Return' | 'Shortage' | 'Goodwill' | 'Order Financing';
  status: 'Pending' | 'Approved' | 'Rejected' | 'Partially Approved' | 'Partially Paid' | 'Fully Paid';
  requestDate: string;
  actionDate?: string;
  paymentTerms?: string;
  dueDate?: string;
  repaidAt?: string;
  notes?: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  priceAtOrder: number;
  picked?: boolean;
}

export interface Buyer {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  avatar?: string;
  outstandingBalance: number;
  paymentTerms: string;
  totalSpend: number;
  totalOrders: number;
  status: 'Active' | 'Inactive';
  tier: BuyerTier;
  discountRate: number; 
  joinDate: string;
  password?: string;
}

export interface PricingRule {
  id: string;
  name: string;
  discountPercentage: number;
  description: string;
  minSpend: number;
  minYears: number;
  memberCount: number;
  status: 'Active' | 'Archived';
}

export interface BulkDiscountRule {
  id: string;
  unitThreshold: number;
  discountPercentage: number;
  isActive: boolean;
}

export interface Order {
  id: string;
  buyerId: string;
  buyerCompanyName?: string | null;
  buyerName?: string | null;
  buyerPhone?: string | null;
  buyerEmail?: string | null;
  buyerAddress?: string | null;
  date: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  paymentStatus: 'Unpaid' | 'Partially Paid' | 'Paid';
  paymentTerms?: string;
  stockDeducted?: boolean;
  createdBy?: 'buyer' | 'seller';
  history: {
    status: string;
    date: string;
    note: string;
  }[];
}

export interface Payment {
  id: string;
  orderId: string;
  buyerId: string;
  creditRequestId?: string;
  amount: number;
  method: string;
  referenceId: string;
  dateTime: string;
  proofImage: string;
  status: PaymentStatus;
  notes?: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  roleId?: string;
  status: 'Active' | 'Inactive';
  password?: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  accessLevel: string;
  permissions: {
    [key: string]: boolean;
  };
}

export interface Notification {
  id: string;
  type: 'Stock' | 'Order' | 'Payment' | 'System';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  severity: 'low' | 'medium' | 'high';
  recipientId: string; // 'seller' or buyerId
  relatedId?: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorType: 'Admin' | 'Staff' | 'Buyer' | 'System';
  action: string;
  module: 'Orders' | 'Inventory' | 'Finance' | 'Users' | 'Settings';
  details: string;
}
