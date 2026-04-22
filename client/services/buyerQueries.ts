import { Buyer, Category, CreditRequest, Notification, Order, OrderStatus, Product } from '../types';

export const buyerQueryKeys = {
  dashboard: (userId?: string) => ['buyer-dashboard', userId || 'guest'] as const,
  orders: (userId?: string) => ['buyer-orders', userId || 'guest'] as const,
  catalog: (userId?: string, draftId?: string | null) => ['buyer-catalog', userId || 'guest', draftId || 'latest'] as const,
  creditList: (userId?: string) => ['buyer-credit-list', userId || 'guest'] as const,
  creditDetails: (creditId?: string) => ['buyer-credit-details', creditId || 'missing'] as const,
  notifications: () => ['buyer-notifications'] as const,
  orderDetails: (orderId?: string, userId?: string) => ['buyer-order-details', orderId || 'missing', userId || 'guest'] as const,
  paymentOrder: (orderId?: string, userId?: string, draftId?: string | null) =>
    ['buyer-payment-order', orderId || 'missing', userId || 'guest', draftId || 'none'] as const,
  payments: (userId?: string) => ['buyer-payments', userId || 'guest'] as const,
  productDetails: (productId?: string) => ['buyer-product-details', productId || 'missing'] as const
};

export const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    credentials: 'include',
    ...init
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || `Failed to fetch ${url}`);
  }

  return response.json();
};

export const parseArrayResponse = <T>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown[] }).data)) {
    return (data as { data: T[] }).data;
  }
  return [];
};

export const normalizeBuyerOrderStatus = (status: OrderStatus | string) => {
  const value = status?.toString().trim().toUpperCase() || '';
  if (value === 'DRAFT') return OrderStatus.DRAFT;
  if (value === 'ON_REVIEW' || value === 'ON REVIEW') return OrderStatus.ON_REVIEW;
  if (value === 'PENDING') return OrderStatus.PENDING;
  if (value === 'PROCESSING') return OrderStatus.PROCESSING;
  if (value === 'SHIPPED') return OrderStatus.SHIPPED;
  if (value === 'DELIVERED') return OrderStatus.DELIVERED;
  if (value === 'UNDELIVERED') return OrderStatus.UNDELIVERED;
  if (value === 'CANCELLED' || value === 'CANCELED') return OrderStatus.CANCELLED;
  if (value === 'DELETED') return OrderStatus.DELETED;
  return value as OrderStatus;
};

export const toBuyerProfile = (me: any, fallbackUserId?: string): Buyer => ({
  id: me?.id || fallbackUserId || '',
  companyName: me?.companyName || 'Buyer Account',
  contactPerson: me?.name || 'Buyer',
  email: me?.email || '',
  phone: me?.phone || '',
  address: '',
  outstandingBalance: 0,
  paymentTerms: '',
  totalSpend: 0,
  totalOrders: 0,
  status: 'Active',
  tier: me?.tier || 'Bronze',
  discountRate: 0,
  joinDate: ''
});

export type BuyerDashboardData = {
  buyer: Buyer | null;
  orders: Order[];
  products: Product[];
};

export type BuyerOrdersData = {
  buyer: Buyer | null;
  orders: Order[];
  products: Product[];
};

export type BuyerCatalogData = {
  products: Product[];
  categories: Category[];
  taxRate: number;
  draftId: string | null;
  draftItems: { productId: string; quantity: number }[];
};

export type BuyerCreditDetailsData = {
  request: CreditRequest | null;
  order: Order | null;
};

export const loadBuyerDashboardData = async (userId?: string): Promise<BuyerDashboardData> => {
  if (!userId) return { buyer: null, orders: [], products: [] };

  const [meData, ordersData, productsData] = await Promise.all([
    fetchJson<any>('/api/auth/me'),
    fetchJson<any>('/api/orders'),
    fetchJson<any>('/api/products')
  ]);

  const orders = parseArrayResponse<Order>(ordersData).filter((order) => order.buyerId === userId);
  const products = parseArrayResponse<Product>(productsData);

  return {
    buyer: toBuyerProfile(meData, userId),
    orders,
    products
  };
};

export const loadBuyerOrdersData = async (userId?: string): Promise<BuyerOrdersData> => {
  if (!userId) return { buyer: null, orders: [], products: [] };

  const [ordersData, meData, productsData] = await Promise.all([
    fetchJson<any>('/api/orders'),
    fetchJson<any>('/api/auth/me'),
    fetchJson<any>('/api/products')
  ]);

  const orders = parseArrayResponse<Order>(ordersData).filter((order) => {
    if (order.buyerId !== userId) return false;
    if (normalizeBuyerOrderStatus(order.status) === OrderStatus.DRAFT && order.createdBy !== 'buyer') return false;
    return true;
  });

  return {
    buyer: toBuyerProfile(meData, userId),
    orders,
    products: parseArrayResponse<Product>(productsData)
  };
};

export const loadBuyerCatalogData = async (userId?: string, draftParam?: string | null): Promise<BuyerCatalogData> => {
  const [productsData, categoriesData, taxData] = await Promise.all([
    fetchJson<any>('/api/products'),
    fetchJson<Category[]>('/api/categories'),
    fetchJson<{ taxRate?: number }>('/api/settings/tax-rate').catch(() => ({ taxRate: 0.15 }))
  ]);

  let draftId: string | null = null;
  let draftItems: { productId: string; quantity: number }[] = [];

  if (userId) {
    if (draftParam) {
      const draftOrder = await fetchJson<any>(`/api/orders/${draftParam}`).catch(() => null);
      if (draftOrder?.buyerId === userId) {
        draftId = draftOrder.id;
        draftItems = (draftOrder.items || []).map((item: any) => ({ productId: item.productId, quantity: item.quantity }));
      }
    } else {
      const latestDraft = await fetchJson<any>('/api/orders/draft').catch(() => null);
      if (latestDraft?.id && latestDraft?.items?.length) {
        draftId = latestDraft.id;
        draftItems = (latestDraft.items || []).map((item: any) => ({ productId: item.productId, quantity: item.quantity }));
      }
    }
  }

  return {
    products: parseArrayResponse<Product>(productsData),
    categories: Array.isArray(categoriesData) ? categoriesData : [],
    taxRate: taxData?.taxRate ?? 0.15,
    draftId,
    draftItems
  };
};

export const loadBuyerCreditList = async (userId?: string): Promise<CreditRequest[]> => {
  if (!userId) return [];
  const creditData = await fetchJson<CreditRequest[]>('/api/credits/my');
  return Array.isArray(creditData) ? creditData : [];
};

export const loadBuyerCreditDetails = async (creditId?: string): Promise<BuyerCreditDetailsData> => {
  if (!creditId) return { request: null, order: null };

  const creditList = await fetchJson<CreditRequest[]>('/api/credits/my');
  const request = Array.isArray(creditList)
    ? creditList.find((credit) => credit.id === creditId) || null
    : null;

  if (!request) {
    throw new Error('Credit request not found');
  }

  const order = request.orderId
    ? await fetchJson<Order>(`/api/orders/${request.orderId}`).catch(() => null)
    : null;

  return { request, order };
};

export const loadBuyerNotifications = async (): Promise<Notification[]> => {
  const data = await fetchJson<Notification[]>('/api/notifications');
  return Array.isArray(data) ? data : [];
};

export const loadBuyerOrderDetails = async (orderId?: string, userId?: string): Promise<{ order: Order | null; products: Product[] }> => {
  if (!orderId || !userId) return { order: null, products: [] };

  const [order, productsData] = await Promise.all([
    fetchJson<Order>(`/api/orders/${orderId}`),
    fetchJson<any>('/api/products').catch(() => [])
  ]);

  if (!order || order.buyerId !== userId) {
    throw new Error('Order not found');
  }

  return {
    order,
    products: parseArrayResponse<Product>(productsData)
  };
};

export const loadBuyerPaymentOrder = async (
  orderId?: string,
  userId?: string,
  draftId?: string | null
): Promise<Order | null> => {
  if (!userId) return null;

  const targetId = orderId || draftId;
  const order = targetId
    ? await fetchJson<Order>(`/api/orders/${targetId}`)
    : await fetchJson<Order | null>('/api/orders/draft');

  if (!order) {
    throw new Error('No draft order found');
  }

  if (!order || order.buyerId !== userId) {
    throw new Error('Order not found');
  }

  return order;
};

export const loadBuyerProduct = async (productId?: string): Promise<Product | null> => {
  if (!productId) return null;
  return fetchJson<Product>(`/api/products/${productId}`);
};
