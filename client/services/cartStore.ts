// services/cartStore.ts
type CartItem = { productId: string; quantity: number };

let cart: CartItem[] = [];

const notify = () => {
  const count = cart.reduce((acc, item) => acc + item.quantity, 0);
  window.dispatchEvent(new CustomEvent('cart-updated', { detail: { count } }));
};

export const getCart = (): CartItem[] => cart.map(item => ({ ...item }));

export const setCart = (items: CartItem[]) => {
  cart = items.filter(i => i.quantity > 0);
  notify();
};

export const addToCart = (productId: string, quantity = 1) => {
  const existing = cart.find(i => i.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }
  cart = cart.filter(i => i.quantity > 0);
  notify();
};

export const updateCartItem = (productId: string, quantity: number) => {
  if (quantity <= 0) {
    cart = cart.filter(i => i.productId !== productId);
  } else {
    const existing = cart.find(i => i.productId === productId);
    if (existing) {
      existing.quantity = quantity;
    } else {
      cart.push({ productId, quantity });
    }
  }
  notify();
};

export const clearCart = () => {
  cart = [];
  notify();
};

export const getCartCount = () => cart.reduce((acc, item) => acc + item.quantity, 0);
