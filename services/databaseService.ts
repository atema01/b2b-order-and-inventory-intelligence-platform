
import { Order, Product, Buyer, Staff, Role, Payment, Notification, OrderStatus, PaymentStatus, PricingRule, BulkDiscountRule, MarginDiscountRule, ReturnLog, CreditRequest, SystemLog, Category } from '../types';

const STORAGE_KEY = 'b2b_intel_db';

interface DB {
  products: Product[];
  categories: Category[];
  orders: Order[];
  buyers: Buyer[];
  staff: Staff[];
  roles: Role[];
  payments: Payment[];
  notifications: Notification[];
  pricingRules: PricingRule[];
  bulkRules: BulkDiscountRule[];
  marginRules: MarginDiscountRule[];
  returnLogs: ReturnLog[];
  creditRequests: CreditRequest[];
  systemLogs: SystemLog[];
}

const INITIAL_DATA: DB = {
  products: [
    {
      id: 'P1',
      name: 'Velvet Matte Lipstick',
      sku: 'LP-00124',
      category: 'Lips',
      brand: 'GLOW COSMETICS',
      description: 'A rich, highly pigmented crimson red lipstick with a smooth velvet matte finish.',
      price: 1250,
      costPrice: 900,
      image: 'https://images.unsplash.com/photo-1586776977607-310e9c725c37?auto=format&fit=crop&q=80&w=400',
      stock: { mainWarehouse: 320, backRoom: 45, showRoom: 12 },
      reorderPoint: 100,
      status: 'In Stock'
    },
    {
      id: 'P2',
      name: 'HD Radiance Foundation',
      sku: 'FD-88210',
      category: 'Face',
      brand: 'DERMACARE',
      description: 'Breathable, medium-coverage foundation with hyaluronic acid.',
      price: 2400,
      costPrice: 1800,
      image: 'https://images.unsplash.com/photo-1631730486784-5456119f69ae?auto=format&fit=crop&q=80&w=400',
      stock: { mainWarehouse: 100, backRoom: 8, showRoom: 2 },
      reorderPoint: 50,
      status: 'In Stock'
    },
    {
      id: 'P3',
      name: 'Midnight Recovery Serum',
      sku: 'SR-99210',
      category: 'Skincare',
      brand: 'LUMIERE',
      description: 'Nighttime repair serum with botanical extracts.',
      price: 3100,
      costPrice: 2200,
      image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=400',
      stock: { mainWarehouse: 50, backRoom: 10, showRoom: 5 },
      reorderPoint: 20,
      status: 'In Stock'
    }
  ],
  categories: [
    { id: 'CAT-1', name: 'Lips' },
    { id: 'CAT-2', name: 'Face' },
    { id: 'CAT-3', name: 'Eyes' },
    { id: 'CAT-4', name: 'Skincare' }
  ],
  buyers: [
    {
      id: 'B-0001',
      companyName: 'Luxe Cosmetics Hub',
      contactPerson: 'Sarah Jenkins',
      email: 'buyer@retailer.com',
      phone: '+251 911 888 777',
      address: 'Bole Road, Mega Building, Addis Ababa',
      creditLimit: 500000,
      availableCredit: 145200,
      outstandingBalance: 42500,
      paymentTerms: 'Net 15',
      totalSpend: 187500,
      totalOrders: 12,
      status: 'Active',
      tier: 'Gold',
      discountRate: 0.10,
      joinDate: '2021-05-12',
      // Hash of '123456'
      password: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92' 
    },
  ],
  pricingRules: [
    { id: 'PR-1', name: 'Bronze', discountPercentage: 0, description: 'Standard wholesale entry tier.', minSpend: 0, minYears: 0, memberCount: 0, status: 'Active' },
    { id: 'PR-2', name: 'Silver', discountPercentage: 5, description: 'Growing retail partners.', minSpend: 100000, minYears: 1, memberCount: 1, status: 'Active' },
    { id: 'PR-3', name: 'Gold', discountPercentage: 10, description: 'Established high-volume partners.', minSpend: 500000, minYears: 2, memberCount: 1, status: 'Active' },
    { id: 'PR-4', name: 'Platinum', discountPercentage: 15, description: 'Top distribution partners.', minSpend: 1000000, minYears: 4, memberCount: 0, status: 'Active' },
  ],
  bulkRules: [
    { id: 'BR-1', unitThreshold: 24, discountPercentage: 5, isActive: true },
    { id: 'BR-2', unitThreshold: 48, discountPercentage: 8, isActive: true }
  ],
  marginRules: [
    { id: 'MR-1', minUnitCost: 1000, minMarginPercentage: 8, bonusDiscount: 1, isActive: true }
  ],
  returnLogs: [
    {
      id: 'RT-1001',
      productId: 'P1',
      productName: 'Velvet Matte Lipstick',
      brand: 'GLOW COSMETICS',
      type: 'Damage',
      quantity: 5,
      reason: 'Faulty Packaging',
      action: 'Disposed',
      date: '2024-03-01',
      note: 'Caps were cracked on arrival',
      lossValue: 4500
    }
  ],
  creditRequests: [],
  orders: [
    {
      id: 'ORD-2094',
      buyerId: 'B-0001',
      date: 'Oct 24, 2023',
      status: OrderStatus.SHIPPED,
      items: [{ productId: 'P1', quantity: 14, priceAtOrder: 1250 }],
      subtotal: 42500,
      tax: 0,
      total: 42500,
      amountPaid: 0,
      paymentStatus: 'Unpaid',
      history: []
    },
    {
      id: 'ORD-2088',
      buyerId: 'B-0001',
      date: 'Oct 21, 2023',
      status: OrderStatus.PROCESSING,
      items: [{ productId: 'P2', quantity: 8, priceAtOrder: 2400 }],
      subtotal: 18200,
      tax: 0,
      total: 18200,
      amountPaid: 18200,
      paymentStatus: 'Paid',
      history: []
    },
    {
      id: 'ORD-2075',
      buyerId: 'B-0001',
      date: 'Oct 15, 2023',
      status: OrderStatus.DELIVERED,
      items: [{ productId: 'P1', quantity: 22, priceAtOrder: 1250 }],
      subtotal: 89100,
      tax: 0,
      total: 89100,
      amountPaid: 0,
      paymentStatus: 'Unpaid',
      history: []
    }
  ],
  staff: [
    { 
      id: 'S-0001', 
      name: 'Admin User', 
      email: 'admin@b2bintel.com', 
      role: 'Admin', 
      phone: '0911000000', 
      status: 'Active',
      // Hash of '123456'
      password: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
    }
  ],
  roles: [
    {
      id: 'R-ADMIN',
      name: 'Admin',
      description: 'Full system access',
      memberCount: 1,
      accessLevel: 'Owner',
      permissions: { 
        'Orders': true, 'Products': true, 'Returns': true,
        'Staff': true, 'Roles': true,
        'Reports': true, 'Payments': true, 'Credits': true,
        'Buyers': true, 'Pricing': true, 'Logs': true, 'Settings': true
      }
    },
    {
      id: 'R-INV',
      name: 'Inventory Specialist',
      description: 'Manage products and stock levels',
      memberCount: 0,
      accessLevel: 'Staff',
      permissions: { 
        'Orders': false, 'Products': true, 'Returns': true,
        'Staff': false, 'Roles': false,
        'Reports': false, 'Payments': false, 'Credits': false,
        'Buyers': false, 'Pricing': false, 'Logs': false, 'Settings': false
      }
    }
  ],
  payments: [],
  notifications: [],
  systemLogs: [
    {
      id: 'LOG-001',
      timestamp: new Date(Date.now() - 86400000).toLocaleString(),
      actorName: 'System',
      actorType: 'System',
      action: 'Daily Backup',
      module: 'Settings',
      details: 'Database snapshot created successfully'
    },
    {
      id: 'LOG-002',
      timestamp: new Date(Date.now() - 43200000).toLocaleString(),
      actorName: 'Sarah Jenkins',
      actorType: 'Buyer',
      action: 'Login',
      module: 'Users',
      details: 'Successful login from mobile device'
    }
  ]
};

class DatabaseService {
  private getDB(): DB {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      this.saveDB(INITIAL_DATA);
      return INITIAL_DATA;
    }
    const dbInstance = JSON.parse(data);
    
    // Safety checks for migrations
    if (!dbInstance.bulkRules) dbInstance.bulkRules = INITIAL_DATA.bulkRules;
    if (!dbInstance.marginRules) dbInstance.marginRules = INITIAL_DATA.marginRules;
    if (!dbInstance.returnLogs) dbInstance.returnLogs = INITIAL_DATA.returnLogs;
    if (!dbInstance.creditRequests) dbInstance.creditRequests = INITIAL_DATA.creditRequests;
    if (!dbInstance.notifications) dbInstance.notifications = INITIAL_DATA.notifications;
    if (!dbInstance.systemLogs) dbInstance.systemLogs = INITIAL_DATA.systemLogs;
    if (!dbInstance.staff || dbInstance.staff.length === 0) dbInstance.staff = INITIAL_DATA.staff;
    // Seed roles if empty
    if (!dbInstance.roles || dbInstance.roles.length === 0) dbInstance.roles = INITIAL_DATA.roles;
    // Seed categories if empty
    if (!dbInstance.categories || dbInstance.categories.length === 0) dbInstance.categories = INITIAL_DATA.categories;
    
    // Migration for existing buyers
    dbInstance.buyers = dbInstance.buyers.map((b: any) => ({
      ...b,
      id: b.id === 'B1' ? 'B-0001' : b.id, // Migrate old ID
      outstandingBalance: b.outstandingBalance ?? 0
    }));

    // Migration for orders
    dbInstance.orders = dbInstance.orders.map((o: any) => ({
      ...o,
      buyerId: o.buyerId === 'B1' ? 'B-0001' : o.buyerId, // Migrate old ID ref
      amountPaid: o.amountPaid ?? 0,
      paymentStatus: o.paymentStatus || (o.amountPaid >= o.total ? 'Paid' : 'Unpaid')
    }));

    // Migration for notifications (add recipientId if missing)
    dbInstance.notifications = dbInstance.notifications.map((n: any) => ({
      ...n,
      recipientId: n.recipientId === 'B1' ? 'B-0001' : (n.recipientId || 'seller')
    }));

    // Migration for roles permissions
    const defaultPerms = {
        'Orders': false, 'Products': false, 'Returns': false,
        'Staff': false, 'Roles': false,
        'Reports': false, 'Payments': false, 'Credits': false,
        'Buyers': false, 'Pricing': false, 'Logs': false, 'Settings': false
    };
    dbInstance.roles = dbInstance.roles.map((r: any) => {
        // Map old structure if needed or just merge defaults
        return {
            ...r,
            permissions: { ...defaultPerms, ...r.permissions }
        };
    });

    return dbInstance;
  }

  private saveDB(dbInstance: DB) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dbInstance));
  }

  // SYSTEM CONFIG
  getTaxRate(): number {
    const rate = localStorage.getItem('b2b_tax_rate');
    // Default to 15% (0.15) if not set, as this is a standard VAT rate. 
    // Previous code used 0.05 hardcoded, but 0.15 makes the setting more obvious.
    return rate ? parseFloat(rate) : 0.15;
  }

  setTaxRate(rate: number) {
    localStorage.setItem('b2b_tax_rate', rate.toString());
  }

  // Internal logging helper
  private logActivity(dbInstance: DB, action: string, module: SystemLog['module'], details: string, actorOverride?: { name: string, type: SystemLog['actorType'] }) {
    // Attempt to guess user context if not provided
    const userType = localStorage.getItem('userType') || 'seller';
    let actorName = localStorage.getItem('userName') || (userType === 'buyer' ? 'Luxe Cosmetics Hub' : 'Admin User');
    let actorType: SystemLog['actorType'] = (userType === 'buyer' ? 'Buyer' : 'Staff');

    if (actorOverride) {
        actorName = actorOverride.name;
        actorType = actorOverride.type;
    }

    const log: SystemLog = {
        id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toLocaleString(),
        actorName,
        actorType,
        action,
        module,
        details
    };

    dbInstance.systemLogs.unshift(log);
    // Keep logs manageable
    if (dbInstance.systemLogs.length > 500) {
        dbInstance.systemLogs = dbInstance.systemLogs.slice(0, 500);
    }
  }

  private addNotificationInternal(dbInstance: DB, notification: Omit<Notification, 'id' | 'isRead'>) {
    const newNotif: Notification = {
        id: `N-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        isRead: false,
        ...notification
    };
    dbInstance.notifications.unshift(newNotif);
  }

  private adjustInventoryOnInstance(dbInstance: DB, order: Order, direction: 'deduct' | 'restore') {
    order.items.forEach(item => {
      const product = dbInstance.products.find(p => p.id === item.productId);
      if (product) {
        const prevStock = product.stock.mainWarehouse;
        if (direction === 'deduct') {
          product.stock.mainWarehouse -= item.quantity;
        } else {
          product.stock.mainWarehouse += item.quantity;
        }
        
        const total = product.stock.mainWarehouse + product.stock.backRoom + product.stock.showRoom;
        
        // Stock Alerts Logic
        const oldStatus = product.status;
        if (total <= 0) product.status = 'Empty';
        else if (total < product.reorderPoint) product.status = 'Low';
        else product.status = 'In Stock';

        // Trigger Notification if status worsens to Low or Empty
        if (direction === 'deduct' && product.status !== oldStatus && (product.status === 'Low' || product.status === 'Empty')) {
           this.addNotificationInternal(dbInstance, {
             type: 'Stock',
             title: 'Inventory Alert',
             message: `${product.status} stock warning for "${product.name}".`,
             time: new Date().toLocaleString(),
             severity: 'high',
             recipientId: 'seller',
             relatedId: product.id
           });
           
           this.logActivity(dbInstance, 'Stock Alert', 'Inventory', `Auto-detected ${product.status} stock for ${product.name}`, { name: 'System', type: 'System' });
        }
      }
    });
  }

  // AUTH LOGGING
  logUserLogin(userId: string, name: string, type: 'Staff' | 'Buyer') {
    const dbInstance = this.getDB();
    this.logActivity(dbInstance, 'Login', 'Users', 'User authenticated successfully', { name, type });
    this.saveDB(dbInstance);
  }

  // LOGS
  getAllSystemLogs(): SystemLog[] {
    return this.getDB().systemLogs;
  }

  // CATEGORIES
  getAllCategories(): Category[] { return this.getDB().categories; }
  createCategory(category: Category) {
    const dbInstance = this.getDB();
    dbInstance.categories.push(category);
    this.logActivity(dbInstance, 'Create Category', 'Settings', `Added new product category: ${category.name}`);
    this.saveDB(dbInstance);
  }
  updateCategory(category: Category) {
    const dbInstance = this.getDB();
    const idx = dbInstance.categories.findIndex(c => c.id === category.id);
    if (idx > -1) {
        dbInstance.categories[idx] = category;
        this.saveDB(dbInstance);
    }
  }
  deleteCategory(id: string) {
    const dbInstance = this.getDB();
    const cat = dbInstance.categories.find(c => c.id === id);
    dbInstance.categories = dbInstance.categories.filter(c => c.id !== id);
    this.logActivity(dbInstance, 'Delete Category', 'Settings', `Removed product category: ${cat?.name || id}`);
    this.saveDB(dbInstance);
  }

  // PRODUCTS
  getAllProducts(): Product[] { return this.getDB().products; }
  getProduct(id: string) { return this.getDB().products.find(p => p.id === id); }
  createProduct(product: Product) {
    const dbInstance = this.getDB();
    dbInstance.products.unshift(product);
    this.logActivity(dbInstance, 'Create Product', 'Inventory', `Added new SKU: ${product.name} (${product.sku})`);
    this.saveDB(dbInstance);
  }
  updateProduct(product: Product) {
    const dbInstance = this.getDB();
    const idx = dbInstance.products.findIndex(p => p.id === product.id);
    if (idx > -1) { 
        dbInstance.products[idx] = product; 
        this.logActivity(dbInstance, 'Update Product', 'Inventory', `Updated details for ${product.name}`);
        this.saveDB(dbInstance); 
    }
  }
  deleteProduct(id: string) {
    const dbInstance = this.getDB();
    const p = dbInstance.products.find(x => x.id === id);
    dbInstance.products = dbInstance.products.filter(p => p.id !== id);
    this.logActivity(dbInstance, 'Delete Product', 'Inventory', `Removed product: ${p?.name || id}`);
    this.saveDB(dbInstance);
  }

  // RETURNS & DAMAGES
  getAllReturnLogs(): ReturnLog[] { return this.getDB().returnLogs; }
  createReturnLog(log: ReturnLog) {
    const dbInstance = this.getDB();
    dbInstance.returnLogs.unshift(log);
    
    // If action is restocked, we need to update product inventory
    if (log.action === 'Restocked') {
      const product = dbInstance.products.find(p => p.id === log.productId);
      if (product) {
        product.stock.mainWarehouse += log.quantity;
        const total = product.stock.mainWarehouse + product.stock.backRoom + product.stock.showRoom;
        if (total > product.reorderPoint) product.status = 'In Stock';
      }
    }
    
    this.logActivity(dbInstance, 'Log Incident', 'Inventory', `Recorded ${log.type} for ${log.productName}. Action: ${log.action}`);
    this.saveDB(dbInstance);
  }

  // CREDIT REQUESTS
  getAllCreditRequests(): CreditRequest[] { return this.getDB().creditRequests; }
  createCreditRequest(req: CreditRequest) {
    const dbInstance = this.getDB();
    dbInstance.creditRequests.unshift(req);
    
    // Notify Seller
    const buyer = dbInstance.buyers.find(b => b.id === req.buyerId);
    this.addNotificationInternal(dbInstance, {
        type: 'Payment',
        title: 'New Credit Request',
        message: `${buyer?.companyName || 'A buyer'} requested credit of ETB ${req.amount.toLocaleString()}.`,
        time: new Date().toLocaleString(),
        severity: 'medium',
        recipientId: 'seller',
        relatedId: req.id
    });

    this.logActivity(dbInstance, 'Credit Request', 'Finance', `New credit request for ETB ${req.amount} by ${buyer?.companyName}`, { name: buyer?.companyName || 'Buyer', type: 'Buyer' });
    this.saveDB(dbInstance);
  }
  updateCreditRequest(req: CreditRequest) {
    const dbInstance = this.getDB();
    const idx = dbInstance.creditRequests.findIndex(c => c.id === req.id);
    if (idx > -1) {
      const oldReq = dbInstance.creditRequests[idx];
      
      // If approved (fully or partially), add to buyer outstanding balance (DEBT)
      if ((req.status === 'Approved' || req.status === 'Partially Approved') && oldReq.status === 'Pending') {
        const buyer = dbInstance.buyers.find(b => b.id === req.buyerId);
        if (buyer) {
          const approvedVal = req.approvedAmount || req.amount;
          
          if (req.reason === 'Order Financing') {
             // Financing increases debt
             buyer.outstandingBalance += approvedVal;
             buyer.availableCredit = Math.max(0, buyer.availableCredit - approvedVal);
          } else {
             // For returns/damages, it acts as a credit note reducing debt
             buyer.outstandingBalance = Math.max(0, buyer.outstandingBalance - approvedVal);
             buyer.availableCredit += approvedVal;
          }
        }
      }

      // Notify Buyer of Status Change
      if (oldReq.status !== req.status) {
         this.addNotificationInternal(dbInstance, {
            type: 'Payment',
            title: `Credit Request ${req.status}`,
            message: `Your credit request for ETB ${req.amount.toLocaleString()} has been ${req.status.toLowerCase()}.`,
            time: new Date().toLocaleString(),
            severity: req.status === 'Approved' ? 'low' : req.status === 'Rejected' ? 'high' : 'medium',
            recipientId: req.buyerId,
            relatedId: req.id
         });
      }
      
      dbInstance.creditRequests[idx] = req;
      this.logActivity(dbInstance, 'Credit Update', 'Finance', `Credit request ${req.id} status changed to ${req.status}`);
      this.saveDB(dbInstance);
    }
  }

  // ORDERS
  getAllOrders(): Order[] { return this.getDB().orders; }
  getOrder(id: string) { return this.getDB().orders.find(o => o.id === id); }
  
  createOrder(order: Order) {
    const dbInstance = this.getDB();
    const buyer = dbInstance.buyers.find(b => b.id === order.buyerId);

    if (order.status !== OrderStatus.DRAFT) {
      order.stockDeducted = true;
      this.adjustInventoryOnInstance(dbInstance, order, 'deduct');
    }
    // Initialize payment tracking
    order.amountPaid = order.amountPaid || 0;
    order.paymentStatus = order.paymentStatus || 'Unpaid';

    dbInstance.orders.unshift(order);

    // Notify Seller if Buyer placed order
    if (order.createdBy === 'buyer' && order.status !== OrderStatus.DRAFT) {
        this.addNotificationInternal(dbInstance, {
            type: 'Order',
            title: 'New Order Received',
            message: `Order #${order.id.split('-').pop()} received from ${buyer?.companyName}.`,
            time: new Date().toLocaleString(),
            severity: 'medium',
            recipientId: 'seller',
            relatedId: order.id
        });
    }

    const actor = order.createdBy === 'buyer' 
        ? { name: buyer?.companyName || 'Buyer', type: 'Buyer' as const } 
        : undefined; // Default to current user (Staff)

    this.logActivity(dbInstance, 'Create Order', 'Orders', `Order #${order.id.split('-').pop()} created. Status: ${order.status}`, actor);
    this.saveDB(dbInstance);
  }

  updateOrder(order: Order) {
    const dbInstance = this.getDB();
    const idx = dbInstance.orders.findIndex(o => o.id === order.id);
    if (idx > -1) {
      const oldOrder = dbInstance.orders[idx];
      const buyer = dbInstance.buyers.find(b => b.id === order.buyerId);
      
      // Stock Adjustment Logic
      if (!oldOrder.stockDeducted && order.status !== OrderStatus.DRAFT && order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.DELETED) {
        order.stockDeducted = true;
        this.adjustInventoryOnInstance(dbInstance, order, 'deduct');
      } 
      else if (oldOrder.stockDeducted && order.status !== OrderStatus.DRAFT && order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.DELETED && order.status !== OrderStatus.UNDELIVERED) {
        this.adjustInventoryOnInstance(dbInstance, oldOrder, 'restore');
        this.adjustInventoryOnInstance(dbInstance, order, 'deduct');
        order.stockDeducted = true;
      }
      else if (oldOrder.stockDeducted && (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.UNDELIVERED || order.status === OrderStatus.DELETED)) {
        order.stockDeducted = false;
        this.adjustInventoryOnInstance(dbInstance, oldOrder, 'restore');
      }

      // Notify Seller if Buyer submits a draft to Pending
      if (oldOrder.status === OrderStatus.DRAFT && order.status === OrderStatus.PENDING) {
         this.addNotificationInternal(dbInstance, {
            type: 'Order',
            title: 'New Order Received',
            message: `Order #${order.id.split('-').pop()} submitted by ${buyer?.companyName}.`,
            time: new Date().toLocaleString(),
            severity: 'medium',
            recipientId: 'seller',
            relatedId: order.id
        });
      }

      // Notify Buyer if order is Shipped
      if (oldOrder.status !== OrderStatus.SHIPPED && order.status === OrderStatus.SHIPPED) {
         this.addNotificationInternal(dbInstance, {
            type: 'Order',
            title: 'Order Shipped',
            message: `Your order #${order.id.split('-').pop()} has been shipped and is on its way.`,
            time: new Date().toLocaleString(),
            severity: 'low',
            recipientId: order.buyerId,
            relatedId: order.id
         });
      }
      
      dbInstance.orders[idx] = order;
      this.logActivity(dbInstance, 'Update Order', 'Orders', `Order #${order.id.split('-').pop()} updated. Status: ${order.status}`);
      this.saveDB(dbInstance);
    }
  }

  deleteOrder(id: string) {
    this.updateOrderStatus(id, OrderStatus.DELETED, 'Order permanently moved to deleted records');
  }

  updateOrderStatus(orderId: string, status: OrderStatus, note?: string) {
    const dbInstance = this.getDB();
    const order = dbInstance.orders.find(o => o.id === orderId);
    if (order) {
      const oldStatus = order.status;

      if (!order.stockDeducted && (status === OrderStatus.PENDING || status === OrderStatus.PROCESSING || status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED)) {
        // IMPORTANT: DELIVERED also means stock is definitely out, ensure deduction if not already done
        order.stockDeducted = true;
        this.adjustInventoryOnInstance(dbInstance, order, 'deduct');
      }
      else if (order.stockDeducted && (status === OrderStatus.CANCELLED || status === OrderStatus.UNDELIVERED || status === OrderStatus.DELETED)) {
        order.stockDeducted = false;
        this.adjustInventoryOnInstance(dbInstance, order, 'restore');
      }
      order.status = status;
      order.history.push({
        status: status,
        date: new Date().toLocaleString(),
        note: note || `Status updated to ${status}`
      });

      // Notify Buyer if order is Shipped or Delivered
      if (oldStatus !== OrderStatus.SHIPPED && status === OrderStatus.SHIPPED) {
         this.addNotificationInternal(dbInstance, {
            type: 'Order',
            title: 'Order Shipped',
            message: `Your order #${order.id.split('-').pop()} has been shipped and is on its way.`,
            time: new Date().toLocaleString(),
            severity: 'low',
            recipientId: order.buyerId,
            relatedId: order.id
         });
      } else if (oldStatus !== OrderStatus.DELIVERED && status === OrderStatus.DELIVERED) {
         this.addNotificationInternal(dbInstance, {
            type: 'Order',
            title: 'Order Delivered',
            message: `Your order #${order.id.split('-').pop()} has been successfully delivered.`,
            time: new Date().toLocaleString(),
            severity: 'low',
            recipientId: order.buyerId,
            relatedId: order.id
         });
      }

      const noteText = note ? ` Note: ${note}` : '';
      this.logActivity(dbInstance, 'Status Update', 'Orders', `Order #${orderId.split('-').pop()} changed from ${oldStatus} to ${status}.${noteText}`);
      this.saveDB(dbInstance);
    }
  }

  getAllPricingRules(): PricingRule[] { return this.getDB().pricingRules; }
  getPricingRule(id: string) { return this.getDB().pricingRules.find(r => r.id === id); }
  createPricingRule(rule: PricingRule) {
    const dbInstance = this.getDB();
    dbInstance.pricingRules.unshift(rule);
    this.logActivity(dbInstance, 'Create Pricing', 'Settings', `Added pricing tier: ${rule.name}`);
    this.saveDB(dbInstance);
  }
  updatePricingRule(rule: PricingRule) {
    const dbInstance = this.getDB();
    const idx = dbInstance.pricingRules.findIndex(r => r.id === rule.id);
    if (idx > -1) { dbInstance.pricingRules[idx] = rule; this.saveDB(dbInstance); }
  }

  getAllBulkRules(): BulkDiscountRule[] { return this.getDB().bulkRules; }
  getBulkRule(id: string) { return this.getDB().bulkRules.find(r => r.id === id); }
  createBulkRule(rule: BulkDiscountRule) {
    const dbInstance = this.getDB();
    dbInstance.bulkRules.unshift(rule);
    this.logActivity(dbInstance, 'Create Bulk Rule', 'Settings', `Added bulk threshold: ${rule.unitThreshold} units`);
    this.saveDB(dbInstance);
  }
  updateBulkRule(rule: BulkDiscountRule) {
    const dbInstance = this.getDB();
    const idx = dbInstance.bulkRules.findIndex(r => r.id === rule.id);
    if (idx > -1) { dbInstance.bulkRules[idx] = rule; this.saveDB(dbInstance); }
  }
  deleteBulkRule(id: string) {
    const dbInstance = this.getDB();
    dbInstance.bulkRules = dbInstance.bulkRules.filter(r => r.id !== id);
    this.saveDB(dbInstance);
  }

  getAllMarginRules(): MarginDiscountRule[] { return this.getDB().marginRules; }
  getMarginRule(id: string) { return this.getDB().marginRules.find(r => r.id === id); }
  createMarginRule(rule: MarginDiscountRule) {
    const dbInstance = this.getDB();
    dbInstance.marginRules.unshift(rule);
    this.logActivity(dbInstance, 'Create Margin Rule', 'Settings', `Added margin constraint > ${rule.minMarginPercentage}%`);
    this.saveDB(dbInstance);
  }
  updateMarginRule(rule: MarginDiscountRule) {
    const dbInstance = this.getDB();
    const idx = dbInstance.marginRules.findIndex(r => r.id === rule.id);
    if (idx > -1) { dbInstance.marginRules[idx] = rule; this.saveDB(dbInstance); }
  }
  deleteMarginRule(id: string) {
    const dbInstance = this.getDB();
    dbInstance.marginRules = dbInstance.marginRules.filter(r => r.id !== id);
    this.saveDB(dbInstance);
  }

  getAllBuyers(): Buyer[] { return this.getDB().buyers; }
  getBuyer(id: string) { return this.getDB().buyers.find(b => b.id === id); }
  createBuyer(buyer: Buyer) {
    const dbInstance = this.getDB();
    dbInstance.buyers.unshift(buyer);
    this.logActivity(dbInstance, 'Register Buyer', 'Users', `Registered new buyer account: ${buyer.companyName}`);
    this.saveDB(dbInstance);
  }
  updateBuyer(buyer: Buyer) {
    const dbInstance = this.getDB();
    const idx = dbInstance.buyers.findIndex(b => b.id === buyer.id);
    if (idx > -1) { 
        dbInstance.buyers[idx] = buyer; 
        this.logActivity(dbInstance, 'Update Buyer', 'Users', `Updated profile for ${buyer.companyName}`);
        this.saveDB(dbInstance); 
    }
  }

  getAllStaff(): Staff[] { return this.getDB().staff; }
  createStaff(member: Staff) {
    const dbInstance = this.getDB();
    dbInstance.staff.unshift(member);
    this.logActivity(dbInstance, 'Add Staff', 'Users', `Added staff member: ${member.name} (${member.role})`);
    this.saveDB(dbInstance);
  }
  updateStaff(member: Staff) {
    const dbInstance = this.getDB();
    const idx = dbInstance.staff.findIndex(s => s.id === member.id);
    if (idx > -1) { 
        dbInstance.staff[idx] = member; 
        this.logActivity(dbInstance, 'Update Staff', 'Users', `Updated staff details for ${member.name}`);
        this.saveDB(dbInstance); 
    }
  }

  getAllRoles(): Role[] { return this.getDB().roles; }
  createRole(role: Role) {
    const dbInstance = this.getDB();
    dbInstance.roles.unshift(role);
    this.logActivity(dbInstance, 'Create Role', 'Settings', `Created new role: ${role.name}`);
    this.saveDB(dbInstance);
  }
  updateRole(role: Role) {
    const dbInstance = this.getDB();
    const idx = dbInstance.roles.findIndex(r => r.id === role.id);
    if (idx > -1) { dbInstance.roles[idx] = role; this.saveDB(dbInstance); }
  }

  getAllPayments(): Payment[] { return this.getDB().payments; }
  getPayment(id: string) { return this.getDB().payments.find(p => p.id === id); }
  
  createPayment(payment: Payment) {
    const dbInstance = this.getDB();
    dbInstance.payments.unshift(payment);
    const buyer = dbInstance.buyers.find(b => b.id === payment.buyerId);
    
    // Update Order Amount Paid and Status
    const orderIdx = dbInstance.orders.findIndex(o => o.id === payment.orderId);
    if (orderIdx > -1) {
      const order = dbInstance.orders[orderIdx];
      order.amountPaid = (order.amountPaid || 0) + payment.amount;
      
      if (order.amountPaid >= order.total) {
        order.paymentStatus = 'Paid';
      } else {
        order.paymentStatus = 'Partially Paid';
      }
    }

    // Update Buyer Outstanding Balance (Debt Reduction)
    const buyerIdx = dbInstance.buyers.findIndex(b => b.id === payment.buyerId);
    if (buyerIdx > -1) {
      const buyer = dbInstance.buyers[buyerIdx];
      // Reduce outstanding balance by payment amount
      buyer.outstandingBalance = Math.max(0, buyer.outstandingBalance - payment.amount);
      // Optional: Restore available credit logic could go here depending on business rules
      // For now, assuming payment restores credit limit availability
      buyer.availableCredit = Math.min(buyer.creditLimit, buyer.availableCredit + payment.amount);
    }

    // Notify Seller
    this.addNotificationInternal(dbInstance, {
        type: 'Payment',
        title: 'Payment Received',
        message: `Payment of ETB ${payment.amount.toLocaleString()} received from ${buyer?.companyName} for Order #${payment.orderId.split('-').pop()}.`,
        time: new Date().toLocaleString(),
        severity: 'high',
        recipientId: 'seller',
        relatedId: payment.id
    });

    const actor = { name: buyer?.companyName || 'Buyer', type: 'Buyer' as const };
    this.logActivity(dbInstance, 'Submit Payment', 'Finance', `Payment of ETB ${payment.amount} submitted for Order #${payment.orderId.split('-').pop()}`, actor);
    this.saveDB(dbInstance);
  }

  updatePayment(payment: Payment) {
    const dbInstance = this.getDB();
    const idx = dbInstance.payments.findIndex(p => p.id === payment.id);
    if (idx > -1) {
      const oldPayment = dbInstance.payments[idx];
      
      // If moving to REJECTED from a non-rejected state, reverse the financial impact
      if (payment.status === PaymentStatus.REJECTED && oldPayment.status !== PaymentStatus.REJECTED) {
        // Reverse Order Impact
        const orderIdx = dbInstance.orders.findIndex(o => o.id === payment.orderId);
        if (orderIdx > -1) {
          const order = dbInstance.orders[orderIdx];
          order.amountPaid = Math.max(0, (order.amountPaid || 0) - payment.amount);
          // Recalculate status
          order.paymentStatus = order.amountPaid >= order.total ? 'Paid' : order.amountPaid > 0 ? 'Partially Paid' : 'Unpaid';
        }

        // Reverse Buyer Impact
        const buyerIdx = dbInstance.buyers.findIndex(b => b.id === payment.buyerId);
        if (buyerIdx > -1) {
          const buyer = dbInstance.buyers[buyerIdx];
          buyer.outstandingBalance += payment.amount;
          buyer.availableCredit = Math.max(0, buyer.availableCredit - payment.amount);
        }
      }

      // If moving FROM REJECTED to APPROVED/MISMATCHED (re-applying), apply financial impact
      if (oldPayment.status === PaymentStatus.REJECTED && payment.status !== PaymentStatus.REJECTED) {
         // Re-apply Order Impact
         const orderIdx = dbInstance.orders.findIndex(o => o.id === payment.orderId);
         if (orderIdx > -1) {
           const order = dbInstance.orders[orderIdx];
           order.amountPaid = (order.amountPaid || 0) + payment.amount;
           order.paymentStatus = order.amountPaid >= order.total ? 'Paid' : 'Partially Paid';
         }

         // Re-apply Buyer Impact
         const buyerIdx = dbInstance.buyers.findIndex(b => b.id === payment.buyerId);
         if (buyerIdx > -1) {
           const buyer = dbInstance.buyers[buyerIdx];
           buyer.outstandingBalance = Math.max(0, buyer.outstandingBalance - payment.amount);
           buyer.availableCredit = Math.min(buyer.creditLimit, buyer.availableCredit + payment.amount);
         }
      }

      // Notify Buyer of Payment Status Change
      if (oldPayment.status !== payment.status) {
        let title = '';
        let message = '';
        let severity: 'low' | 'medium' | 'high' = 'low';

        if (payment.status === PaymentStatus.APPROVED) {
            title = 'Payment Approved';
            message = `Your payment of ETB ${payment.amount.toLocaleString()} for Order #${payment.orderId.split('-').pop()} has been approved.`;
            severity = 'low';
        } else if (payment.status === PaymentStatus.REJECTED) {
            title = 'Payment Rejected';
            message = `Your payment for Order #${payment.orderId.split('-').pop()} was rejected. Reason: ${payment.notes || 'Verification failed'}.`;
            severity = 'high';
        } else if (payment.status === PaymentStatus.MISMATCHED) {
            title = 'Payment Issue';
            message = `There is a mismatch with your payment for Order #${payment.orderId.split('-').pop()}. Please check notes.`;
            severity = 'medium';
        }

        if (title) {
            this.addNotificationInternal(dbInstance, {
                type: 'Payment',
                title: title,
                message: message,
                time: new Date().toLocaleString(),
                severity: severity,
                recipientId: payment.buyerId,
                relatedId: payment.orderId
            });
        }
      }

      dbInstance.payments[idx] = payment;
      this.logActivity(dbInstance, 'Review Payment', 'Finance', `Payment ${payment.id} marked as ${payment.status}`);
      this.saveDB(dbInstance);
    }
  }
  
  getAllNotifications(): Notification[] { return this.getDB().notifications; }
  markAllNotificationsAsRead(userId: string) {
    const dbInstance = this.getDB();
    dbInstance.notifications = dbInstance.notifications.map(n => 
      n.recipientId === userId ? { ...n, isRead: true } : n
    );
    this.saveDB(dbInstance);
  }
  deleteNotification(id: string) {
    const dbInstance = this.getDB();
    dbInstance.notifications = dbInstance.notifications.filter(n => n.id !== id);
    this.saveDB(dbInstance);
  }
}

export const db = new DatabaseService();
