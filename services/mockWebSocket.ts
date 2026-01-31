
import { db } from './databaseService';
import { Product } from '../types';

type Listener = (data: any) => void;

class MockWebSocketService {
  private listeners: Record<string, Listener[]> = {};
  private intervalId: any = null;
  private isConnected = false;

  // Simulate connection
  connect() {
    if (this.isConnected) return;
    this.isConnected = true;
    
    // Simulate real-time activity loop
    this.intervalId = setInterval(() => {
      this.simulateStockChange();
    }, 4000); 
  }

  disconnect() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.isConnected = false;
  }

  // Subscribe to events
  on(event: string, fn: Listener) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  // Unsubscribe
  off(event: string, fn: Listener) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== fn);
  }

  private emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(fn => fn(data));
    }
  }

  // Simulate a backend event changing data
  private simulateStockChange() {
    const products = db.getAllProducts();
    if (products.length === 0) return;

    // Pick random product
    const product = products[Math.floor(Math.random() * products.length)];
    
    // 70% chance of sale (decrease), 30% chance of restocking/return (increase)
    const isSale = Math.random() > 0.3;
    const change = Math.floor(Math.random() * 3) + 1; // 1 to 3 items

    const newStock = { ...product.stock };
    
    if (isSale) {
        // Decrease from main warehouse first, then show room
        if (newStock.mainWarehouse >= change) {
            newStock.mainWarehouse -= change;
        } else if (newStock.showRoom >= change) {
            newStock.showRoom -= change;
        } else {
            return; // No stock to sell, skip update
        }
    } else {
        // Restock randomly to one location
        const locs = ['mainWarehouse', 'backRoom', 'showRoom'];
        const target = locs[Math.floor(Math.random() * locs.length)] as keyof typeof newStock;
        newStock[target] += change;
    }

    // Update DB (So it persists if user reloads)
    const total = newStock.mainWarehouse + newStock.backRoom + newStock.showRoom;
    let status: Product['status'] = product.status;
    
    if (total === 0) status = 'Empty';
    else if (total < product.reorderPoint) status = 'Low';
    else status = 'In Stock';

    const updatedProduct = { ...product, stock: newStock, status };
    db.updateProduct(updatedProduct); 

    // Broadcast event to frontend components
    this.emit('stock_update', {
        productId: product.id,
        stock: newStock,
        status: status,
        total: total,
        name: product.name,
        changeType: isSale ? 'decrease' : 'increase',
        changeAmount: change
    });
  }
}

export const socket = new MockWebSocketService();
